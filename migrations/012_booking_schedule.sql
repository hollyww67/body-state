ALTER TABLE slots
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 60
  CHECK (duration_minutes BETWEEN 15 AND 480);

UPDATE slots
   SET duration_minutes = CASE
     WHEN service_type IN ('bfm', 'psychology') THEN 90
     ELSE 60
   END;

CREATE INDEX IF NOT EXISTS slots_time_duration_idx
  ON slots (slot_time, duration_minutes);

ALTER TABLE bfm_bookings ADD COLUMN IF NOT EXISTS rescheduled_at timestamptz;
ALTER TABLE brt_bookings ADD COLUMN IF NOT EXISTS rescheduled_at timestamptz;
ALTER TABLE psychology_bookings ADD COLUMN IF NOT EXISTS rescheduled_at timestamptz;
