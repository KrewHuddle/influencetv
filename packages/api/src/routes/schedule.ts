import { Router, type Router as ExpressRouter } from "express";
import { query, transaction } from "../config/database";
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
    const { videoId, startTime, endTime, title, isAdBreak, adPodId } = req.body as {
      videoId?: string;
      startTime: string;
      endTime: string;
      title?: string;
      isAdBreak?: boolean;
      adPodId?: string;
    };
    if (!startTime || !endTime) {
      throw badRequest("startTime, endTime required");
    }
    if (!isAdBreak && !videoId) {
      throw badRequest("videoId required (or set isAdBreak for an ad break)");
    }
    if (new Date(endTime) <= new Date(startTime)) {
      throw badRequest("endTime must be after startTime");
    }

    // An ad break has no video (the playout engine fills it from ad campaigns).
    let programTitle = title ?? "Ad Break";
    if (videoId) {
      const v = await query<{ status: string; title: string }>(
        "SELECT status, title FROM videos WHERE id = $1",
        [videoId]
      );
      if (!v.rows[0]) throw notFound("Video not found");
      if (v.rows[0].status !== "ready") {
        throw badRequest("Video is not ready to schedule", "VIDEO_NOT_READY");
      }
      programTitle = title ?? v.rows[0].title;
    }

    try {
      const { rows } = await query(
        `INSERT INTO schedule
           (channel_id, video_id, title, start_time, end_time, is_ad_break, ad_pod_id, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, start_time, end_time, is_ad_break`,
        [
          channelId, videoId ?? null, programTitle, startTime, endTime,
          isAdBreak ?? false, adPodId ?? null, req.user!.id,
        ]
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

// POST /api/channels/:channelId/schedule/auto-fill (channel_manager, super_admin)
// Fill a time window with a playlist: videos placed back-to-back, skipping
// around existing blocks. Optional loop, shuffle, and periodic ad breaks.
router.post(
  "/channels/:channelId/schedule/auto-fill",
  authenticate,
  schedulerRoles,
  asyncHandler(async (req: AuthedRequest, res) => {
    const channelId = req.params.channelId;
    const {
      videoIds,
      startTime,
      endTime,
      loop = false,
      shuffle = false,
      adBreakEveryMinutes = 0,
      adBreakDurationSeconds = 60,
    } = req.body as {
      videoIds: string[];
      startTime: string;
      endTime: string;
      loop?: boolean;
      shuffle?: boolean;
      adBreakEveryMinutes?: number;
      adBreakDurationSeconds?: number;
    };

    if (!Array.isArray(videoIds) || videoIds.length === 0)
      throw badRequest("videoIds required");
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    if (!start || !end || end <= start) throw badRequest("Invalid time window");
    if (end - start > 7 * 24 * 3600_000) throw badRequest("Window too large (max 7 days)");

    // Ready videos with durations, preserving request order.
    const vres = await query<{ id: string; title: string; duration_seconds: number | null }>(
      `SELECT id, title, duration_seconds FROM videos
       WHERE id = ANY($1::uuid[]) AND status = 'ready'`,
      [videoIds]
    );
    const byId = new Map(vres.rows.map((v) => [v.id, v]));
    let playlist = videoIds
      .map((id) => byId.get(id))
      .filter((v): v is NonNullable<typeof v> => Boolean(v && v.duration_seconds));
    if (playlist.length === 0)
      throw badRequest("No ready videos with known duration in the selection");
    if (shuffle) playlist = [...playlist].sort(() => Math.random() - 0.5);

    // Existing blocks in the window (collision map).
    const existing = await query<{ s: string; e: string }>(
      `SELECT start_time AS s, end_time AS e FROM schedule
       WHERE channel_id = $1 AND end_time > to_timestamp($2/1000.0)
         AND start_time < to_timestamp($3/1000.0)
       ORDER BY start_time`,
      [channelId, start, end]
    );
    const blocks = existing.rows.map((b) => ({
      s: new Date(b.s).getTime(),
      e: new Date(b.e).getTime(),
    }));

    // Advance the cursor past any block a placement of durMs would collide with.
    const place = (cursor: number, durMs: number): number => {
      let c = cursor;
      for (const b of blocks) {
        if (c < b.e && c + durMs > b.s) c = b.e;
      }
      return c;
    };

    interface Row { videoId: string | null; title: string; s: number; e: number; isAd: boolean }
    const rows: Row[] = [];
    let cursor = start;
    let sinceAdMs = 0;
    const adEveryMs = Math.max(0, adBreakEveryMinutes) * 60_000;
    const adDurMs = Math.min(600, Math.max(15, adBreakDurationSeconds)) * 1000;
    const MAX_ROWS = 500;

    outer: for (let pass = 0; pass < (loop ? 1000 : 1); pass++) {
      let placedThisPass = 0;
      for (const v of playlist) {
        if (rows.length >= MAX_ROWS) break outer;
        const durMs = (v.duration_seconds as number) * 1000;
        // periodic ad break before the next program
        if (adEveryMs > 0 && sinceAdMs >= adEveryMs) {
          const c = place(cursor, adDurMs);
          if (c + adDurMs <= end) {
            rows.push({ videoId: null, title: "Ad Break", s: c, e: c + adDurMs, isAd: true });
            blocks.push({ s: c, e: c + adDurMs });
            cursor = c + adDurMs;
            sinceAdMs = 0;
          }
        }
        const c = place(cursor, durMs);
        if (c + durMs > end) {
          if (loop) break outer; // window exhausted
          continue; // non-loop: a shorter later video may still fit
        }
        rows.push({ videoId: v.id, title: v.title, s: c, e: c + durMs, isAd: false });
        blocks.push({ s: c, e: c + durMs });
        cursor = c + durMs;
        sinceAdMs += durMs;
        placedThisPass++;
      }
      if (!loop || placedThisPass === 0) break;
    }

    if (rows.length === 0)
      throw badRequest("Nothing fits in that window (check existing programming)");

    try {
      await transaction(async (c) => {
        for (const r of rows) {
          await c.query(
            `INSERT INTO schedule
               (channel_id, video_id, title, start_time, end_time, is_ad_break, created_by)
             VALUES ($1,$2,$3,to_timestamp($4/1000.0),to_timestamp($5/1000.0),$6,$7)`,
            [channelId, r.videoId, r.title, r.s, r.e, r.isAd, req.user!.id]
          );
        }
      });
    } catch (err) {
      if ((err as { code?: string }).code === "23P01") {
        throw badRequest(
          "Overlap while writing (schedule changed concurrently) — retry",
          "SCHEDULE_OVERLAP"
        );
      }
      throw err;
    }

    try {
      getIo().to(rooms.channel(channelId)).emit("schedule-updated", { channelId });
    } catch {
      /* socket optional */
    }
    ok(
      res,
      {
        created: rows.length,
        programs: rows.filter((r) => !r.isAd).length,
        adBreaks: rows.filter((r) => r.isAd).length,
        firstStart: new Date(rows[0].s).toISOString(),
        lastEnd: new Date(rows[rows.length - 1].e).toISOString(),
      },
      201
    );
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
