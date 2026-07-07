-- Persisted, normalized mezzanine rendition for linear playout.
-- The uploads bucket has a 24h lifecycle (raw sources expire); the playout
-- engine must not depend on it. The transcode worker now also writes a
-- normalized 1080p H.264/AAC fixed-GOP MP4 to the permanent assets bucket, and
-- the playout engine prefers it over the raw upload (safe `-c copy`, clean
-- program boundaries). Column is nullable — pre-existing videos fall back to
-- the original key until re-transcoded.
ALTER TABLE videos ADD COLUMN IF NOT EXISTS s3_mezzanine_key TEXT;
