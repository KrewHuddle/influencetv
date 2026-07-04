import { Router, type Router as ExpressRouter } from "express";
import { query, transaction } from "../config/database";
import { stripe, estimateStripeFee } from "../config/stripe";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { requirePlan } from "../middleware/requireRole";
import { clearUserCache } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { badRequest, forbidden } from "../middleware/errorHandler";
import { parsePagination, paginate } from "../utils/pagination";
import { env } from "../config/env";
import { sendEmail } from "../config/email";
import type { AuthedRequest } from "../types";

const router: ExpressRouter = Router();
const creatorOnly = requireRole("creator", "super_admin");
const MIN_PAYOUT_CENTS = 1000;

// POST /api/creators/apply (viewer_ultra → auto-approve to creator)
router.post(
  "/apply",
  authenticate,
  requirePlan("ultra"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { channelName, bio } = req.body as {
      channelName?: string;
      bio?: string;
    };
    await query(
      "UPDATE users SET role='creator', bio=COALESCE($1,bio) WHERE id=$2 AND role IN ('viewer_ultra','viewer_premium','viewer_free')",
      [bio ?? null, req.user!.id]
    );
    // Default creator community.
    await query(
      `INSERT INTO communities (type, entity_id, name, description)
       VALUES ('creator', $1, $2, 'Creator community')`,
      [req.user!.id, channelName ?? "My Community"]
    );
    await clearUserCache(req.user!.id);
    const u = await query<{ email: string; display_name: string }>(
      "SELECT email, display_name FROM users WHERE id=$1",
      [req.user!.id]
    );
    if (u.rows[0]) {
      await sendEmail(
        u.rows[0].email,
        "Welcome to Apex Creators",
        `<p>You're now a creator, ${u.rows[0].display_name ?? "there"}. Head to Creator Studio to upload.</p>`,
        "You're now an Apex creator."
      );
    }
    ok(res, { approved: true, creatorStudioUrl: `${env.FRONTEND_URL}/studio` }, 201);
  })
);

// GET /api/creators/studio — dashboard aggregates.
router.get(
  "/studio",
  authenticate,
  creatorOnly,
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = req.user!.id;
    const [today, recentVideos, patronBreakdown, community, pending] = await Promise.all([
      query<{ shop_revenue: string; new_patrons: string }>(
        `SELECT
           COALESCE(SUM(gross_cents) FILTER (WHERE source='shop' AND created_at::date=CURRENT_DATE),0) AS shop_revenue,
           0 AS new_patrons
         FROM creator_earnings WHERE creator_id=$1`,
        [id]
      ),
      query(
        `SELECT id, title, status, view_count, thumbnail_url, created_at
         FROM videos WHERE creator_id=$1 ORDER BY created_at DESC LIMIT 5`,
        [id]
      ),
      query(
        `SELECT t.name, t.subscriber_count FROM patron_tiers t
         WHERE t.creator_id=$1 AND t.is_active ORDER BY t.position`,
        [id]
      ),
      query<{ member_count: string; post_count: string }>(
        `SELECT COALESCE(SUM(member_count),0) AS member_count, COALESCE(SUM(post_count),0) AS post_count
         FROM communities WHERE entity_id=$1`,
        [id]
      ),
      query<{ pending: string }>(
        "SELECT COALESCE(SUM(net_cents),0) AS pending FROM creator_earnings WHERE creator_id=$1 AND NOT is_paid_out",
        [id]
      ),
    ]);

    ok(res, {
      today: {
        shopRevenueCents: Number(today.rows[0].shop_revenue),
        newPatrons: Number(today.rows[0].new_patrons),
        pendingPayoutCents: Number(pending.rows[0].pending),
      },
      recentVideos: recentVideos.rows,
      patronBreakdown: {
        totalPatrons: patronBreakdown.rows.reduce(
          (n, r) => n + Number((r as { subscriber_count: number }).subscriber_count),
          0
        ),
        byTier: patronBreakdown.rows,
      },
      community: {
        memberCount: Number(community.rows[0].member_count),
        postCount: Number(community.rows[0].post_count),
      },
      pendingEarningsCents: Number(pending.rows[0].pending),
    });
  })
);

// GET /api/creators/videos — creator's own videos.
router.get(
  "/videos",
  authenticate,
  creatorOnly,
  asyncHandler(async (req: AuthedRequest, res) => {
    const p = parsePagination(req.query);
    const [items, count] = await Promise.all([
      query(
        `SELECT id, title, status, type, view_count, duration_seconds, thumbnail_url, created_at, published_at
         FROM videos WHERE creator_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [req.user!.id, p.limit, p.offset]
      ),
      query<{ n: string }>("SELECT COUNT(*)::int AS n FROM videos WHERE creator_id=$1", [
        req.user!.id,
      ]),
    ]);
    ok(res, paginate(items.rows, Number(count.rows[0].n), p));
  })
);

async function ensureConnectAccount(userId: string, email: string): Promise<string> {
  const { rows } = await query<{ stripe_account_id: string | null }>(
    "SELECT stripe_account_id FROM users WHERE id = $1",
    [userId]
  );
  if (rows[0]?.stripe_account_id) return rows[0].stripe_account_id;

  // Stable Express Connect account (see DEVIATION note vs Accounts v2 in the prompt).
  const account = await stripe.accounts.create({
    type: "express",
    country: "US",
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { userId },
  });
  await query("UPDATE users SET stripe_account_id = $1 WHERE id = $2", [
    account.id,
    userId,
  ]);
  return account.id;
}

async function onboardingSession(accountId: string): Promise<string | null> {
  const session = await stripe.accountSessions.create({
    account: accountId,
    components: { account_onboarding: { enabled: true } },
  });
  return session.client_secret;
}

// POST /api/creators/connect/start
router.post(
  "/connect/start",
  authenticate,
  creatorOnly,
  asyncHandler(async (req: AuthedRequest, res) => {
    const accountId = await ensureConnectAccount(req.user!.id, req.user!.email);
    ok(res, { clientSecret: await onboardingSession(accountId) });
  })
);

// POST /api/creators/connect/refresh
router.post(
  "/connect/refresh",
  authenticate,
  creatorOnly,
  asyncHandler(async (req: AuthedRequest, res) => {
    const accountId = await ensureConnectAccount(req.user!.id, req.user!.email);
    ok(res, { clientSecret: await onboardingSession(accountId) });
  })
);

// GET /api/creators/connect/status
router.get(
  "/connect/status",
  authenticate,
  creatorOnly,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { rows } = await query<{ stripe_account_id: string | null }>(
      "SELECT stripe_account_id FROM users WHERE id = $1",
      [req.user!.id]
    );
    const accountId = rows[0]?.stripe_account_id;
    if (!accountId) {
      ok(res, { accountStatus: "none", chargesEnabled: false, payoutsEnabled: false });
      return;
    }
    const acct = await stripe.accounts.retrieve(accountId);
    const status = acct.charges_enabled && acct.payouts_enabled ? "verified" : "pending";
    await query("UPDATE users SET stripe_account_status = $1 WHERE id = $2", [
      status,
      req.user!.id,
    ]);
    ok(res, {
      accountStatus: status,
      chargesEnabled: acct.charges_enabled,
      payoutsEnabled: acct.payouts_enabled,
      pendingRequirements: acct.requirements?.currently_due ?? [],
    });
  })
);

// POST /api/creators/revenue/record (internal)
router.post(
  "/revenue/record",
  asyncHandler(async (req, res) => {
    const { creatorId, source, sourceId, grossCents, platformFeePercent } =
      req.body as {
        creatorId: string;
        source: string;
        sourceId?: string;
        grossCents: number;
        platformFeePercent: number;
      };
    if (!creatorId || !grossCents) throw badRequest("creatorId, grossCents required");
    const platformFee = Math.round(grossCents * (platformFeePercent / 100));
    const stripeFee = estimateStripeFee(grossCents);
    const net = grossCents - platformFee - stripeFee;
    await query(
      `INSERT INTO creator_earnings
         (creator_id, source, source_id, gross_cents, platform_fee_cents, stripe_fee_cents, net_cents)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [creatorId, source, sourceId ?? null, grossCents, platformFee, stripeFee, net]
    );
    ok(res, { net });
  })
);

// GET /api/creators/earnings
router.get(
  "/earnings",
  authenticate,
  creatorOnly,
  asyncHandler(async (req: AuthedRequest, res) => {
    const p = parsePagination(req.query);
    const creatorId =
      req.user!.role === "super_admin" && req.query.creatorId
        ? (req.query.creatorId as string)
        : req.user!.id;

    const [items, totals, count] = await Promise.all([
      query(
        `SELECT id, source, gross_cents, platform_fee_cents, stripe_fee_cents,
                net_cents, is_paid_out, created_at
         FROM creator_earnings WHERE creator_id = $1
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [creatorId, p.limit, p.offset]
      ),
      query<{ pending: string; lifetime: string }>(
        `SELECT COALESCE(SUM(net_cents) FILTER (WHERE NOT is_paid_out),0) AS pending,
                COALESCE(SUM(net_cents),0) AS lifetime
         FROM creator_earnings WHERE creator_id = $1`,
        [creatorId]
      ),
      query<{ n: string }>(
        "SELECT COUNT(*)::int AS n FROM creator_earnings WHERE creator_id = $1",
        [creatorId]
      ),
    ]);

    ok(res, {
      ...paginate(items.rows, Number(count.rows[0].n), p),
      pendingCents: Number(totals.rows[0].pending),
      lifetimeCents: Number(totals.rows[0].lifetime),
    });
  })
);

// POST /api/creators/payouts/request
router.post(
  "/payouts/request",
  authenticate,
  creatorOnly,
  asyncHandler(async (req: AuthedRequest, res) => {
    const u = await query<{ stripe_account_id: string | null; stripe_account_status: string | null }>(
      "SELECT stripe_account_id, stripe_account_status FROM users WHERE id = $1",
      [req.user!.id]
    );
    const account = u.rows[0];
    if (!account?.stripe_account_id || account.stripe_account_status !== "verified") {
      throw forbidden("Stripe account not verified");
    }

    const balance = await query<{ pending: string }>(
      "SELECT COALESCE(SUM(net_cents),0) AS pending FROM creator_earnings WHERE creator_id=$1 AND NOT is_paid_out",
      [req.user!.id]
    );
    const amount = Number(balance.rows[0].pending);
    if (amount < MIN_PAYOUT_CENTS) {
      throw badRequest("Minimum payout is $10", "PAYOUT_TOO_SMALL");
    }

    const transfer = await stripe.transfers.create({
      amount,
      currency: "usd",
      destination: account.stripe_account_id,
      metadata: { userId: req.user!.id },
    });

    const payoutId = await transaction(async (c) => {
      const p = await c.query<{ id: string }>(
        `INSERT INTO payouts (user_id, amount_cents, currency, stripe_transfer_id, stripe_account_id, status)
         VALUES ($1,$2,'usd',$3,$4,'processing') RETURNING id`,
        [req.user!.id, amount, transfer.id, account.stripe_account_id]
      );
      await c.query(
        "UPDATE creator_earnings SET is_paid_out=true, payout_id=$1 WHERE creator_id=$2 AND NOT is_paid_out",
        [p.rows[0].id, req.user!.id]
      );
      return p.rows[0].id;
    });

    ok(res, { payoutId, amount, estimatedArrival: "2-5 business days" });
  })
);

// GET /api/creators/:creatorId/tiers (public)
router.get(
  "/:creatorId/tiers",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT id, name, description, price_cents, perks, subscriber_count, position
       FROM patron_tiers WHERE creator_id=$1 AND is_active ORDER BY position`,
      [req.params.creatorId]
    );
    ok(res, { tiers: rows });
  })
);

// GET /api/creators/:creatorId/analytics (owner or admin)
router.get(
  "/:creatorId/analytics",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    const creatorId = req.params.creatorId;
    if (creatorId !== req.user!.id && req.user!.role !== "super_admin") {
      throw forbidden("Not your analytics");
    }
    const [topVideos, revenueBySource, subs] = await Promise.all([
      query(
        `SELECT id, title, view_count, like_count FROM videos
         WHERE creator_id=$1 ORDER BY view_count DESC LIMIT 10`,
        [creatorId]
      ),
      query(
        `SELECT source, COALESCE(SUM(net_cents),0) AS net FROM creator_earnings
         WHERE creator_id=$1 GROUP BY source`,
        [creatorId]
      ),
      query<{ total: string }>(
        "SELECT COUNT(*)::int AS total FROM patron_subscriptions WHERE creator_id=$1 AND status='active'",
        [creatorId]
      ),
    ]);
    ok(res, {
      topVideos: topVideos.rows,
      revenueBySource: revenueBySource.rows,
      activePatrons: Number(subs.rows[0].total),
    });
  })
);

export default router;
