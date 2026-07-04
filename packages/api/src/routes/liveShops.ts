import { Router, type Router as ExpressRouter } from "express";
import { query } from "../config/database";
import { redisClient } from "../config/redis";
import { scheduleFlashSale } from "../config/queue";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { badRequest, forbidden, notFound } from "../middleware/errorHandler";
import { getIo, rooms } from "../sockets";
import type { AuthedRequest } from "../types";

const router: ExpressRouter = Router();
const hostRoles = requireRole("seller", "creator", "super_admin");
const PIN_TTL = 300;

async function loadHost(id: string): Promise<{ host_id: string; channel_id: string | null } | null> {
  const { rows } = await query<{ host_id: string; channel_id: string | null }>(
    "SELECT host_id, channel_id FROM live_shops WHERE id=$1",
    [id]
  );
  return rows[0] ?? null;
}

// POST /api/live-shops
router.post(
  "/live-shops",
  authenticate,
  hostRoles,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { channelId, title, startsAt } = req.body as {
      channelId?: string; title: string; startsAt?: string;
    };
    if (!title) throw badRequest("title required");
    const { rows } = await query<{ id: string }>(
      `INSERT INTO live_shops (channel_id, host_id, title, starts_at)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [channelId ?? null, req.user!.id, title, startsAt ?? null]
    );
    ok(res, { liveShopId: rows[0].id }, 201);
  })
);

// POST /api/live-shops/:id/start
router.post(
  "/live-shops/:id/start",
  authenticate,
  hostRoles,
  asyncHandler(async (req: AuthedRequest, res) => {
    const shop = await loadHost(req.params.id);
    if (!shop) throw notFound("Live shop not found");
    if (shop.host_id !== req.user!.id && req.user!.role !== "super_admin") throw forbidden("Not host");
    await query("UPDATE live_shops SET status='live' WHERE id=$1", [req.params.id]);
    if (shop.channel_id) {
      await redisClient.set(`liveshop:active:${shop.channel_id}`, req.params.id, "EX", 7200);
      try {
        getIo().to(rooms.channel(shop.channel_id)).emit("live-shop-started", { liveShopId: req.params.id });
      } catch { /* socket optional */ }
    }
    ok(res, { success: true });
  })
);

// POST /api/live-shops/:id/end
router.post(
  "/live-shops/:id/end",
  authenticate,
  hostRoles,
  asyncHandler(async (req: AuthedRequest, res) => {
    const shop = await loadHost(req.params.id);
    if (!shop) throw notFound("Live shop not found");
    if (shop.host_id !== req.user!.id && req.user!.role !== "super_admin") throw forbidden("Not host");
    await query("UPDATE live_shops SET status='ended', ended_at=NOW() WHERE id=$1", [req.params.id]);
    if (shop.channel_id) {
      await redisClient.del(`liveshop:active:${shop.channel_id}`);
      await redisClient.del(`pinnedproduct:${shop.channel_id}`);
      try {
        getIo().to(rooms.channel(shop.channel_id)).emit("live-shop-ended", { liveShopId: req.params.id });
      } catch { /* socket optional */ }
    }
    ok(res, { success: true });
  })
);

// POST /api/live-shops/:id/pin-product
router.post(
  "/live-shops/:id/pin-product",
  authenticate,
  hostRoles,
  asyncHandler(async (req: AuthedRequest, res) => {
    const shop = await loadHost(req.params.id);
    if (!shop) throw notFound("Live shop not found");
    if (shop.host_id !== req.user!.id && req.user!.role !== "super_admin") throw forbidden("Not host");
    if (!shop.channel_id) throw badRequest("Live shop has no channel");

    const { productId } = req.body as { productId: string; variantId?: string };
    const { rows } = await query<{
      id: string; title: string; base_price_cents: number;
      compare_at_price_cents: number | null; thumbnail_url: string | null; inventory_count: number;
    }>(
      "SELECT id, title, base_price_cents, compare_at_price_cents, thumbnail_url, inventory_count FROM products WHERE id=$1",
      [productId]
    );
    const product = rows[0];
    if (!product) throw notFound("Product not found");

    const payload = {
      productId: product.id,
      title: product.title,
      price: product.base_price_cents,
      compareAtPrice: product.compare_at_price_cents,
      thumbnail: product.thumbnail_url,
      inventory: product.inventory_count,
      liveShopId: req.params.id,
    };
    await redisClient.set(`pinnedproduct:${shop.channel_id}`, JSON.stringify(payload), "EX", PIN_TTL);
    try {
      getIo().to(rooms.channel(shop.channel_id)).emit("product-pinned", payload);
    } catch { /* socket optional */ }
    ok(res, { pinned: true });
  })
);

// POST /api/live-shops/:id/unpin
router.post(
  "/live-shops/:id/unpin",
  authenticate,
  hostRoles,
  asyncHandler(async (req: AuthedRequest, res) => {
    const shop = await loadHost(req.params.id);
    if (!shop) throw notFound("Live shop not found");
    if (shop.channel_id) {
      await redisClient.del(`pinnedproduct:${shop.channel_id}`);
      try {
        getIo().to(rooms.channel(shop.channel_id)).emit("product-unpinned", {});
      } catch { /* socket optional */ }
    }
    ok(res, { unpinned: true });
  })
);

// GET /api/channels/:channelId/pinned-product (public)
router.get(
  "/channels/:channelId/pinned-product",
  asyncHandler(async (req, res) => {
    const cached = await redisClient.get(`pinnedproduct:${req.params.channelId}`);
    ok(res, { product: cached ? JSON.parse(cached) : null });
  })
);

// ─────────────────────── flash sales ───────────────────────

// POST /api/flash-sales
router.post(
  "/flash-sales",
  authenticate,
  hostRoles,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { productId, liveShopId, salePriceCents, startsAt, endsAt, maxUnits } =
      req.body as {
        productId: string; liveShopId?: string; salePriceCents: number;
        startsAt: string; endsAt: string; maxUnits?: number;
      };
    if (!productId || !salePriceCents || !startsAt || !endsAt) {
      throw badRequest("productId, salePriceCents, startsAt, endsAt required");
    }
    const product = await query<{ base_price_cents: number; channel_id: string | null }>(
      `SELECT p.base_price_cents,
              (SELECT channel_id FROM live_shops WHERE id=$2) AS channel_id
       FROM products p WHERE p.id=$1`,
      [productId, liveShopId ?? null]
    );
    if (!product.rows[0]) throw notFound("Product not found");
    if (salePriceCents >= product.rows[0].base_price_cents) {
      throw badRequest("Sale price must be below base price");
    }
    const start = new Date(startsAt).getTime();
    const end = new Date(endsAt).getTime();
    if (end - start > 60 * 60 * 1000) throw badRequest("Flash sale max duration is 60 minutes");

    const { rows } = await query<{ id: string }>(
      `INSERT INTO flash_sales (product_id, live_shop_id, sale_price_cents, starts_at, ends_at, max_units)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [productId, liveShopId ?? null, salePriceCents, startsAt, endsAt, maxUnits ?? null]
    );
    await scheduleFlashSale(
      rows[0].id,
      product.rows[0].channel_id,
      start - Date.now(),
      end - Date.now()
    );
    ok(res, { flashSaleId: rows[0].id }, 201);
  })
);

// GET /api/channels/:channelId/flash-sale (public)
router.get(
  "/channels/:channelId/flash-sale",
  asyncHandler(async (req, res) => {
    const saleId = await redisClient.get(`flashsale:active:${req.params.channelId}`);
    if (!saleId) {
      ok(res, { sale: null });
      return;
    }
    const { rows } = await query(
      "SELECT id, product_id, sale_price_cents, starts_at, ends_at, max_units FROM flash_sales WHERE id=$1",
      [saleId]
    );
    const unitsRemaining = await redisClient.get(`flashsale:inventory:${saleId}`);
    ok(res, {
      sale: rows[0] ?? null,
      unitsRemaining: unitsRemaining != null ? Number(unitsRemaining) : null,
    });
  })
);

export default router;
