-- Public review moderation and user complaint workflow.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'pending';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS moderated_at timestamptz;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS moderation_note text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'website';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS publication_consent_evidence text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reviews_moderation_status_check'
  ) THEN
    ALTER TABLE reviews
      ADD CONSTRAINT reviews_moderation_status_check
      CHECK (moderation_status IN ('pending', 'published', 'rejected'));
  END IF;
END $$;

-- Preserve the current catalogue of imported testimonials. The operator must
-- retain the original consent evidence outside the site for legacy records.
UPDATE reviews
SET is_published = true,
    moderation_status = 'published',
    moderated_at = COALESCE(moderated_at, updated_at, created_at),
    source = CASE WHEN publication_consent_at IS NULL THEN 'legacy' ELSE source END
WHERE is_published = false
  AND moderation_status = 'pending'
  AND created_at < now();

CREATE INDEX IF NOT EXISTS reviews_public_created_idx
  ON reviews (created_at DESC) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS reviews_moderation_idx
  ON reviews (moderation_status, created_at DESC);

CREATE TABLE IF NOT EXISTS review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id bigint NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN (
    'personal_data',
    'false_information',
    'offensive',
    'prohibited_content',
    'rights_violation',
    'other'
  )),
  details text,
  reporter_email text,
  consent_version text,
  consent_at timestamptz,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved', 'rejected')),
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_reports_status_created_idx
  ON review_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS review_reports_review_idx
  ON review_reports (review_id, created_at DESC);
