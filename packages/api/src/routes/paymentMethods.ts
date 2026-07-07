import { Router, type Router as ExpressRouter } from "express";
import { query } from "../config/database";
import { stripe, stripeEnabled } from "../config/stripe";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { badRequest } from "../middleware/errorHandler";
import type { AuthedRequest } from "../types";

const router: ExpressRouter = Router();

async function getOrCreateCustomer(userId: string): Promise<string> {
  const { rows } = await query<{ stripe_customer_id: string | null; email: string; display_name: string | null }>(
    "SELECT stripe_customer_id, email, display_name FROM users WHERE id=$1",
    [userId]
  );
  const u = rows[0];
  if (u?.stripe_customer_id) return u.stripe_customer_id;
  const customer = await stripe.customers.create({
    email: u?.email,
    name: u?.display_name ?? undefined,
    metadata: { userId },
  });
  await query("UPDATE users SET stripe_customer_id=$2 WHERE id=$1", [userId, customer.id]);
  return customer.id;
}

// GET /api/account/payment-methods
router.get(
  "/",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!stripeEnabled) {
      ok(res, { paymentMethods: [], defaultId: null, stripeEnabled: false });
      return;
    }
    const { rows } = await query<{ stripe_customer_id: string | null; default_payment_method_id: string | null }>(
      "SELECT stripe_customer_id, default_payment_method_id FROM users WHERE id=$1",
      [req.user!.id]
    );
    const cid = rows[0]?.stripe_customer_id;
    if (!cid) {
      ok(res, { paymentMethods: [], defaultId: null, stripeEnabled: true });
      return;
    }
    const list = await stripe.paymentMethods.list({ customer: cid, type: "card" });
    ok(res, {
      stripeEnabled: true,
      defaultId: rows[0]?.default_payment_method_id ?? null,
      paymentMethods: list.data.map((pm) => ({
        id: pm.id,
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        expMonth: pm.card?.exp_month,
        expYear: pm.card?.exp_year,
      })),
    });
  })
);

// POST /api/account/payment-methods → SetupIntent
router.post(
  "/",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!stripeEnabled) throw badRequest("Payments are not configured");
    const cid = await getOrCreateCustomer(req.user!.id);
    const si = await stripe.setupIntents.create({
      customer: cid,
      payment_method_types: ["card"],
    });
    ok(res, { clientSecret: si.client_secret });
  })
);

// DELETE /api/account/payment-methods/:id
router.delete(
  "/:id",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!stripeEnabled) throw badRequest("Payments are not configured");
    await stripe.paymentMethods.detach(req.params.id);
    await query(
      "UPDATE users SET default_payment_method_id=NULL WHERE id=$1 AND default_payment_method_id=$2",
      [req.user!.id, req.params.id]
    );
    ok(res, { removed: true });
  })
);

// POST /api/account/payment-methods/:id/default
router.post(
  "/:id/default",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!stripeEnabled) throw badRequest("Payments are not configured");
    const cid = await getOrCreateCustomer(req.user!.id);
    await stripe.customers.update(cid, {
      invoice_settings: { default_payment_method: req.params.id },
    });
    await query("UPDATE users SET default_payment_method_id=$2 WHERE id=$1", [
      req.user!.id,
      req.params.id,
    ]);
    ok(res, { default: req.params.id });
  })
);

export default router;
