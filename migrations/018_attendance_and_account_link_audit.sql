CREATE TABLE IF NOT EXISTS booking_account_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id text NOT NULL,
  booking_table text NOT NULL,
  account_user_id uuid NOT NULL REFERENCES account_users(id),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE bfm_bookings ADD COLUMN IF NOT EXISTS attendance text CHECK (attendance IN ('present','absent'));
ALTER TABLE brt_bookings ADD COLUMN IF NOT EXISTS attendance text CHECK (attendance IN ('present','absent'));
ALTER TABLE psychology_bookings ADD COLUMN IF NOT EXISTS attendance text CHECK (attendance IN ('present','absent'));
ALTER TABLE program_enrollments ADD COLUMN IF NOT EXISTS attendance text CHECK (attendance IN ('present','absent'));
ALTER TABLE consultation_enrollments ADD COLUMN IF NOT EXISTS attendance text CHECK (attendance IN ('present','absent'));
-- Hide only the unchanged seed draft, retaining it for editing.
UPDATE promotions SET is_active=false, updated_at=now()
WHERE summary='Черновик реферальной акции: отредактируйте условия и включите публикацию.';
