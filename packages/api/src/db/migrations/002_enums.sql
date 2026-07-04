-- Enum types. Guarded with DO blocks so the migration is idempotent.
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'viewer_free','viewer_premium','viewer_ultra','creator','seller',
    'moderator','channel_manager','super_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_plan AS ENUM ('free','premium','ultra');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE video_status AS ENUM (
    'uploading','processing','ready','failed','rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE video_type AS ENUM (
    'episode','movie','clip','live_recording','youtube_embed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE content_rating AS ENUM ('G','PG','PG-13','TV-14','TV-MA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE channel_status AS ENUM ('active','offline','maintenance','error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE post_type AS ENUM (
    'discussion','announcement','poll','episode_thread','clip'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'pending','paid','processing','shipped','delivered','cancelled','refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payout_status AS ENUM ('pending','processing','paid','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dmca_status AS ENUM (
    'received','under_review','actioned','counter_noticed','resolved','rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE strike_severity AS ENUM ('warning','minor','major','permanent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
