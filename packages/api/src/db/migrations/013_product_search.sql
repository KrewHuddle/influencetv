-- Trigram index for product search over title + description (pg_trgm from 001).
CREATE INDEX IF NOT EXISTS idx_products_search
  ON products USING gin ((COALESCE(title,'') || ' ' || COALESCE(description,'')) gin_trgm_ops);
