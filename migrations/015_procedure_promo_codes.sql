CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value numeric(12,2) NOT NULL CHECK (discount_value > 0),
  service_codes text[] NOT NULL DEFAULT ARRAY['bfm', 'psychology', 'psychology_program']::text[],
  max_redemptions integer CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  redeemed_count integer NOT NULL DEFAULT 0 CHECK (redeemed_count >= 0),
  reserved_count integer NOT NULL DEFAULT 0 CHECK (reserved_count >= 0),
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_codes_uppercase CHECK (code = upper(code)),
  CONSTRAINT promo_codes_format CHECK (code ~ '^[A-Z0-9-]{4,32}$'),
  CONSTRAINT promo_codes_percent CHECK (discount_type <> 'percent' OR discount_value < 100)
);

CREATE INDEX IF NOT EXISTS promo_codes_active_idx ON promo_codes (is_active, expires_at);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS subtotal numeric(12,2),
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_code_id uuid REFERENCES promo_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promo_code text;

CREATE TABLE IF NOT EXISTS promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL REFERENCES promo_codes(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'redeemed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promo_redemptions_code_idx ON promo_redemptions (promo_code_id, status);
