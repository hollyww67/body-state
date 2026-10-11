CREATE TABLE IF NOT EXISTS account_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text,
  email text UNIQUE,
  phone text UNIQUE,
  consent_version text NOT NULL,
  consent_at timestamptz NOT NULL,
  verified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_users_contact_required CHECK (email IS NOT NULL OR phone IS NOT NULL),
  CONSTRAINT account_users_display_name_length CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 2 AND 80)
);

CREATE INDEX IF NOT EXISTS account_users_created_at_idx ON account_users (created_at DESC);

