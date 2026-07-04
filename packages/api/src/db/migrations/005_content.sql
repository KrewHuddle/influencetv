-- ─── videos ───
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(500),
  description TEXT,
  type video_type NOT NULL DEFAULT 'episode',
  rating content_rating NOT NULL DEFAULT 'PG',
  status video_status NOT NULL DEFAULT 'uploading',
  rejection_reason TEXT,
  duration_seconds INTEGER,
  s3_original_key VARCHAR(500),
  s3_hls_key VARCHAR(500),
  hls_url VARCHAR(500),
  thumbnail_url VARCHAR(500),
  genre VARCHAR(100),
  tags TEXT[],
  is_premium BOOLEAN NOT NULL DEFAULT false,
  is_patron_exclusive BOOLEAN NOT NULL DEFAULT false,
  patron_tier_id UUID REFERENCES patron_tiers(id) ON DELETE SET NULL,
  view_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_videos_creator ON videos (creator_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos (status);
CREATE INDEX IF NOT EXISTS idx_videos_type ON videos (type);
CREATE INDEX IF NOT EXISTS idx_videos_genre ON videos (genre);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos (created_at);
CREATE INDEX IF NOT EXISTS idx_videos_published_at ON videos (published_at);
-- Trigram full-text index over title + description.
CREATE INDEX IF NOT EXISTS idx_videos_search
  ON videos USING gin ((coalesce(title,'') || ' ' || coalesce(description,'')) gin_trgm_ops);

-- ─── video_assets ───
CREATE TABLE IF NOT EXISTS video_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  quality VARCHAR(10),
  resolution VARCHAR(20),
  bitrate_kbps INTEGER,
  s3_key VARCHAR(500),
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_video_assets_video ON video_assets (video_id);

-- ─── youtube_embeds ───
CREATE TABLE IF NOT EXISTS youtube_embeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_video_id VARCHAR(50) UNIQUE,
  url VARCHAR(500),
  title VARCHAR(500),
  channel_name VARCHAR(255),
  duration_seconds INTEGER,
  thumbnail_url VARCHAR(500),
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
