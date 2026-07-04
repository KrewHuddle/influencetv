-- ─── dmca_notices ───
CREATE TABLE IF NOT EXISTS dmca_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_name VARCHAR(255),
  reporter_email VARCHAR(255),
  reporter_company VARCHAR(255),
  claimed_work_title VARCHAR(500),
  claimed_work_url VARCHAR(500),
  infringing_content_url VARCHAR(500),
  infringing_video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  good_faith_statement BOOLEAN NOT NULL,
  accuracy_statement BOOLEAN NOT NULL,
  electronic_signature VARCHAR(255),
  status dmca_status NOT NULL DEFAULT 'received',
  actioned_at TIMESTAMPTZ,
  actioned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  counter_notice_filed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  notes TEXT,
  ip_address INET,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dmca_status ON dmca_notices (status);
CREATE INDEX IF NOT EXISTS idx_dmca_video ON dmca_notices (infringing_video_id);
CREATE INDEX IF NOT EXISTS idx_dmca_received ON dmca_notices (received_at);

-- ─── content_strikes ───
CREATE TABLE IF NOT EXISTS content_strikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  reason VARCHAR(255),
  severity strike_severity NOT NULL DEFAULT 'warning',
  notes TEXT,
  issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_strikes_user ON content_strikes (user_id);
CREATE INDEX IF NOT EXISTS idx_strikes_severity ON content_strikes (severity);
CREATE INDEX IF NOT EXISTS idx_strikes_issued ON content_strikes (issued_at);

-- ─── audit_log ───
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100),
  target_type VARCHAR(50),
  target_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_log (admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_target_type ON audit_log (target_type);
CREATE INDEX IF NOT EXISTS idx_audit_target_id ON audit_log (target_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log (created_at);
