import { Router, type Router as ExpressRouter } from "express";
import { query } from "../config/database";
import { redisClient } from "../config/redis";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { badRequest, notFound } from "../middleware/errorHandler";
import type { AuthedRequest } from "../types";

const router: ExpressRouter = Router();
const key = (userId: string) => `cart:${userId}`;

interface StoredItem {
  productId: string;
  variantId?: string | null;
  title: string;
  priceCents: number;
  thumbnail?: string | null;
  quantity: number;
}

async function readCart(userId: string): Promise<StoredItem[]> {
  const hash = await redisClient.hgetall(key(userId));
  return Object.values(hash).map((v) => JSON.parse(v) as StoredItem);
}

router.use(authenticate);

// GET /api/cart
router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const items = await readCart(req.user!.id);
    const subtotalCents = items.reduce((n, i) => n + i.priceCents * i.quantity, 0);
    ok(res, { items, subtotalCents });
  })
);

// POST /api/cart/items { productId, quantity, variantId? }
router.post(
  "/items",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { productId, quantity, variantId } = req.body as { productId?: string; quantity?: number; variantId?: string };
    if (!productId) throw badRequest("productId required");
    const qty = Math.max(1, quantity ?? 1);

    const { rows } = await query<{ title: string; base_price_cents: number; thumbnail_url: string | null; status: string }>(
      "SELECT title, base_price_cents, thumbnail_url, status FROM products WHERE id = $1",
      [productId]
    );
    const p = rows[0];
    if (!p) throw notFound("Product not found");
    if (p.status !== "approved") throw badRequest("Product not available");

    const existing = await redisClient.hget(key(req.user!.id), productId);
    const prevQty = existing ? (JSON.parse(existing) as StoredItem).quantity : 0;
    const item: StoredItem = {
      productId, variantId: variantId ?? null, title: p.title,
      priceCents: p.base_price_cents, thumbnail: p.thumbnail_url, quantity: prevQty + qty,
    };
    await redisClient.hset(key(req.user!.id), productId, JSON.stringify(item));
    ok(res, { item }, 201);
  })
);

// PATCH /api/cart/items/:productId { quantity }
router.patch(
  "/items/:productId",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { quantity } = req.body as { quantity?: number };
    const raw = await redisClient.hget(key(req.user!.id), req.params.productId);
    if (!raw) throw notFound("Not in cart");
    const item = JSON.parse(raw) as StoredItem;
    item.quantity = Math.max(1, quantity ?? 1);
    await redisClient.hset(key(req.user!.id), req.params.productId, JSON.stringify(item));
    ok(res, { item });
  })
);

// DELETE /api/cart/items/:productId
router.delete(
  "/items/:productId",
  asyncHandler(async (req: AuthedRequest, res) => {
    await redisClient.hdel(key(req.user!.id), req.params.productId);
    ok(res, { success: true });
  })
);

// DELETE /api/cart  (clear)
router.delete(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    await redisClient.del(key(req.user!.id));
    ok(res, { success: true });
  })
);

export default router;
