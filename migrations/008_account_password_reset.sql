ALTER TABLE account_users
  ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1;

ALTER TABLE account_users
  DROP CONSTRAINT IF EXISTS account_users_session_version_positive;

ALTER TABLE account_users
  ADD CONSTRAINT account_users_session_version_positive CHECK (session_version > 0);

CREATE TABLE IF NOT EXISTS account_password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_user_id uuid NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_password_reset_user_idx
  ON account_password_reset_tokens(account_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS account_password_reset_expiry_idx
  ON account_password_reset_tokens(expires_at)
  WHERE used_at IS NULL;
