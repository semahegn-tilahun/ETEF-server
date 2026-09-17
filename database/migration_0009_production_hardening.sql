-- Module 09: production hardening, audit trail and indexes
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80),
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address VARCHAR(100),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user ON audit_logs(admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_membership_status_submitted ON membership_applications(status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_faq_public_order ON faqs(is_published, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_vacancy_public ON job_vacancies(status, closing_date, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_public ON gallery_albums(is_published, event_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_items_album_order ON gallery_items(album_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON admin_sessions(expires_at);
