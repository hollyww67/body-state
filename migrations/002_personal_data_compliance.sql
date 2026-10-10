-- Consent evidence for public forms. Apply after 001_initial.sql.
ALTER TABLE bfm_bookings ADD COLUMN IF NOT EXISTS consent_version text;
ALTER TABLE bfm_bookings ADD COLUMN IF NOT EXISTS consent_at timestamptz;
ALTER TABLE brt_bookings ADD COLUMN IF NOT EXISTS consent_version text;
ALTER TABLE brt_bookings ADD COLUMN IF NOT EXISTS consent_at timestamptz;
ALTER TABLE psychology_bookings ADD COLUMN IF NOT EXISTS consent_version text;
ALTER TABLE psychology_bookings ADD COLUMN IF NOT EXISTS consent_at timestamptz;
ALTER TABLE program_enrollments ADD COLUMN IF NOT EXISTS consent_version text;
ALTER TABLE program_enrollments ADD COLUMN IF NOT EXISTS consent_at timestamptz;
ALTER TABLE consultation_enrollments ADD COLUMN IF NOT EXISTS consent_version text;
ALTER TABLE consultation_enrollments ADD COLUMN IF NOT EXISTS consent_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS consent_version text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS consent_at timestamptz;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS consent_version text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS consent_at timestamptz;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS publication_consent_version text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS publication_consent_at timestamptz;
