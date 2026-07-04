import { Router, type Router as ExpressRouter } from "express";
import { query } from "../config/database";
import { stripe, stripeEnabled, PLATFORM_FEE } from "../config/stripe";
import { env } from "../config/env";
import { authenticate } from "../middleware/auth";
import { requirePlan, requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { badRequest, forbidden } from "../middleware/errorHandler";
import type { AuthedRequest } from "../types";

const router: ExpressRouter = Router();
const MIN_TIER_CENTS = 199;
const MAX_TIERS = 3;

// POST /api/patrons/tiers (creator)
router.post(
  "/tiers",
  authenticate,
  requireRole("creator", "super_admin"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { name, description, priceCents, perks } = req.body as {
      name: string;
      description?: string;
      priceCents: number;
      perks?: string[];
    };
    if (!name || !priceCents) throw badRequest("name, priceCents required");
    if (priceCents < MIN_TIER_CENTS) throw badRequest("Minimum tier is $1.99");

    const count = await query<{ n: string }>(
      "SELECT COUNT(*)::int AS n FROM patron_tiers WHERE creator_id=$1 AND is_active",
      [req.user!.id]
    );
    if (Number(count.rows[0].n) >= MAX_TIERS) throw badRequest("Max 3 tiers");

    let priceId: string | null = null;
    if (stripeEnabled) {
      const price = await stripe.prices.create({
        unit_amount: priceCents,
        currency: "usd",
        recurring: { interval: "month" },
        product_data: { name: `Patron: ${name}` },
      });
      priceId = price.id;
    }

    const { rows } = await query(
      `INSERT INTO patron_tiers (creator_id, name, description, price_cents, stripe_price_id, perks, position)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,
         (SELECT COALESCE(MAX(position),0)+1 FROM patron_tiers WHERE creator_id=$1))
       RETURNING id, name, description, price_cents, perks, position`,
      [req.user!.id, name, description ?? null, priceCents, priceId, JSON.stringify(perks ?? [])]
    );
    ok(res, { tier: rows[0] }, 201);
  })
);

// PATCH /api/patrons/tiers/:tierId (owner) — name/description/perks only.
router.patch(
  "/tiers/:tierId",
  authenticate,
  requireRole("creator", "super_admin"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const owner = await query<{ creator_id: string }>(
      "SELECT creator_id FROM patron_tiers WHERE id=$1",
      [req.params.tierId]
    );
    if (!owner.rows[0]) throw badRequest("Tier not found");
    if (owner.rows[0].creator_id !== req.user!.id && req.user!.role !== "super_admin") {
      throw forbidden("Not your tier");
    }
    const { name, description, perks } = req.body as {
      name?: string;
      description?: string;
      perks?: string[];
    };
    const { rows } = await query(
      `UPDATE patron_tiers SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         perks = COALESCE($3::jsonb, perks),
         updated_at = NOW()
       WHERE id=$4 RETURNING id, name, description, price_cents, perks, position`,
      [name ?? null, description ?? null, perks ? JSON.stringify(perks) : null, req.params.tierId]
    );
    ok(res, { tier: rows[0] });
  })
);

// POST /api/patrons/subscribe (premium or ultra)
router.post(
  "/subscribe",
  authenticate,
  requirePlan("premium", "ultra"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { tierId } = req.body as { tierId: string };
    if (!tierId) throw badRequest("tierId required");

    const { rows } = await query<{
      creator_id: string;
      stripe_price_id: string | null;
      stripe_account_id: string | null;
      price_cents: number;
    }>(
      `SELECT t.creator_id, t.stripe_price_id, t.price_cents, u.stripe_account_id
       FROM patron_tiers t JOIN users u ON u.id = t.creator_id
       WHERE t.id = $1 AND t.is_active = true`,
      [tierId]
    );
    const tier = rows[0];
    if (!tier) throw badRequest("Tier not found");
    if (!tier.stripe_price_id) throw badRequest("Tier not configured");
    if (!tier.stripe_account_id) throw badRequest("Creator cannot accept payments yet");
    if (tier.creator_id === req.user!.id) throw badRequest("Cannot patron yourself");

    const applicationFee = Math.round(tier.price_cents * PLATFORM_FEE.patron);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: tier.stripe_price_id, quantity: 1 }],
      success_url: `${env.FRONTEND_URL}/creator?patron=success`,
      cancel_url: `${env.FRONTEND_URL}/plans`,
      subscription_data: {
        application_fee_percent: PLATFORM_FEE.patron * 100,
        transfer_data: { destination: tier.stripe_account_id },
        metadata: {
          creatorId: tier.creator_id,
          tierId,
          fanId: req.user!.id,
        },
      },
      metadata: { creatorId: tier.creator_id, tierId, fanId: req.user!.id },
    });
    void applicationFee;
    ok(res, { checkoutUrl: session.url });
  })
);

// GET /api/patrons/my-creators
router.get(
  "/my-creators",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { rows } = await query(
      `SELECT ps.creator_id, ps.status, ps.current_period_end,
              u.display_name, u.username, u.avatar_url,
              t.name AS tier_name, t.price_cents
       FROM patron_subscriptions ps
       JOIN users u ON u.id = ps.creator_id
       JOIN patron_tiers t ON t.id = ps.tier_id
       WHERE ps.fan_id = $1 AND ps.status = 'active'`,
      [req.user!.id]
    );
    ok(res, { creators: rows });
  })
);

export default router;
