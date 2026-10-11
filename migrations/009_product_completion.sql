-- Account-linked services, saved delivery details and centrally managed prices.
ALTER TABLE account_users
  ADD COLUMN IF NOT EXISTS address text;

ALTER TABLE bfm_bookings
  ADD COLUMN IF NOT EXISTS account_user_id uuid REFERENCES account_users(id) ON DELETE SET NULL;
ALTER TABLE brt_bookings
  ADD COLUMN IF NOT EXISTS account_user_id uuid REFERENCES account_users(id) ON DELETE SET NULL;
ALTER TABLE psychology_bookings
  ADD COLUMN IF NOT EXISTS account_user_id uuid REFERENCES account_users(id) ON DELETE SET NULL;
ALTER TABLE program_enrollments
  ADD COLUMN IF NOT EXISTS account_user_id uuid REFERENCES account_users(id) ON DELETE SET NULL;
ALTER TABLE consultation_enrollments
  ADD COLUMN IF NOT EXISTS account_user_id uuid REFERENCES account_users(id) ON DELETE SET NULL;
ALTER TABLE consultation_enrollments
  ADD COLUMN IF NOT EXISTS service_type text;

CREATE INDEX IF NOT EXISTS bfm_bookings_account_user_idx ON bfm_bookings(account_user_id);
CREATE INDEX IF NOT EXISTS brt_bookings_account_user_idx ON brt_bookings(account_user_id);
CREATE INDEX IF NOT EXISTS psychology_bookings_account_user_idx ON psychology_bookings(account_user_id);
CREATE INDEX IF NOT EXISTS program_enrollments_account_user_idx ON program_enrollments(account_user_id);
CREATE INDEX IF NOT EXISTS consultation_enrollments_account_user_idx ON consultation_enrollments(account_user_id);

CREATE TABLE IF NOT EXISTS service_prices (
  code text PRIMARY KEY,
  label text NOT NULL,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  prefix text NOT NULL DEFAULT 'от',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO service_prices (code, label, price, prefix)
VALUES
  ('bfm', 'Биофасциальная модуляция', 3000, 'от'),
  ('brt', 'Биорезонансная терапия', 3000, 'от'),
  ('recovery-program', 'Комплексная программа восстановления', 25000, 'от')
ON CONFLICT (code) DO NOTHING;

-- Keep the public URL available in fresh installations. Existing admin content wins.
INSERT INTO psychology_programs
  (title, slug, description, price, duration, features, is_active, sort_order)
VALUES
  (
    'Возвращение к себе',
    'returning-to-yourself-therapy',
    '<p>Бережная терапевтическая программа для восстановления контакта с собой, своими чувствами и внутренними опорами.</p>',
    2300,
    '60 минут',
    '["Индивидуальная встреча", "Бережная работа с запросом", "Рекомендации после консультации"]'::jsonb,
    true,
    10
  )
ON CONFLICT (slug) DO NOTHING;
