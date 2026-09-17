-- Secure, single-use, expiring admin password-reset tokens
CREATE TABLE IF NOT EXISTS admin_password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_password_reset_tokens_user
  ON admin_password_reset_tokens(admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_password_reset_tokens_expiry
  ON admin_password_reset_tokens(expires_at);
