-- Preserve UUIDs from legacy Supabase rows while using numeric local IDs.
ALTER TABLE page_content ADD COLUMN IF NOT EXISTS legacy_id uuid;
ALTER TABLE consultation_enrollments ADD COLUMN IF NOT EXISTS legacy_id uuid;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS legacy_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS page_content_legacy_id_idx
  ON page_content (legacy_id) WHERE legacy_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS consultation_enrollments_legacy_id_idx
  ON consultation_enrollments (legacy_id) WHERE legacy_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reviews_legacy_id_idx
  ON reviews (legacy_id) WHERE legacy_id IS NOT NULL;
