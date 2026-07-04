import crypto from "crypto";
import { Router, type Router as ExpressRouter } from "express";
import multer from "multer";
import multerS3 from "multer-s3";
import { s3Client, buckets } from "../config/aws";
import { query } from "../config/database";
import { redisClient } from "../config/redis";
import { enqueueTranscode } from "../config/queue";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { badRequest, forbidden, notFound } from "../middleware/errorHandler";
import {
  createMultipartUpload,
  completeMultipartUpload,
} from "../utils/s3";
import type { AuthedRequest } from "../types";

const VIDEO_MIME = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
];
const MAX_BYTES = 50 * 1024 * 1024 * 1024; // 50GB

const uploadDirect = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: buckets.uploads,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, _file, cb) => {
      const userId = (req as AuthedRequest).user!.id;
      cb(null, `${userId}/${crypto.randomUUID()}.mp4`);
    },
  }),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => cb(null, VIDEO_MIME.includes(file.mimetype)),
});

const router: ExpressRouter = Router();
const creatorRoles = requireRole("creator", "channel_manager", "super_admin");

// ─────────── POST /video (direct upload, ≤ multipart threshold) ───────────
router.post(
  "/video",
  authenticate,
  creatorRoles,
  uploadDirect.single("video"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const file = req.file as (Express.Multer.File & { key: string }) | undefined;
    if (!file) throw badRequest("No video file (mp4/mov/avi/mkv, ≤50GB)");

    const { rows } = await query<{ id: string }>(
      `INSERT INTO videos (creator_id, title, status, s3_original_key)
       VALUES ($1,$2,'uploading',$3) RETURNING id`,
      [req.user!.id, (req.body?.title as string) ?? file.originalname, file.key]
    );
    const videoId = rows[0].id;
    await enqueueTranscode({
      videoId,
      s3OriginalKey: file.key,
      userId: req.user!.id,
    });
    ok(res, { videoId, status: "uploading" }, 201);
  })
);

// ─────────── GET /presign (multipart, files >100MB) ───────────
router.get(
  "/presign",
  authenticate,
  creatorRoles,
  asyncHandler(async (req: AuthedRequest, res) => {
    const filename = (req.query.filename as string) ?? "video.mp4";
    const contentType = (req.query.contentType as string) ?? "video/mp4";
    if (!VIDEO_MIME.includes(contentType)) throw badRequest("Unsupported type");

    const key = `${req.user!.id}/${crypto.randomUUID()}.mp4`;
    const { rows } = await query<{ id: string }>(
      `INSERT INTO videos (creator_id, title, status, s3_original_key)
       VALUES ($1,$2,'uploading',$3) RETURNING id`,
      [req.user!.id, filename, key]
    );
    const { uploadId, parts } = await createMultipartUpload(
      buckets.uploads,
      key,
      contentType
    );
    ok(res, { videoId: rows[0].id, key, uploadId, parts });
  })
);

// ─────────── POST /complete (finish multipart + queue) ───────────
router.post(
  "/complete",
  authenticate,
  creatorRoles,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { videoId, uploadId, parts } = req.body as {
      videoId: string;
      uploadId: string;
      parts: Array<{ ETag: string; PartNumber: number }>;
    };
    if (!videoId || !uploadId || !Array.isArray(parts)) {
      throw badRequest("videoId, uploadId, parts required");
    }

    const { rows } = await query<{ s3_original_key: string; creator_id: string }>(
      "SELECT s3_original_key, creator_id FROM videos WHERE id = $1",
      [videoId]
    );
    const video = rows[0];
    if (!video) throw notFound("Video not found");
    if (video.creator_id !== req.user!.id && req.user!.role !== "super_admin") {
      throw forbidden("Not the owner");
    }

    await completeMultipartUpload(
      buckets.uploads,
      video.s3_original_key,
      uploadId,
      parts
    );
    await enqueueTranscode({
      videoId,
      s3OriginalKey: video.s3_original_key,
      userId: req.user!.id,
    });
    ok(res, { videoId, status: "uploading" });
  })
);

// ─────────── GET /status/:videoId (owner or admin) ───────────
router.get(
  "/status/:videoId",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { rows } = await query<{
      status: string;
      creator_id: string;
      hls_url: string | null;
    }>("SELECT status, creator_id, hls_url FROM videos WHERE id = $1", [
      req.params.videoId,
    ]);
    const video = rows[0];
    if (!video) throw notFound("Video not found");
    if (video.creator_id !== req.user!.id && req.user!.role !== "super_admin") {
      throw forbidden("Not the owner");
    }
    const progress = Number(
      (await redisClient.get(`transcode:progress:${req.params.videoId}`)) ?? 0
    );
    ok(res, { status: video.status, progress, hlsUrl: video.hls_url });
  })
);

export default router;
