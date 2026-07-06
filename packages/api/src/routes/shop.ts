import { Router, type Router as ExpressRouter } from "express";
import { query, transaction } from "../config/database";
import { stripe, PLATFORM_FEE } from "../config/stripe";
import { authenticate } from "../middleware/auth";
import { requirePlan, requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { badRequest, forbidden, notFound } from "../middleware/errorHandler";
import { parsePagination, paginate } from "../utils/pagination";
import { sendEmail } from "../config/email";
import type { AuthedRequest } from "../types";

const router: ExpressRouter = Router();

interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

const sellerRoles = requireRole("seller", "creator", "super_admin");

// ─────────────────────── product management ───────────────────────

// POST /api/shop/products
router.post(
  "/products",
  authenticate,
  sellerRoles,
  asyncHandler(async (req: AuthedRequest, res) => {
    const b = req.body as {
      title: string; description?: string; category?: string; isDigital?: boolean;
      basePriceCents: number; compareAtPriceCents?: number; inventoryCount?: number;
      trackInventory?: boolean; imageUrls?: string[]; tags?: string[];
      weightGrams?: number; requiresShipping?: boolean;
      variants?: Array<{ name: string; sku?: string; priceCents?: number; inventoryCount?: number; option1Name?: string; option1Value?: string }>;
    };
    if (!b.title || !b.basePriceCents || b.basePriceCents <= 0) {
      throw badRequest("title and basePriceCents required");
    }
    if (!b.imageUrls || b.imageUrls.length === 0) {
      throw badRequest("At least one image required");
    }
    const imageUrls = b.imageUrls;
    // NOTE: NSFW moderation (nsfwjs, see services/moderation.ts) runs at
    // transcode time for videos. Product images arrive as CDN URLs, not local
    // bytes, so the check is deferred here — products enter 'pending' for review.

    const productId = await transaction(async (c) => {
      const p = await c.query<{ id: string }>(
        `INSERT INTO products
           (seller_id, title, description, category, is_digital, base_price_cents,
            compare_at_price_cents, inventory_count, track_inventory, thumbnail_url,
            image_urls, tags, weight_grams, requires_shipping, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending') RETURNING id`,
        [
          req.user!.id, b.title, b.description ?? null, b.category ?? null,
          b.isDigital ?? false, b.basePriceCents, b.compareAtPriceCents ?? null,
          b.inventoryCount ?? 0, b.trackInventory ?? true, imageUrls[0],
          imageUrls, b.tags ?? null, b.weightGrams ?? null,
          b.requiresShipping ?? !b.isDigital,
        ]
      );
      for (const v of b.variants ?? []) {
        await c.query(
          `INSERT INTO product_variants
             (product_id, name, sku, price_cents, inventory_count, option1_name, option1_value)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [p.rows[0].id, v.name, v.sku ?? null, v.priceCents ?? null, v.inventoryCount ?? 0, v.option1Name ?? null, v.option1Value ?? null]
        );
      }
      return p.rows[0].id;
    });
    ok(res, { product: { id: productId, status: "pending" } }, 201);
  })
);

// GET /api/shop/products (public — approved only)
router.get(
  "/products",
  asyncHandler(async (req, res) => {
    const p = parsePagination(req.query);
    const conds = ["status='approved'"];
    const params: unknown[] = [];
    if (req.query.sellerId) { params.push(req.query.sellerId); conds.push(`seller_id=$${params.length}`); }
    if (req.query.category) { params.push(req.query.category); conds.push(`category=$${params.length}`); }
    if (req.query.q) { params.push(`%${req.query.q}%`); conds.push(`title ILIKE $${params.length}`); }
    const where = conds.join(" AND ");
    const countParams = [...params];
    params.push(p.limit, p.offset);
    const items = await query(
      `SELECT id, title, thumbnail_url, base_price_cents, compare_at_price_cents, category
       FROM products WHERE ${where} ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const count = await query<{ n: string }>(
      `SELECT COUNT(*)::int AS n FROM products WHERE ${where}`,
      countParams
    );
    ok(res, paginate(items.rows, Number(count.rows[0].n), p));
  })
);

// GET /api/shop/products/:productId (public detail)
router.get(
  "/products/:productId",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT p.*, u.display_name AS seller_name
       FROM products p JOIN users u ON u.id=p.seller_id WHERE p.id=$1`,
      [req.params.productId]
    );
    if (!rows[0]) throw notFound("Product not found");
    const variants = await query(
      "SELECT id, name, sku, price_cents, inventory_count, option1_name, option1_value FROM product_variants WHERE product_id=$1",
      [req.params.productId]
    );
    ok(res, { product: rows[0], variants: variants.rows });
  })
);

// PATCH /api/shop/products/:productId (owner or admin)
router.patch(
  "/products/:productId",
  authenticate,
  sellerRoles,
  asyncHandler(async (req: AuthedRequest, res) => {
    const owner = await query<{ seller_id: string }>(
      "SELECT seller_id FROM products WHERE id=$1",
      [req.params.productId]
    );
    if (!owner.rows[0]) throw notFound("Product not found");
    if (owner.rows[0].seller_id !== req.user!.id && req.user!.role !== "super_admin") {
      throw forbidden("Not your product");
    }
    const b = req.body as {
      title?: string; description?: string; basePriceCents?: number;
      inventoryCount?: number; imageUrls?: string[]; tags?: string[];
    };
    // Re-review if title/images changed.
    const reReview = b.title != null || b.imageUrls != null;
    const { rows } = await query(
      `UPDATE products SET
         title=COALESCE($1,title), description=COALESCE($2,description),
         base_price_cents=COALESCE($3,base_price_cents),
         inventory_count=COALESCE($4,inventory_count),
         image_urls=COALESCE($5,image_urls), tags=COALESCE($6,tags),
         thumbnail_url=COALESCE($7,thumbnail_url),
         status=CASE WHEN $8 THEN 'pending' ELSE status END, updated_at=NOW()
       WHERE id=$9 RETURNING id, title, status`,
      [
        b.title ?? null, b.description ?? null, b.basePriceCents ?? null,
        b.inventoryCount ?? null, b.imageUrls ?? null, b.tags ?? null,
        b.imageUrls?.[0] ?? null, reReview, req.params.productId,
      ]
    );
    ok(res, { product: rows[0] });
  })
);

// DELETE /api/shop/products/:productId (soft delete → archived)
router.delete(
  "/products/:productId",
  authenticate,
  sellerRoles,
  asyncHandler(async (req: AuthedRequest, res) => {
    const owner = await query<{ seller_id: string }>(
      "SELECT seller_id FROM products WHERE id=$1",
      [req.params.productId]
    );
    if (!owner.rows[0]) throw notFound("Product not found");
    if (owner.rows[0].seller_id !== req.user!.id && req.user!.role !== "super_admin") {
      throw forbidden("Not your product");
    }
    await query("UPDATE products SET status='archived', updated_at=NOW() WHERE id=$1", [
      req.params.productId,
    ]);
    ok(res, { success: true });
  })
);

// GET /api/shop/sellers/:sellerId/storefront (public)
router.get(
  "/sellers/:sellerId/storefront",
  asyncHandler(async (req, res) => {
    const seller = await query(
      "SELECT display_name, bio, banner_url, avatar_url FROM users WHERE id=$1",
      [req.params.sellerId]
    );
    if (!seller.rows[0]) throw notFound("Seller not found");
    const products = await query(
      `SELECT id, title, thumbnail_url, base_price_cents, compare_at_price_cents
       FROM products WHERE seller_id=$1 AND status='approved' ORDER BY created_at DESC`,
      [req.params.sellerId]
    );
    const live = await redisClientLiveShop(req.params.sellerId);
    ok(res, { seller: seller.rows[0], products: products.rows, liveShopActive: live });
  })
);

async function redisClientLiveShop(sellerId: string): Promise<boolean> {
  const r = await query<{ n: string }>(
    "SELECT COUNT(*)::int AS n FROM live_shops WHERE host_id=$1 AND status='live'",
    [sellerId]
  );
  return Number(r.rows[0].n) > 0;
}

// GET /api/shop/search (public full-text)
router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const p = parsePagination(req.query);
    const q = (req.query.q as string) ?? "";
    const items = await query(
      `SELECT id, title, thumbnail_url, base_price_cents
       FROM products
       WHERE status='approved'
         AND ($1 = '' OR title ILIKE $2 OR description ILIKE $2
              OR EXISTS (SELECT 1 FROM unnest(COALESCE(tags,'{}')) tg WHERE tg ILIKE $2))
       ORDER BY sale_count DESC LIMIT $3 OFFSET $4`,
      [q, `%${q}%`, p.limit, p.offset]
    );
    ok(res, { items: items.rows });
  })
);

// POST /api/shop/checkout (premium or ultra)
router.post(
  "/checkout",
  authenticate,
  requirePlan("premium", "ultra"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { items, shippingAddress } = req.body as {
      items: CartItem[];
      shippingAddress?: unknown;
    };
    if (!Array.isArray(items) || items.length === 0) {
      throw badRequest("No items");
    }

    const ids = items.map((i) => i.productId);
    const { rows: products } = await query<{
      id: string;
      seller_id: string;
      base_price_cents: number;
      inventory_count: number;
      track_inventory: boolean;
      status: string;
    }>(
      `SELECT id, seller_id, base_price_cents, inventory_count, track_inventory, status
       FROM products WHERE id = ANY($1::uuid[])`,
      [ids]
    );
    if (products.length !== ids.length) throw badRequest("Some products not found");

    const sellerIds = new Set(products.map((p) => p.seller_id));
    if (sellerIds.size > 1) throw badRequest("All items must be from one seller");

    const sellerId = products[0].seller_id;
    const seller = await query<{ stripe_account_id: string | null }>(
      "SELECT stripe_account_id FROM users WHERE id = $1",
      [sellerId]
    );
    if (!seller.rows[0]?.stripe_account_id) {
      throw badRequest("Seller cannot accept payments yet");
    }

    let subtotal = 0;
    for (const item of items) {
      const p = products.find((x) => x.id === item.productId)!;
      if (p.status !== "approved") throw badRequest("Product unavailable");
      if (p.track_inventory && p.inventory_count < item.quantity) {
        throw badRequest("Insufficient inventory", "OUT_OF_STOCK");
      }
      subtotal += p.base_price_cents * item.quantity;
    }

    const platformFee = Math.round(subtotal * PLATFORM_FEE.shop);

    const orderId = await transaction(async (c) => {
      const o = await c.query<{ id: string }>(
        `INSERT INTO orders
           (buyer_id, seller_id, status, subtotal_cents, platform_fee_cents, shipping_address)
         VALUES ($1,$2,'pending',$3,$4,$5) RETURNING id`,
        [req.user!.id, sellerId, subtotal, platformFee, shippingAddress ? JSON.stringify(shippingAddress) : null]
      );
      for (const item of items) {
        const p = products.find((x) => x.id === item.productId)!;
        await c.query(
          `INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price_cents)
           VALUES ($1,$2,$3,$4,$5)`,
          [o.rows[0].id, item.productId, item.variantId ?? null, item.quantity, p.base_price_cents]
        );
      }
      return o.rows[0].id;
    });

    // Reserve inventory temporarily (confirmed on webhook).
    // (Redis reservation keys omitted for brevity; webhook is source of truth.)

    const pi = await stripe.paymentIntents.create({
      amount: subtotal,
      currency: "usd",
      application_fee_amount: platformFee,
      transfer_data: { destination: seller.rows[0].stripe_account_id },
      metadata: { orderId, buyerId: req.user!.id },
    });
    await query("UPDATE orders SET stripe_payment_intent_id=$1 WHERE id=$2", [
      pi.id,
      orderId,
    ]);

    ok(res, { clientSecret: pi.client_secret, orderId });
  })
);

// POST /api/shop/orders/:orderId/fulfill (seller or admin)
router.post(
  "/orders/:orderId/fulfill",
  authenticate,
  requireRole("seller", "creator", "super_admin"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { trackingNumber, carrier } = req.body as {
      trackingNumber: string;
      carrier: string;
    };
    const { rows } = await query<{ buyer_id: string; seller_id: string }>(
      "SELECT buyer_id, seller_id FROM orders WHERE id=$1",
      [req.params.orderId]
    );
    const order = rows[0];
    if (!order) throw notFound("Order not found");
    if (order.seller_id !== req.user!.id && req.user!.role !== "super_admin") {
      throw forbidden("Not your order");
    }

    await query(
      `UPDATE orders SET status='shipped', tracking_number=$1, shipping_carrier=$2,
         shipped_at=NOW(), updated_at=NOW() WHERE id=$3`,
      [trackingNumber, carrier, req.params.orderId]
    );
    const buyer = await query<{ email: string }>(
      "SELECT email FROM users WHERE id=$1",
      [order.buyer_id]
    );
    if (buyer.rows[0]) {
      await sendEmail(
        buyer.rows[0].email,
        "Your Apex order shipped",
        `<p>Your order is on its way. ${carrier} tracking: ${trackingNumber}</p>`,
        `Your Apex order shipped. ${carrier}: ${trackingNumber}`
      );
    }
    ok(res, { success: true });
  })
);

// GET /api/shop/orders (seller)
router.get(
  "/orders",
  authenticate,
  requireRole("seller", "creator", "super_admin"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const p = parsePagination(req.query);
    const statusFilter = req.query.status as string | undefined;
    const params: unknown[] = [req.user!.id];
    let where = "seller_id = $1";
    if (statusFilter) {
      params.push(statusFilter);
      where += ` AND status = $${params.length}::order_status`;
    }
    params.push(p.limit, p.offset);
    const items = await query(
      `SELECT id, order_number, buyer_id, status, subtotal_cents, tracking_number, created_at
       FROM orders WHERE ${where}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const count = await query<{ n: string }>(
      `SELECT COUNT(*)::int AS n FROM orders WHERE ${where}`,
      params.slice(0, statusFilter ? 2 : 1)
    );
    ok(res, paginate(items.rows, Number(count.rows[0].n), p));
  })
);

export default router;
