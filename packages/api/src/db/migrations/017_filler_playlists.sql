-- P0 playout hardening: curated filler playlists + honest linear ABR URLs.

-- Curated playlists. channels.filler_playlist_id (created in 006 with no
-- target table) finally gets something to point at.
CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS playlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  UNIQUE (playlist_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_id);

ALTER TABLE channels
  ADD CONSTRAINT fk_channels_filler_playlist
  FOREIGN KEY (filler_playlist_id) REFERENCES playlists(id) ON DELETE SET NULL;

-- Linear playout now emits a real 3-rung ABR ladder (nginx vod app), so the
-- channel URL moves from the single-rendition index.m3u8 to the master
-- playlist. Only linear-channel URLs match this shape; videos.hls_url is a
-- different table and untouched.
UPDATE channels
SET hls_output_url = replace(hls_output_url, '/index.m3u8', '/master.m3u8'),
    updated_at = NOW()
WHERE hls_output_url LIKE '%/hls/%/index.m3u8';
