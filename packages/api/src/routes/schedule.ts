import { Router, type Router as ExpressRouter } from "express";
import { query } from "../config/database";
import { redisClient } from "../config/redis";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { badRequest, notFound } from "../middleware/errorHandler";
import { getIo, rooms } from "../sockets";
import type { AuthedRequest } from "../types";

const router: ExpressRouter = Router();
const schedulerRoles = requireRole("channel_manager", "super_admin");

// GET /api/channels/:channelId/schedule?date=YYYY-MM-DD
router.get(
  "/channels/:channelId/schedule",
  asyncHandler(async (req, res) => {
    const date = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);
    const { rows } = await query(
      `SELECT s.id, s.title, s.start_time, s.end_time, s.is_filler, s.is_ad_break,
              v.id AS video_id, v.title AS video_title, v.thumbnail_url, v.duration_seconds
       FROM schedule s
       LEFT JOIN videos v ON v.id = s.video_id
       WHERE s.channel_id = $1
         AND s.start_time >= $2::date
         AND s.start_time <  ($2::date + interval '1 day')
       ORDER BY s.start_time ASC`,
      [req.params.channelId, date]
    );
    ok(res, { date, items: rows });
  })
);

// POST /api/channels/:channelId/schedule (channel_manager, super_admin)
router.post(
  "/channels/:channelId/schedule",
  authenticate,
  schedulerRoles,
  asyncHandler(async (req: AuthedRequest, res) => {
    const channelId = req.params.channelId;
    const { videoId, startTime, endTime, title } = req.body as {
      videoId: string;
      startTime: string;
      endTime: string;
      title?: string;
    };
    if (!videoId || !startTime || !endTime) {
      throw badRequest("videoId, startTime, endTime required");
    }
    if (new Date(endTime) <= new Date(startTime)) {
      throw badRequest("endTime must be after startTime");
    }

    const v = await query<{ status: string; title: string }>(
      "SELECT status, title FROM videos WHERE id = $1",
      [videoId]
    );
    if (!v.rows[0]) throw notFound("Video not found");
    if (v.rows[0].status !== "ready") {
      throw badRequest("Video is not ready to schedule", "VIDEO_NOT_READY");
    }

    try {
      const { rows } = await query(
        `INSERT INTO schedule (channel_id, video_id, title, start_time, end_time, created_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, start_time, end_time`,
        [channelId, videoId, title ?? v.rows[0].title, startTime, endTime, req.user!.id]
      );
      try {
        getIo().to(rooms.channel(channelId)).emit("schedule-updated", { channelId });
      } catch {
        /* socket optional */
      }
      ok(res, { item: rows[0] }, 201);
    } catch (err) {
      // EXCLUDE constraint → overlapping program.
      if ((err as { code?: string }).code === "23P01") {
        throw badRequest("Overlaps an existing program on this channel", "SCHEDULE_OVERLAP");
      }
      throw err;
    }
  })
);

// DELETE /api/schedule/:itemId — future items only.
router.delete(
  "/schedule/:itemId",
  authenticate,
  schedulerRoles,
  asyncHandler(async (req, res) => {
    const result = await query(
      "DELETE FROM schedule WHERE id = $1 AND start_time > NOW()",
      [req.params.itemId]
    );
    if (!result.rowCount) {
      throw badRequest("Not found or already started", "CANNOT_DELETE");
    }
    ok(res, { success: true });
  })
);

// GET /api/channels/:channelId/now-playing (public) — Redis first, DB fallback.
router.get(
  "/channels/:channelId/now-playing",
  asyncHandler(async (req, res) => {
    const channelId = req.params.channelId;
    const cached = await redisClient.get(`nowplaying:${channelId}`);
    if (cached) {
      ok(res, { item: JSON.parse(cached) });
      return;
    }

    const { rows } = await query<{
      title: string;
      hls_url: string | null;
      thumbnail_url: string | null;
      start_time: Date;
      end_time: Date;
    }>(
      `SELECT s.title, v.hls_url, v.thumbnail_url, s.start_time, s.end_time
       FROM schedule s LEFT JOIN videos v ON v.id = s.video_id
       WHERE s.channel_id = $1 AND s.start_time <= NOW() AND s.end_time > NOW()
       ORDER BY s.start_time ASC LIMIT 1`,
      [channelId]
    );
    if (!rows[0]) {
      ok(res, { item: null });
      return;
    }
    const row = rows[0];
    const now = Date.now();
    const item = {
      title: row.title,
      hlsUrl: row.hls_url,
      thumbnail: row.thumbnail_url,
      elapsedSeconds: Math.max(0, Math.floor((now - new Date(row.start_time).getTime()) / 1000)),
      remainingSeconds: Math.max(0, Math.floor((new Date(row.end_time).getTime() - now) / 1000)),
    };
    ok(res, { item });
  })
);

export default router;
