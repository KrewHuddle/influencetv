-- ─── communities ───
CREATE TABLE IF NOT EXISTS communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50),
  entity_id UUID,
  name VARCHAR(255),
  description TEXT,
  rules TEXT,
  banner_url VARCHAR(500),
  member_count INTEGER NOT NULL DEFAULT 0,
  post_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_communities_entity ON communities (entity_id);
CREATE INDEX IF NOT EXISTS idx_communities_type ON communities (type);

-- ─── community_members ───
CREATE TABLE IF NOT EXISTS community_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_moderator BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (community_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_community_members_community ON community_members (community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members (user_id);

-- ─── posts ───
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type post_type NOT NULL DEFAULT 'discussion',
  title VARCHAR(500),
  body TEXT NOT NULL,
  episode_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  timestamp_ref INTEGER,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_posts_community ON posts (community_id);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts (user_id);
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts (type);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at);
CREATE INDEX IF NOT EXISTS idx_posts_pinned ON posts (is_pinned);

-- ─── comments ───
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  like_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments (post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments (user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments (parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments (created_at);

-- ─── user_points ───
CREATE TABLE IF NOT EXISTS user_points (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  level_name VARCHAR(50) NOT NULL DEFAULT 'Viewer',
  watch_time_seconds BIGINT NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── watch_parties ───
CREATE TABLE IF NOT EXISTS watch_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255),
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ,
  ticket_price_cents INTEGER NOT NULL DEFAULT 0,
  max_attendees INTEGER NOT NULL DEFAULT 1000,
  attendee_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
  platform_fee_percent DECIMAL(5,2) NOT NULL DEFAULT 30.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_watch_parties_host ON watch_parties (host_id);
CREATE INDEX IF NOT EXISTS idx_watch_parties_starts ON watch_parties (starts_at);
CREATE INDEX IF NOT EXISTS idx_watch_parties_status ON watch_parties (status);
