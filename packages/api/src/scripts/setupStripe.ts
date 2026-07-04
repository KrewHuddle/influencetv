import { stripe, stripeEnabled } from "../config/stripe";

// One-time: create Apex Premium + Ultra products and recurring prices.
// Run: tsx src/scripts/setupStripe.ts — then copy the printed price IDs into .env.
async function main(): Promise<void> {
  if (!stripeEnabled) {
    // eslint-disable-next-line no-console
    console.error("STRIPE_SECRET_KEY not set — aborting.");
    process.exit(1);
  }

  const premium = await stripe.products.create({
    name: "Apex Premium",
    metadata: { plan: "premium", maxDevices: "3", quality: "1080p" },
  });
  const premiumPrice = await stripe.prices.create({
    product: premium.id,
    unit_amount: 1499,
    currency: "usd",
    recurring: { interval: "month" },
  });

  const ultra = await stripe.products.create({
    name: "Apex Ultra",
    metadata: { plan: "ultra", maxDevices: "6", quality: "4K" },
  });
  const ultraPrice = await stripe.prices.create({
    product: ultra.id,
    unit_amount: 2499,
    currency: "usd",
    recurring: { interval: "month" },
  });

  // eslint-disable-next-line no-console
  console.log("Add these to .env:");
  // eslint-disable-next-line no-console
  console.log(`STRIPE_PREMIUM_PRICE_ID=${premiumPrice.id}`);
  // eslint-disable-next-line no-console
  console.log(`STRIPE_ULTRA_PRICE_ID=${ultraPrice.id}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
