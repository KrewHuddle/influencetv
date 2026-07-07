import { Router, type Router as ExpressRouter } from "express";
import { query } from "../config/database";
import { redisClient } from "../config/redis";
import { stripeEnabled } from "../config/stripe";
import { authenticate } from "../middleware/auth";
import { requirePlan } from "../middleware/requireRole";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { badRequest, forbidden, notFound } from "../middleware/errorHandler";
import { parsePagination, paginate } from "../utils/pagination";
import type { AuthedRequest } from "../types";
import { placeBid, startAuction, cancelAuction } from "../services/HaggleEngine";
import { awardPoints } from "../services/PointsEngine";

const router: ExpressRouter = Router();

/** Load an auction row or 404. */
async function loadAuction(id: string) {
  const { rows } = await query<Record<string, unknown>>(
    "SELECT * FROM haggle_auctions WHERE id=$1",
    [id]
  );
  if (!rows[0]) throw notFound("Auction not found");
  return rows[0] as {
    id: string;
    seller_id: string;
    channel_id: string | null;
    bid_increment_cents: number;
    status: string;
  };
}

async function hasSavedCard(userId: string): Promise<boolean> {
  const { rows } = await query<{ c: string | null; pm: string | null }>(
    "SELECT stripe_customer_id AS c, default_payment_method_id AS pm FROM users WHERE id=$1",
    [userId]
  );
  return Boolean(rows[0]?.c && rows[0]?.pm);
}

// ───────────────────────── POST /auctions (seller/creator) ─────────────────────────
router.post(
  "/auctions",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    const {
      productId,
      channelId,
      liveShopId,
      startingBidCents = 100,
      reservePriceCents,
      durationSeconds = 60,
      bidIncrementCents = 100,
      autoExtend = true,
    } = req.body as Record<string, number | string | boolean | undefined>;

    if (!productId) throw badRequest("productId required");
    if (Number(startingBidCents) < 100) throw badRequest("startingBidCents must be >= 100");
    if (Number(durationSeconds) < 30 || Number(durationSeconds) > 300)
      throw badRequest("durationSeconds must be 30-300");

    const prod = await query<{ seller_id: string; status: string; title: string }>(
      "SELECT seller_id, status, title FROM products WHERE id=$1",
      [productId]
    );
    const p = prod.rows[0];
    if (!p) throw notFound("Product not found");
    if (p.seller_id !== req.user!.id && req.user!.role !== "super_admin")
      throw forbidden("Not your product");
    if (p.status !== "approved") throw badRequest("Product must be approved");

    const { rows } = await query(
      `INSERT INTO haggle_auctions
         (seller_id, product_id, channel_id, live_shop_id, title, starting_bid_cents,
          reserve_price_cents, bid_increment_cents, duration_seconds, auto_extend, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'scheduled')
       RETURNING *`,
      [
        req.user!.id,
        productId,
        channelId ?? null,
        liveShopId ?? null,
        p.title,
        Number(startingBidCents),
        reservePriceCents != null ? Number(reservePriceCents) : null,
        Number(bidIncrementCents),
        Number(durationSeconds),
        Boolean(autoExtend),
      ]
    );
    ok(res, { auction: rows[0] }, 201);
  })
);

// ───────────────────────── POST /auctions/:id/start (owner) ─────────────────────────
router.post(
  "/auctions/:id/start",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    const a = await loadAuction(req.params.id);
    if (a.seller_id !== req.user!.id && req.user!.role !== "super_admin")
      throw forbidden("Not your auction");
    const { endsAt } = await startAuction(a.id);
    const { rows } = await query("SELECT * FROM haggle_auctions WHERE id=$1", [a.id]);
    ok(res, { auction: rows[0], endsAt });
  })
);

// ───────────────────────── POST /auctions/:id/bid (premium+) ─────────────────────────
router.post(
  "/auctions/:id/bid",
  authenticate,
  requirePlan("premium"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { amountCents, maxAmountCents } = req.body as {
      amountCents: number;
      maxAmountCents?: number;
    };
    if (!amountCents || amountCents < 1) throw badRequest("amountCents required");
    // Only enforce a saved card when Stripe is actually configured.
    if (stripeEnabled && !(await hasSavedCard(req.user!.id))) {
      ok(res, { requiresPaymentMethod: true }, 402);
      return;
    }
    const result = await placeBid(
      req.params.id,
      req.user!.id,
      Number(amountCents),
      maxAmountCents != null ? Number(maxAmountCents) : undefined
    );
    ok(res, { result });
  })
);

// ───────────────────────── POST /auctions/:id/proxy-bid ─────────────────────────
router.post(
  "/auctions/:id/proxy-bid",
  authenticate,
  requirePlan("premium"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { maxAmountCents } = req.body as { maxAmountCents: number };
    const a = await loadAuction(req.params.id);
    const hash = await redisClient.hgetall(`haggle:auction:${a.id}`);
    const currentBid = Number(hash.currentBid) || 0;
    const increment = Number(hash.increment) || a.bid_increment_cents;
    if (!maxAmountCents || maxAmountCents < currentBid + increment)
      throw badRequest("maxAmountCents must exceed current bid + increment");
    if (stripeEnabled && !(await hasSavedCard(req.user!.id))) {
      ok(res, { requiresPaymentMethod: true }, 402);
      return;
    }
    await redisClient.zadd(`haggle:proxy:${a.id}`, String(maxAmountCents), req.user!.id);
    const bidCount = Number(hash.bidCount) || 0;
    const first = bidCount === 0 ? Number(hash.startingBid) || increment : currentBid + increment;
    const result = await placeBid(a.id, req.user!.id, first, Number(maxAmountCents));
    ok(res, { proxySet: true, result });
  })
);

// ───────────────────────── POST /auctions/:id/extend (owner/admin) ─────────────────────────
router.post(
  "/auctions/:id/extend",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    const a = await loadAuction(req.params.id);
    if (a.seller_id !== req.user!.id && req.user!.role !== "super_admin")
      throw forbidden("Not your auction");
    const key = `haggle:auction:${a.id}`;
    const cur = Number(await redisClient.hget(key, "endsAt")) || Date.now();
    const newEndsAt = cur + 30_000;
    await redisClient.hset(key, "endsAt", newEndsAt);
    await query("UPDATE haggle_auctions SET ends_at=to_timestamp($2/1000.0) WHERE id=$1", [
      a.id,
      newEndsAt,
    ]);
    if (a.channel_id) {
      await redisClient.publish(
        "haggle:events",
        JSON.stringify({
          room: `channel:${a.channel_id}`,
          event: "haggle-extended",
          payload: { auctionId: a.id, newEndsAt, reason: "manual" },
        })
      );
    }
    ok(res, { newEndsAt });
  })
);

// ───────────────────────── POST /auctions/:id/cancel (owner/admin) ─────────────────────────
router.post(
  "/auctions/:id/cancel",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    const a = await loadAuction(req.params.id);
    if (a.seller_id !== req.user!.id && req.user!.role !== "super_admin")
      throw forbidden("Not your auction");
    await cancelAuction(a.id, (req.body?.reason as string) ?? "cancelled");
    ok(res, { cancelled: true });
  })
);

// ───────────────────────── POST /auctions/:id/watch ─────────────────────────
router.post(
  "/auctions/:id/watch",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    await query(
      `INSERT INTO haggle_watchlist (user_id, auction_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
      [req.user!.id, req.params.id]
    );
    await redisClient.sadd(`haggle:watchlist:${req.user!.id}`, req.params.id);
    await awardPoints(req.user!.id, "haggle_watch", { auctionId: req.params.id }).catch(() => {});
    ok(res, { watching: true });
  })
);

// ───────────────────────── GET /auctions/:id ─────────────────────────
router.get(
  "/auctions/:id",
  asyncHandler(async (req, res) => {
    const { rows } = await query("SELECT * FROM haggle_auctions WHERE id=$1", [req.params.id]);
    const db = rows[0];
    if (!db) throw notFound("Auction not found");
    const live = await redisClient.hgetall(`haggle:auction:${req.params.id}`);
    const bids = await query(
      `SELECT b.amount_cents, b.is_proxy, b.placed_at, u.username, u.display_name
       FROM haggle_bids b JOIN users u ON u.id=b.bidder_id
       WHERE b.auction_id=$1 ORDER BY b.placed_at DESC LIMIT 10`,
      [req.params.id]
    );
    ok(res, {
      auction: db,
      live: Object.keys(live).length ? live : null,
      bids: bids.rows,
    });
  })
);

// ───────────────────────── GET /auctions/:id/bids ─────────────────────────
router.get(
  "/auctions/:id/bids",
  asyncHandler(async (req, res) => {
    const p = parsePagination(req.query);
    const items = await query(
      `SELECT b.amount_cents, b.is_proxy, b.status, b.placed_at, u.username, u.display_name
       FROM haggle_bids b JOIN users u ON u.id=b.bidder_id
       WHERE b.auction_id=$1 ORDER BY b.placed_at DESC LIMIT $2 OFFSET $3`,
      [req.params.id, p.limit, p.offset]
    );
    const count = await query<{ n: string }>(
      "SELECT COUNT(*)::int AS n FROM haggle_bids WHERE auction_id=$1",
      [req.params.id]
    );
    ok(res, paginate(items.rows, Number(count.rows[0].n), p));
  })
);

// ───────────────────────── GET /my-bids ─────────────────────────
router.get(
  "/my-bids",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    const bids = await query(
      `SELECT DISTINCT ON (b.auction_id) b.auction_id, b.amount_cents, b.status, b.placed_at,
              a.title, a.status AS auction_status, a.final_price_cents, a.current_winner_id
       FROM haggle_bids b JOIN haggle_auctions a ON a.id=b.auction_id
       WHERE b.bidder_id=$1 ORDER BY b.auction_id, b.placed_at DESC`,
      [req.user!.id]
    );
    const won = bids.rows.filter(
      (r: Record<string, unknown>) => r.current_winner_id === req.user!.id && r.auction_status === "sold"
    );
    ok(res, { bids: bids.rows, won });
  })
);

// ───────────────────────── GET /seller/auctions ─────────────────────────
router.get(
  "/seller/auctions",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { rows } = await query(
      `SELECT a.*, p.title AS product_title, p.thumbnail_url,
              (SELECT COUNT(*)::int FROM haggle_bids b WHERE b.auction_id=a.id) AS bid_count
       FROM haggle_auctions a JOIN products p ON p.id=a.product_id
       WHERE a.seller_id=$1 ORDER BY a.created_at DESC`,
      [req.user!.id]
    );
    const gmv = rows.reduce(
      (n: number, r: Record<string, unknown>) => n + (Number(r.final_price_cents) || 0),
      0
    );
    ok(res, { auctions: rows, gmvCents: gmv });
  })
);

// ───────────────────────── GET /browse?status= ─────────────────────────
router.get(
  "/browse",
  asyncHandler(async (req, res) => {
    const p = parsePagination(req.query);
    const status = String(req.query.status ?? "live");
    let where = "a.status='live'";
    if (status === "upcoming") where = "a.status='scheduled'";
    else if (status === "ended") where = "a.status IN ('sold','unsold','cancelled','payment_failed')";
    const items = await query(
      `SELECT a.id, a.title, a.status, a.current_bid_cents, a.final_price_cents, a.ends_at,
              a.channel_id, a.scheduled_for, p.thumbnail_url, p.title AS product_title,
              (SELECT COUNT(*)::int FROM haggle_bids b WHERE b.auction_id=a.id) AS bid_count
       FROM haggle_auctions a JOIN products p ON p.id=a.product_id
       WHERE ${where} ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`,
      [p.limit, p.offset]
    );
    const count = await query<{ n: string }>(
      `SELECT COUNT(*)::int AS n FROM haggle_auctions a WHERE ${where}`,
      []
    );
    ok(res, paginate(items.rows, Number(count.rows[0].n), p));
  })
);

export default router;
