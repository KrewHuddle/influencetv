import Stripe from "stripe";
import { env } from "./env";

// apiVersion omitted → uses the account/SDK default, avoids literal-type churn.
export const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? "");

export const stripeEnabled = Boolean(env.STRIPE_SECRET_KEY);

export const PLAN_PRICE: Record<string, string | undefined> = {
  premium: env.STRIPE_PREMIUM_PRICE_ID,
  ultra: env.STRIPE_ULTRA_PRICE_ID,
};

/** Platform fee percentages by revenue source. */
export const PLATFORM_FEE = {
  patron: 0.15,
  shop: 0.12,
  watchParty: 0.3,
};

/** Rough Stripe processing fee estimate (2.9% + 30¢) in cents. */
export function estimateStripeFee(grossCents: number): number {
  return Math.round(grossCents * 0.029) + 30;
}
