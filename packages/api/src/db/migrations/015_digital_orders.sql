-- Digital delivery + saved payment method (Haggle + live-shop digital goods).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS download_url VARCHAR(500);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0;

-- Winner's default card for one-tap auction settlement charges.
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_payment_method_id VARCHAR(255);
