-- ─── users ───
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  email_verification_token VARCHAR(255),
  email_verification_expires_at TIMESTAMPTZ,
  password_hash VARCHAR(255),
  google_id VARCHAR(255) UNIQUE,
  role user_role NOT NULL DEFAULT 'viewer_free',
  subscription_plan subscription_plan NOT NULL DEFAULT 'free',
  stripe_customer_id VARCHAR(255) UNIQUE,
  stripe_account_id VARCHAR(255),
  stripe_account_status VARCHAR(50),
  display_name VARCHAR(100),
  username VARCHAR(50) UNIQUE,
  bio TEXT,
  avatar_url VARCHAR(500),
  banner_url VARCHAR(500),
  genre_preferences TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  suspended_at TIMESTAMPTZ,
  suspended_reason TEXT,
  suspended_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_account ON users (stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at);

-- ─── sessions ───
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token VARCHAR(500) UNIQUE,
  device_type VARCHAR(50),
  device_id VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh ON sessions (refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

-- ─── password_resets ───
CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets (user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets (token);

-- ─── user_devices ───
CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_type VARCHAR(50),
  device_fingerprint VARCHAR(255),
  fire_tv_device_id VARCHAR(255),
  tv_auth_code VARCHAR(10),
  tv_auth_expires_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_devices_user ON user_devices (user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_firetv ON user_devices (fire_tv_device_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_tvcode ON user_devices (tv_auth_code);
