-- ─── creator_earnings ───
CREATE TABLE IF NOT EXISTS creator_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  source VARCHAR(50),
  source_id UUID,
  gross_cents INTEGER,
  platform_fee_cents INTEGER,
  stripe_fee_cents INTEGER,
  net_cents INTEGER,
  is_paid_out BOOLEAN NOT NULL DEFAULT false,
  payout_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_earnings_creator ON creator_earnings (creator_id);
CREATE INDEX IF NOT EXISTS idx_earnings_paidout ON creator_earnings (is_paid_out);
CREATE INDEX IF NOT EXISTS idx_earnings_created_at ON creator_earnings (created_at);
CREATE INDEX IF NOT EXISTS idx_earnings_source ON creator_earnings (source);

-- ─── payouts ───
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount_cents INTEGER,
  currency VARCHAR(3) NOT NULL DEFAULT 'usd',
  stripe_transfer_id VARCHAR(255) UNIQUE,
  stripe_account_id VARCHAR(255),
  status payout_status NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_payouts_user ON payouts (user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts (status);
CREATE INDEX IF NOT EXISTS idx_payouts_initiated ON payouts (initiated_at);

-- Backfill the FK from creator_earnings.payout_id now that payouts exists.
DO $$ BEGIN
  ALTER TABLE creator_earnings
    ADD CONSTRAINT fk_earnings_payout
    FOREIGN KEY (payout_id) REFERENCES payouts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
