import Stripe from "stripe";
import { stripe, stripeEnabled } from "../config/stripe";

// One-time (idempotent): create/reuse Influence TV Premium + Ultra products and
// their monthly recurring prices, then print the price IDs for .env.
// Run: tsx src/scripts/setupStripe.ts

interface PlanSpec {
  plan: string;
  name: string;
  amount: number; // cents
  metadata: Record<string, string>;
}

const PLANS: PlanSpec[] = [
  { plan: "premium", name: "Influence TV Premium", amount: 1499, metadata: { plan: "premium", maxDevices: "3", quality: "1080p" } },
  { plan: "ultra", name: "Influence TV Ultra", amount: 2499, metadata: { plan: "ultra", maxDevices: "6", quality: "4K" } },
];

/** Find an existing product by metadata.plan, else create it. */
async function findOrCreateProduct(spec: PlanSpec): Promise<Stripe.Product> {
  const existing = await stripe.products.list({ active: true, limit: 100 });
  const match = existing.data.find((p) => p.metadata?.plan === spec.plan);
  if (match) {
    // eslint-disable-next-line no-console
    console.log(`· reusing product ${spec.name} (${match.id})`);
    return match;
  }
  const created = await stripe.products.create({ name: spec.name, metadata: spec.metadata });
  // eslint-disable-next-line no-console
  console.log(`· created product ${spec.name} (${created.id})`);
  return created;
}

/** Find an active monthly price of the right amount on the product, else create it. */
async function findOrCreatePrice(product: Stripe.Product, amount: number): Promise<Stripe.Price> {
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
  const match = prices.data.find(
    (p) => p.unit_amount === amount && p.currency === "usd" && p.recurring?.interval === "month"
  );
  if (match) {
    // eslint-disable-next-line no-console
    console.log(`  reusing price ${match.id} ($${(amount / 100).toFixed(2)}/mo)`);
    return match;
  }
  const created = await stripe.prices.create({
    product: product.id,
    unit_amount: amount,
    currency: "usd",
    recurring: { interval: "month" },
  });
  // eslint-disable-next-line no-console
  console.log(`  created price ${created.id} ($${(amount / 100).toFixed(2)}/mo)`);
  return created;
}

async function main(): Promise<void> {
  if (!stripeEnabled) {
    // eslint-disable-next-line no-console
    console.error("STRIPE_SECRET_KEY not set — aborting.");
    process.exit(1);
  }

  const out: Record<string, string> = {};
  for (const spec of PLANS) {
    const product = await findOrCreateProduct(spec);
    const price = await findOrCreatePrice(product, spec.amount);
    out[`STRIPE_${spec.plan.toUpperCase()}_PRICE_ID`] = price.id;
  }

  // eslint-disable-next-line no-console
  console.log("\nAdd these to the API .env (then restart apex-api):");
  for (const [k, v] of Object.entries(out)) {
    // eslint-disable-next-line no-console
    console.log(`${k}=${v}`);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
