CREATE TABLE IF NOT EXISTS loyalty_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visits_required integer NOT NULL UNIQUE CHECK (visits_required > 0),
  discount_percent numeric(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent < 100),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO loyalty_rules (visits_required, discount_percent)
VALUES (10, 10), (20, 20)
ON CONFLICT (visits_required) DO NOTHING;

CREATE TABLE IF NOT EXISTS client_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_user_id uuid REFERENCES account_users(id) ON DELETE SET NULL,
  client_phone text,
  client_email text,
  service_code text NOT NULL CHECK (service_code IN ('bfm', 'brt', 'psychology', 'psychology_program')),
  source_type text NOT NULL CHECK (source_type IN ('booking', 'payment_link')),
  booking_id uuid,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS client_visits_booking_unique
  ON client_visits (service_code, booking_id) WHERE booking_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS client_visits_order_unique
  ON client_visits (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS client_visits_account_idx ON client_visits (account_user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS client_visits_phone_idx ON client_visits ((regexp_replace(COALESCE(client_phone, ''), '\D', '', 'g')));
CREATE INDEX IF NOT EXISTS client_visits_email_idx ON client_visits ((lower(COALESCE(client_email, ''))));

ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS assigned_account_user_id uuid REFERENCES account_users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'loyalty'));

CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_user_id uuid NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES loyalty_rules(id) ON DELETE RESTRICT,
  promo_code_id uuid UNIQUE REFERENCES promo_codes(id) ON DELETE SET NULL,
  visits_at_award integer NOT NULL CHECK (visits_at_award > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_user_id, rule_id)
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS loyalty_client_phone text,
  ADD COLUMN IF NOT EXISTS loyalty_service_code text,
  ADD COLUMN IF NOT EXISTS counts_as_visit boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 160),
  summary text NOT NULL DEFAULT '',
  details text NOT NULL DEFAULT '',
  badge text NOT NULL DEFAULT 'Акция',
  image_url text,
  cta_label text NOT NULL DEFAULT 'Записаться',
  cta_url text NOT NULL DEFAULT '/rehabilitation#booking',
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS promotions_public_idx ON promotions (is_active, starts_at, ends_at);

INSERT INTO promotions (title, summary, details, badge, is_active)
SELECT
  'Приведи друга — получи приём бесплатно',
  'Черновик реферальной акции: отредактируйте условия и включите публикацию.',
  'Укажите срок действия, направления, порядок подтверждения рекомендации и условия получения бесплатного приёма.',
  'Для друзей',
  false
WHERE NOT EXISTS (SELECT 1 FROM promotions WHERE title='Приведи друга — получи приём бесплатно');

INSERT INTO client_visits (account_user_id, client_phone, client_email, service_code, source_type, booking_id, completed_at)
SELECT account_user_id, client_phone, client_email, 'bfm', 'booking', id, COALESCE(updated_at, created_at)
FROM bfm_bookings WHERE status='completed'
ON CONFLICT DO NOTHING;

INSERT INTO client_visits (account_user_id, client_phone, client_email, service_code, source_type, booking_id, completed_at)
SELECT account_user_id, client_phone, client_email, 'brt', 'booking', id, COALESCE(updated_at, created_at)
FROM brt_bookings WHERE status='completed'
ON CONFLICT DO NOTHING;

INSERT INTO client_visits (account_user_id, client_phone, client_email, service_code, source_type, booking_id, completed_at)
SELECT account_user_id, client_phone, client_email,
       CASE WHEN program_id IS NULL THEN 'psychology' ELSE 'psychology_program' END,
       'booking', id, COALESCE(updated_at, created_at)
FROM psychology_bookings WHERE status='completed'
ON CONFLICT DO NOTHING;

INSERT INTO client_visits (account_user_id, client_phone, service_code, source_type, booking_id, completed_at)
SELECT account_user_id, client_phone, 'psychology_program', 'booking', id, COALESCE(updated_at, created_at)
FROM program_enrollments WHERE status='completed'
ON CONFLICT DO NOTHING;
