import { Router, type Router as ExpressRouter } from "express";
import { query, transaction } from "../config/database";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { badRequest, forbidden, notFound } from "../middleware/errorHandler";
import type { AuthedRequest } from "../types";

const router: ExpressRouter = Router();

async function loadOwned(videoId: string, req: AuthedRequest) {
  const { rows } = await query<{
    creator_id: string;
    status: string;
  }>("SELECT creator_id, status FROM videos WHERE id=$1", [videoId]);
  const video = rows[0];
  if (!video) throw notFound("Video not found");
  if (video.creator_id !== req.user!.id && req.user!.role !== "super_admin") {
    throw forbidden("Not the owner");
  }
  return video;
}

async function isScheduledOrPlaying(videoId: string): Promise<boolean> {
  const r = await query(
    "SELECT 1 FROM schedule WHERE video_id=$1 AND end_time > NOW() LIMIT 1",
    [videoId]
  );
  return (r.rowCount ?? 0) > 0;
}

// PATCH /api/videos/:videoId (owner or admin)
router.patch(
  "/:videoId",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    await loadOwned(req.params.videoId, req);
    if (await isScheduledOrPlaying(req.params.videoId)) {
      throw badRequest("Cannot edit a scheduled video", "VIDEO_SCHEDULED");
    }
    const { title, description, rating, tags, isPatronExclusive, patronTierId } =
      req.body as {
        title?: string;
        description?: string;
        rating?: string;
        tags?: string[];
        isPatronExclusive?: boolean;
        patronTierId?: string | null;
      };
    const { rows } = await query(
      `UPDATE videos SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         rating = COALESCE($3, rating)::content_rating,
         tags = COALESCE($4, tags),
         is_patron_exclusive = COALESCE($5, is_patron_exclusive),
         patron_tier_id = COALESCE($6, patron_tier_id),
         updated_at = NOW()
       WHERE id=$7
       RETURNING id, title, description, rating, tags, is_patron_exclusive, patron_tier_id, status`,
      [
        title ?? null, description ?? null, rating ?? null, tags ?? null,
        isPatronExclusive ?? null, patronTierId ?? null, req.params.videoId,
      ]
    );
    ok(res, { video: rows[0] });
  })
);

// DELETE /api/videos/:videoId (soft delete → rejected)
router.delete(
  "/:videoId",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    await loadOwned(req.params.videoId, req);
    if (await isScheduledOrPlaying(req.params.videoId)) {
      throw badRequest("Cannot delete a scheduled/playing video", "VIDEO_SCHEDULED");
    }
    await query(
      "UPDATE videos SET status='rejected', rejection_reason='deleted by owner', updated_at=NOW() WHERE id=$1",
      [req.params.videoId]
    );
    ok(res, { success: true });
  })
);

// PATCH /api/videos/:videoId/products — set in-video product tags.
router.patch(
  "/:videoId/products",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    await loadOwned(req.params.videoId, req);
    const { products } = req.body as {
      products: Array<{ productId: string; timestampSeconds: number; isFeatured?: boolean }>;
    };
    if (!Array.isArray(products)) throw badRequest("products array required");
    await transaction(async (c) => {
      await c.query("DELETE FROM video_products WHERE video_id=$1", [req.params.videoId]);
      for (const p of products) {
        await c.query(
          `INSERT INTO video_products (video_id, product_id, timestamp_seconds, is_featured)
           VALUES ($1,$2,$3,$4)`,
          [req.params.videoId, p.productId, p.timestampSeconds, p.isFeatured ?? false]
        );
      }
    });
    ok(res, { success: true, count: products.length });
  })
);

// GET /api/videos/:videoId (public) — single ready video for the watch page.
// Also increments view_count (previously never tracked).
router.get(
  "/:videoId",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT v.id, v.title, v.description, v.hls_url, v.thumbnail_url,
              v.duration_seconds, v.view_count, v.like_count, v.genre, v.type,
              v.is_premium, v.is_patron_exclusive, v.patron_tier_id,
              v.published_at, v.created_at,
              u.id AS creator_id, u.display_name AS creator_name,
              u.username AS creator_username, u.avatar_url AS creator_avatar
       FROM videos v JOIN users u ON u.id = v.creator_id
       WHERE v.id = $1 AND v.status = 'ready'`,
      [req.params.videoId]
    );
    const video = rows[0];
    if (!video) throw notFound("Video not found");
    // Fire-and-forget view count bump (never blocks the response).
    void query("UPDATE videos SET view_count = view_count + 1 WHERE id = $1", [
      req.params.videoId,
    ]).catch(() => undefined);
    ok(res, { video });
  })
);

// GET /api/videos/:videoId/products (public) — tagged products for playback.
router.get(
  "/:videoId/products",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT vp.product_id, vp.timestamp_seconds, vp.is_featured,
              p.title, p.thumbnail_url, p.base_price_cents
       FROM video_products vp JOIN products p ON p.id=vp.product_id
       WHERE vp.video_id=$1 ORDER BY vp.timestamp_seconds ASC`,
      [req.params.videoId]
    );
    ok(res, { products: rows });
  })
);

export default router;
