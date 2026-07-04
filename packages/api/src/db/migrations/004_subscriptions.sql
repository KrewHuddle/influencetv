-- ─── subscriptions ───
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  stripe_price_id VARCHAR(255),
  status VARCHAR(50),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subs_stripe ON subscriptions (stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subs_status ON subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_subs_period_end ON subscriptions (current_period_end);

-- ─── invoices ───
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_invoice_id VARCHAR(255) UNIQUE,
  stripe_payment_intent_id VARCHAR(255),
  amount_total INTEGER,
  amount_paid INTEGER NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'usd',
  status VARCHAR(50),
  invoice_url VARCHAR(500),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices (user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe ON invoices (stripe_invoice_id);

-- ─── patron_tiers ───
CREATE TABLE IF NOT EXISTS patron_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100),
  description TEXT,
  price_cents INTEGER NOT NULL,
  stripe_price_id VARCHAR(255),
  perks JSONB NOT NULL DEFAULT '[]',
  position INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  subscriber_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patron_tiers_creator ON patron_tiers (creator_id);
CREATE INDEX IF NOT EXISTS idx_patron_tiers_active ON patron_tiers (is_active);

-- ─── patron_subscriptions ───
CREATE TABLE IF NOT EXISTS patron_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES patron_tiers(id) ON DELETE RESTRICT,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  status VARCHAR(50),
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  platform_fee_percent DECIMAL(5,2) NOT NULL DEFAULT 15.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fan_id, creator_id)
);
CREATE INDEX IF NOT EXISTS idx_patron_subs_fan ON patron_subscriptions (fan_id);
CREATE INDEX IF NOT EXISTS idx_patron_subs_creator ON patron_subscriptions (creator_id);
CREATE INDEX IF NOT EXISTS idx_patron_subs_tier ON patron_subscriptions (tier_id);
CREATE INDEX IF NOT EXISTS idx_patron_subs_status ON patron_subscriptions (status);
