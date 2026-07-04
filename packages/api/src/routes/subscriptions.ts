import { Router, type Router as ExpressRouter } from "express";
import { query } from "../config/database";
import { stripe, PLAN_PRICE } from "../config/stripe";
import { env } from "../config/env";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { badRequest } from "../middleware/errorHandler";
import type { AuthedRequest } from "../types";

const router: ExpressRouter = Router();

/** Get or create the Stripe customer for a user, persisting the id. */
async function getOrCreateCustomer(
  userId: string,
  email: string
): Promise<string> {
  const { rows } = await query<{ stripe_customer_id: string | null }>(
    "SELECT stripe_customer_id FROM users WHERE id = $1",
    [userId]
  );
  if (rows[0]?.stripe_customer_id) return rows[0].stripe_customer_id;

  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });
  await query("UPDATE users SET stripe_customer_id = $1 WHERE id = $2", [
    customer.id,
    userId,
  ]);
  return customer.id;
}

// POST /api/subscriptions/create-checkout
router.post(
  "/create-checkout",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    const plan = (req.body?.plan as string) ?? "premium";
    const priceId = PLAN_PRICE[plan];
    if (!priceId) throw badRequest("Unknown or unconfigured plan", "BAD_PLAN");

    const customerId = await getOrCreateCustomer(req.user!.id, req.user!.email);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${env.FRONTEND_URL}/account/subscription?success=true`,
      cancel_url: `${env.FRONTEND_URL}/plans`,
      metadata: { userId: req.user!.id, plan },
      subscription_data: { metadata: { userId: req.user!.id, plan } },
    });
    ok(res, { checkoutUrl: session.url });
  })
);

// GET /api/subscriptions/portal
router.get(
  "/portal",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    const customerId = await getOrCreateCustomer(req.user!.id, req.user!.email);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${env.FRONTEND_URL}/account/subscription`,
    });
    ok(res, { portalUrl: session.url });
  })
);

// GET /api/subscriptions/status
router.get(
  "/status",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { rows } = await query(
      `SELECT plan, status, current_period_end AS "currentPeriodEnd",
              cancel_at_period_end AS "cancelAtPeriodEnd"
       FROM subscriptions WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [req.user!.id]
    );
    ok(res, rows[0] ?? { plan: req.user!.plan, status: "none" });
  })
);

export default router;
