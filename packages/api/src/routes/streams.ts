import express, { Router, type Router as ExpressRouter } from "express";
import { query } from "../config/database";
import { redisClient } from "../config/redis";
import { cloudfrontUrl } from "../config/aws";
import { asyncHandler } from "../utils/asyncHandler";
import { getIo, rooms } from "../sockets";

// Internal endpoints invoked by nginx-rtmp callbacks (form-encoded).
// Restrict to localhost/VPC at the reverse-proxy / security-group layer.
const router: ExpressRouter = Router();
router.use(express.urlencoded({ extended: false }));

// on_publish → verify stream key. Non-200 makes nginx reject the stream.
router.post(
  "/verify",
  asyncHandler(async (req, res) => {
    const name = (req.body?.name as string) ?? "";
    const { rows } = await query<{ id: string }>(
      "SELECT id FROM channels WHERE stream_key = $1",
      [name]
    );
    if (!rows[0]) {
      res.status(401).send("unknown stream key");
      return;
    }
    await query(
      "UPDATE channels SET status = 'active', updated_at = NOW() WHERE id = $1",
      [rows[0].id]
    );
    try {
      getIo().to(rooms.admin()).emit("stream-started", { channelId: rows[0].id });
    } catch {
      /* socket may not be up during isolated tests */
    }
    res.status(200).send("ok");
  })
);

// on_publish_done → mark offline, clear now-playing cache.
router.post(
  "/ended",
  asyncHandler(async (req, res) => {
    const name = (req.body?.name as string) ?? "";
    const { rows } = await query<{ id: string }>(
      "SELECT id FROM channels WHERE stream_key = $1",
      [name]
    );
    if (rows[0]) {
      await query("UPDATE channels SET status = 'offline' WHERE id = $1", [
        rows[0].id,
      ]);
      await redisClient.del(`nowplaying:${rows[0].id}`);
    }
    res.status(200).send("ok");
  })
);

// apex-create-master.sh → publish HLS output URL once the master playlist exists.
router.post(
  "/ready/:streamKey",
  asyncHandler(async (req, res) => {
    const { rows } = await query<{ id: string; slug: string }>(
      "SELECT id, slug FROM channels WHERE stream_key = $1",
      [req.params.streamKey]
    );
    if (rows[0]) {
      const hls = cloudfrontUrl(`hls/${rows[0].slug}/master.m3u8`);
      await query("UPDATE channels SET hls_output_url = $1 WHERE id = $2", [
        hls,
        rows[0].id,
      ]);
    }
    res.status(200).send("ok");
  })
);

export default router;
