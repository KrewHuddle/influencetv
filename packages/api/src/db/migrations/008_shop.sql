-- ─── products ───
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(500),
  description TEXT,
  category VARCHAR(100),
  is_digital BOOLEAN NOT NULL DEFAULT false,
  digital_file_s3_key VARCHAR(500),
  base_price_cents INTEGER NOT NULL,
  compare_at_price_cents INTEGER,
  inventory_count INTEGER NOT NULL DEFAULT 0,
  track_inventory BOOLEAN NOT NULL DEFAULT true,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  thumbnail_url VARCHAR(500),
  image_urls TEXT[],
  tags TEXT[],
  weight_grams INTEGER,
  requires_shipping BOOLEAN NOT NULL DEFAULT true,
  view_count INTEGER NOT NULL DEFAULT 0,
  sale_count INTEGER NOT NULL DEFAULT 0,
  platform_fee_percent DECIMAL(5,2) NOT NULL DEFAULT 12.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_seller ON products (seller_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products (created_at);

-- ─── product_variants ───
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(255),
  sku VARCHAR(100),
  price_cents INTEGER,
  inventory_count INTEGER NOT NULL DEFAULT 0,
  option1_name VARCHAR(100),
  option1_value VARCHAR(100),
  option2_name VARCHAR(100),
  option2_value VARCHAR(100),
  image_url VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants (product_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants (sku);

-- ─── video_products ───
CREATE TABLE IF NOT EXISTS video_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  timestamp_seconds INTEGER,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_video_products_video ON video_products (video_id);
CREATE INDEX IF NOT EXISTS idx_video_products_product ON video_products (product_id);

-- ─── orders ───
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE
    DEFAULT 'APX-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8)),
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  status order_status NOT NULL DEFAULT 'pending',
  subtotal_cents INTEGER,
  platform_fee_cents INTEGER,
  stripe_fee_cents INTEGER,
  seller_payout_cents INTEGER,
  shipping_address JSONB,
  shipping_carrier VARCHAR(100),
  tracking_number VARCHAR(255),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders (buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders (seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders (order_number);

-- ─── live_shops (before order_items FK reference) ───
CREATE TABLE IF NOT EXISTS live_shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  starts_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
  total_sales_cents INTEGER NOT NULL DEFAULT 0,
  order_count INTEGER NOT NULL DEFAULT 0,
  peak_viewer_count INTEGER NOT NULL DEFAULT 0,
  platform_fee_percent DECIMAL(5,2) NOT NULL DEFAULT 12.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_live_shops_host ON live_shops (host_id);
CREATE INDEX IF NOT EXISTS idx_live_shops_status ON live_shops (status);
CREATE INDEX IF NOT EXISTS idx_live_shops_starts ON live_shops (starts_at);

-- ─── order_items ───
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER,
  source VARCHAR(50) NOT NULL DEFAULT 'storefront',
  live_shop_id UUID REFERENCES live_shops(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items (product_id);

-- ─── flash_sales ───
CREATE TABLE IF NOT EXISTS flash_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  live_shop_id UUID REFERENCES live_shops(id) ON DELETE SET NULL,
  sale_price_cents INTEGER NOT NULL,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  max_units INTEGER,
  units_sold INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_flash_sales_product ON flash_sales (product_id);
CREATE INDEX IF NOT EXISTS idx_flash_sales_active ON flash_sales (is_active);
CREATE INDEX IF NOT EXISTS idx_flash_sales_starts ON flash_sales (starts_at);
CREATE INDEX IF NOT EXISTS idx_flash_sales_ends ON flash_sales (ends_at);
