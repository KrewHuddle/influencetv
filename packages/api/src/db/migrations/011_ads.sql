-- ─── ad_impressions (ad-revenue ledger) ───
-- One row per ad-break fill event. impressions = concurrent viewers served
-- (linear) or 1 (VOD). revenue_cents = cpm_cents * impressions / 1000.
CREATE TABLE IF NOT EXISTS ad_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  context VARCHAR(20) NOT NULL,          -- 'linear' | 'vod'
  ref_id UUID,                           -- channel_id (linear) or video_id (vod)
  creative_video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  impressions INTEGER NOT NULL DEFAULT 1,
  revenue_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_campaign ON ad_impressions (campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_created ON ad_impressions (created_at);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_context ON ad_impressions (context);
