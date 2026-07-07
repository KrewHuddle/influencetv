-- Haggle: live auctions that run inside channel streams.

DO $$ BEGIN
  CREATE TYPE auction_status AS ENUM ('scheduled','live','ending','sold','unsold','cancelled','payment_failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE bid_status AS ENUM ('accepted','rejected','stale','winning','outbid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS haggle_auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  live_shop_id UUID REFERENCES live_shops(id),
  channel_id UUID REFERENCES channels(id),
  title VARCHAR(500) NOT NULL,
  starting_bid_cents INTEGER NOT NULL DEFAULT 100,
  reserve_price_cents INTEGER,
  current_bid_cents INTEGER NOT NULL DEFAULT 0,
  current_winner_id UUID REFERENCES users(id),
  bid_increment_cents INTEGER NOT NULL DEFAULT 100,
  status auction_status NOT NULL DEFAULT 'scheduled',
  duration_seconds INTEGER NOT NULL DEFAULT 60,
  auto_extend BOOLEAN DEFAULT true,
  extend_seconds INTEGER DEFAULT 15,
  extend_threshold_seconds INTEGER DEFAULT 10,
  extension_count INTEGER DEFAULT 0,
  max_extensions INTEGER DEFAULT 5,
  scheduled_for TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  final_price_cents INTEGER,
  platform_fee_percent DECIMAL(5,2) DEFAULT 12.00,
  stripe_payment_intent_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_haggle_auctions_seller ON haggle_auctions(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_haggle_auctions_channel ON haggle_auctions(channel_id, status);
CREATE INDEX IF NOT EXISTS idx_haggle_auctions_winner ON haggle_auctions(current_winner_id);

CREATE TABLE IF NOT EXISTS haggle_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES haggle_auctions(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount_cents INTEGER NOT NULL,
  max_amount_cents INTEGER,
  status bid_status NOT NULL DEFAULT 'accepted',
  is_proxy BOOLEAN DEFAULT false,
  sequence_num BIGINT NOT NULL,
  placed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_haggle_bids_auction ON haggle_bids(auction_id, placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_haggle_bids_bidder ON haggle_bids(bidder_id, placed_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_haggle_bids_seq ON haggle_bids(auction_id, sequence_num);

CREATE TABLE IF NOT EXISTS haggle_watchlist (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  auction_id UUID NOT NULL REFERENCES haggle_auctions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, auction_id)
);
