import express, { Router, type Router as ExpressRouter } from "express";
import type Stripe from "stripe";
import { stripe } from "../config/stripe";
import { env } from "../config/env";
import { query, transaction } from "../config/database";
import { redisClient } from "../config/redis";
import { clearUserCache } from "../middleware/auth";
import { sendEmail, welcomeEmail } from "../config/email";
import { estimateStripeFee, PLATFORM_FEE } from "../config/stripe";
import { getIo, rooms } from "../sockets";

const router: ExpressRouter = Router();

async function alreadyProcessed(eventId: string): Promise<boolean> {
  // SET NX with TTL → idempotency guard (safe to receive duplicates).
  const set = await redisClient.set(`stripe:evt:${eventId}`, "1", "EX", 86400, "NX");
  return set === null;
}

async function audit(action: string, targetId: string | null, data: unknown): Promise<void> {
  await query(
    `INSERT INTO audit_log (action, target_type, target_id, new_values)
     VALUES ($1,'stripe',$2,$3)`,
    [action, targetId, JSON.stringify(data)]
  ).catch(() => undefined);
}

// ─── subscription (platform plan) helpers ───
async function upsertSubscription(sub: Stripe.Subscription, userId: string, plan: string): Promise<void> {
  await transaction(async (c) => {
    await c.query(
      `INSERT INTO subscriptions
         (user_id, plan, stripe_subscription_id, stripe_price_id, status,
          current_period_start, current_period_end, cancel_at_period_end)
       VALUES ($1,$2,$3,$4,$5,to_timestamp($6),to_timestamp($7),$8)
       ON CONFLICT (stripe_subscription_id) DO UPDATE SET
         status = EXCLUDED.status,
         current_period_end = EXCLUDED.current_period_end,
         cancel_at_period_end = EXCLUDED.cancel_at_period_end,
         plan = EXCLUDED.plan, updated_at = NOW()`,
      [
        userId, plan, sub.id, sub.items.data[0]?.price.id ?? null, sub.status,
        sub.current_period_start, sub.current_period_end, sub.cancel_at_period_end,
      ]
    );
    await c.query(
      "UPDATE users SET subscription_plan = $1::subscription_plan WHERE id = $2",
      [plan, userId]
    );
  });
  await clearUserCache(userId);
}

async function recordPatronEarning(sub: Stripe.Subscription, invoice: Stripe.Invoice): Promise<void> {
  const creatorId = sub.metadata.creatorId;
  const tierId = sub.metadata.tierId;
  const fanId = sub.metadata.fanId;
  if (!creatorId || !tierId || !fanId) return;
  const gross = invoice.amount_paid;
  const platformFee = Math.round(gross * PLATFORM_FEE.patron);
  const stripeFee = estimateStripeFee(gross);
  await transaction(async (c) => {
    await c.query(
      `INSERT INTO patron_subscriptions
         (fan_id, creator_id, tier_id, stripe_subscription_id, status, current_period_end)
       VALUES ($1,$2,$3,$4,'active',to_timestamp($5))
       ON CONFLICT (fan_id, creator_id) DO UPDATE SET
         status='active', tier_id=EXCLUDED.tier_id,
         current_period_end=EXCLUDED.current_period_end, updated_at=NOW()`,
      [fanId, creatorId, tierId, sub.id, sub.current_period_end]
    );
    await c.query(
      `INSERT INTO creator_earnings
         (creator_id, source, source_id, gross_cents, platform_fee_cents, stripe_fee_cents, net_cents)
       VALUES ($1,'patron',$2,$3,$4,$5,$6)`,
      [creatorId, sub.id, gross, platformFee, stripeFee, gross - platformFee - stripeFee]
    );
    await c.query(
      "UPDATE patron_tiers SET subscriber_count = subscriber_count + 1 WHERE id = $1",
      [tierId]
    );
  });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription" || !session.subscription) break;
      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      // Patron checkouts carry creatorId/tierId/fanId; plan checkouts carry userId/plan.
      if (sub.metadata.creatorId) break; // handled on invoice.paid
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan ?? "premium";
      if (!userId) break;
      const first = await query(
        "SELECT 1 FROM subscriptions WHERE user_id = $1 LIMIT 1",
        [userId]
      );
      await upsertSubscription(sub, userId, plan);
      if (first.rowCount === 0) {
        const u = await query<{ email: string; display_name: string }>(
          "SELECT email, display_name FROM users WHERE id = $1",
          [userId]
        );
        if (u.rows[0]) {
          const m = welcomeEmail(u.rows[0].display_name ?? "there");
          await sendEmail(u.rows[0].email, m.subject, m.html, m.text);
        }
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      if (!invoice.subscription) break;
      const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
      if (sub.metadata.creatorId) {
        await recordPatronEarning(sub, invoice);
        break;
      }
      const userId = sub.metadata.userId;
      if (userId) {
        await query(
          `INSERT INTO invoices
             (user_id, stripe_invoice_id, stripe_payment_intent_id, amount_total, amount_paid, status, invoice_url, paid_at)
           VALUES ($1,$2,$3,$4,$5,'paid',$6,NOW())
           ON CONFLICT (stripe_invoice_id) DO NOTHING`,
          [
            userId, invoice.id, invoice.payment_intent as string | null,
            invoice.amount_due, invoice.amount_paid, invoice.hosted_invoice_url,
          ]
        );
        await query(
          `UPDATE subscriptions SET status='active', current_period_end=to_timestamp($1)
           WHERE stripe_subscription_id=$2`,
          [sub.current_period_end, sub.id]
        );
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      if (!invoice.subscription) break;
      await query(
        "UPDATE subscriptions SET status='past_due' WHERE stripe_subscription_id=$1",
        [invoice.subscription as string]
      );
      // 3-day grace: do NOT revoke access here.
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata.userId;
      const plan = sub.metadata.plan;
      if (userId && plan) await upsertSubscription(sub, userId, plan);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      if (sub.metadata.creatorId && sub.metadata.tierId) {
        await query(
          "UPDATE patron_subscriptions SET status='cancelled', cancelled_at=NOW() WHERE stripe_subscription_id=$1",
          [sub.id]
        );
        await query(
          "UPDATE patron_tiers SET subscriber_count = GREATEST(0, subscriber_count - 1) WHERE id=$1",
          [sub.metadata.tierId]
        );
        break;
      }
      const userId = sub.metadata.userId;
      if (userId) {
        await transaction(async (c) => {
          await c.query(
            "UPDATE users SET subscription_plan='free' WHERE id=$1",
            [userId]
          );
          await c.query(
            "UPDATE subscriptions SET status='cancelled', cancelled_at=NOW() WHERE stripe_subscription_id=$1",
            [sub.id]
          );
        });
        await clearUserCache(userId);
      }
      break;
    }

    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderId = pi.metadata.orderId;
      if (!orderId) break;
      await transaction(async (c) => {
        const o = await c.query<{ seller_id: string; subtotal_cents: number }>(
          "UPDATE orders SET status='paid', updated_at=NOW() WHERE id=$1 AND status='pending' RETURNING seller_id, subtotal_cents",
          [orderId]
        );
        if (!o.rows[0]) return;
        // Deduct inventory per line item.
        const items = await c.query<{ product_id: string; quantity: number }>(
          "SELECT product_id, quantity FROM order_items WHERE order_id=$1",
          [orderId]
        );
        for (const it of items.rows) {
          await c.query(
            "UPDATE products SET inventory_count = GREATEST(0, inventory_count - $1), sale_count = sale_count + $1 WHERE id=$2 AND track_inventory",
            [it.quantity, it.product_id]
          );
        }
        const gross = o.rows[0].subtotal_cents ?? pi.amount;
        const platformFee = Math.round(gross * PLATFORM_FEE.shop);
        const stripeFee = estimateStripeFee(gross);
        await c.query(
          `INSERT INTO creator_earnings
             (creator_id, source, source_id, gross_cents, platform_fee_cents, stripe_fee_cents, net_cents)
           VALUES ($1,'shop',$2,$3,$4,$5,$6)`,
          [o.rows[0].seller_id, orderId, gross, platformFee, stripeFee, gross - platformFee - stripeFee]
        );
      });
      const seller = await query<{ seller_id: string }>(
        "SELECT seller_id FROM orders WHERE id=$1",
        [orderId]
      );
      if (seller.rows[0]) {
        try {
          getIo().to(rooms.user(seller.rows[0].seller_id)).emit("new-order", { orderId });
        } catch { /* socket optional */ }
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderId = pi.metadata.orderId;
      if (orderId) {
        await query("UPDATE orders SET status='cancelled' WHERE id=$1 AND status='pending'", [orderId]);
      }
      break;
    }

    default:
      break;
  }
}

// Raw body ONLY for this route (signature verification needs the exact bytes).
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (!sig || !env.STRIPE_WEBHOOK_SECRET) {
      res.status(400).send("missing signature");
      return;
    }
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      res.status(400).send(`invalid: ${(err as Error).message}`);
      return;
    }

    if (await alreadyProcessed(event.id)) {
      res.json({ received: true });
      return;
    }
    try {
      await handleEvent(event);
      await audit(`stripe.${event.type}`, event.id, { type: event.type });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Webhook ${event.type} failed:`, (err as Error).message);
      // Let Stripe retry — release the idempotency key.
      await redisClient.del(`stripe:evt:${event.id}`);
      res.status(500).send("handler error");
      return;
    }
    res.json({ received: true });
  }
);

export default router;
