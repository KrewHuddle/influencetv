import { Router, type Router as ExpressRouter } from "express";
import { query } from "../config/database";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { notFound } from "../middleware/errorHandler";

const router: ExpressRouter = Router();

// Shared column list for a channel card, with a derived 1-based channel number
// (schema has no explicit number) and the currently-airing show title.
const CHANNEL_SELECT = `
  c.id, c.name, c.slug, c.genre, c.status,
  c.artwork_url  AS thumbnail_url,
  c.banner_url,
  c.hls_output_url,
  c.viewer_count,
  c.requires_premium,
  (row_number() OVER (ORDER BY c.created_at))::int AS number,
  np.title AS current_show
`;

const NOW_PLAYING_LATERAL = `
  LEFT JOIN LATERAL (
    SELECT s.title
    FROM schedule s
    WHERE s.channel_id = c.id
      AND s.start_time <= NOW()
      AND s.end_time   >  NOW()
    ORDER BY s.start_time DESC
    LIMIT 1
  ) np ON true
`;

// GET /api/channels — list all channels (live first), for the home rail.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const liveOnly = req.query.live === "true" || req.query.status === "active";
    const { rows } = await query(
      `SELECT ${CHANNEL_SELECT}
       FROM channels c
       ${NOW_PLAYING_LATERAL}
       ${liveOnly ? "WHERE c.status = 'active'" : ""}
       ORDER BY (c.status = 'active') DESC, number ASC`
    );
    ok(res, { channels: rows });
  })
);

// GET /api/channels/guide — EPG grid: each channel + its upcoming schedule blocks.
router.get(
  "/guide",
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT
         c.id, c.name, c.slug, c.genre, c.status,
         (row_number() OVER (ORDER BY c.created_at))::int AS number,
         COALESCE((
           SELECT json_agg(json_build_object(
             'id',         s.id,
             'title',      s.title,
             'start_time', s.start_time,
             'end_time',   s.end_time,
             'genre',      c.genre
           ) ORDER BY s.start_time)
           FROM schedule s
           WHERE s.channel_id = c.id
             AND s.end_time   > NOW()
             AND s.start_time < NOW() + interval '12 hours'
         ), '[]'::json) AS items
       FROM channels c
       ORDER BY number ASC`
    );
    ok(res, { channels: rows });
  })
);

// GET /api/channels/slug/:slug — single channel for the player page.
router.get(
  "/slug/:slug",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT
         c.id, c.name, c.slug, c.genre, c.status,
         c.artwork_url AS thumbnail_url,
         c.banner_url, c.description,
         c.hls_output_url, c.viewer_count, c.requires_premium,
         (SELECT COUNT(*)::int + 1 FROM channels c2 WHERE c2.created_at < c.created_at) AS number,
         np.title AS current_show
       FROM channels c
       ${NOW_PLAYING_LATERAL}
       WHERE c.slug = $1
       LIMIT 1`,
      [req.params.slug]
    );
    if (!rows[0]) throw notFound("Channel not found");
    ok(res, { channel: rows[0] });
  })
);

export default router;
