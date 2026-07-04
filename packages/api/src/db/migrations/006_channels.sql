-- ─── channels ───
CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  slug VARCHAR(100) UNIQUE,
  description TEXT,
  genre VARCHAR(100),
  artwork_url VARCHAR(500),
  banner_url VARCHAR(500),
  stream_key VARCHAR(255) UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  rtmp_url VARCHAR(500),
  hls_output_url VARCHAR(500),
  status channel_status NOT NULL DEFAULT 'offline',
  current_video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  current_program_start TIMESTAMPTZ,
  viewer_count INTEGER NOT NULL DEFAULT 0,
  requires_premium BOOLEAN NOT NULL DEFAULT false,
  filler_playlist_id UUID,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_channels_slug ON channels (slug);
CREATE INDEX IF NOT EXISTS idx_channels_status ON channels (status);
CREATE INDEX IF NOT EXISTS idx_channels_genre ON channels (genre);

-- ─── ad_pods (defined before schedule for FK-friendly ordering) ───
CREATE TABLE IF NOT EXISTS ad_pods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  total_duration_seconds INTEGER,
  ads JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── schedule ───
CREATE TABLE IF NOT EXISTS schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  youtube_embed_id UUID REFERENCES youtube_embeds(id) ON DELETE SET NULL,
  title VARCHAR(500),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_filler BOOLEAN NOT NULL DEFAULT false,
  is_ad_break BOOLEAN NOT NULL DEFAULT false,
  ad_pod_id UUID REFERENCES ad_pods(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT schedule_end_after_start CHECK (end_time > start_time),
  CONSTRAINT schedule_no_overlap EXCLUDE USING gist (
    channel_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  )
);
CREATE INDEX IF NOT EXISTS idx_schedule_channel ON schedule (channel_id);
CREATE INDEX IF NOT EXISTS idx_schedule_start ON schedule (start_time);
CREATE INDEX IF NOT EXISTS idx_schedule_end ON schedule (end_time);

-- ─── ad_campaigns ───
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_name VARCHAR(255),
  video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  budget_cents INTEGER,
  cpm_cents INTEGER NOT NULL DEFAULT 2000,
  impressions_served INTEGER NOT NULL DEFAULT 0,
  impressions_target INTEGER,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_active ON ad_campaigns (is_active);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_start ON ad_campaigns (start_date);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_end ON ad_campaigns (end_date);
