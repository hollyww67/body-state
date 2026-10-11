ALTER TABLE account_users
  DROP CONSTRAINT IF EXISTS account_users_contact_required;

ALTER TABLE account_users
  ALTER COLUMN verified_at DROP NOT NULL;

ALTER TABLE account_users
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS account_users_username_unique_idx
  ON account_users (lower(username))
  WHERE username IS NOT NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS account_user_id uuid
  REFERENCES account_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_account_user_id_idx
  ON orders(account_user_id);
