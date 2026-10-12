-- Expand-only. No backfill of invented booking events, no deletion of slots/bookings.
CREATE TABLE IF NOT EXISTS schedule_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  week jsonb NOT NULL CHECK (jsonb_typeof(week)='array' AND jsonb_array_length(week)=7),
  horizon_days integer NOT NULL CHECK (horizon_days BETWEEN 7 AND 180),
  active boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS schedule_templates_single_active ON schedule_templates ((active)) WHERE active;
CREATE TABLE IF NOT EXISTS schedule_exceptions (
  day date PRIMARY KEY,
  mode text NOT NULL CHECK(mode IN ('closed','hours')),
  hours jsonb,
  reason text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((mode='closed' AND hours IS NULL) OR (mode='hours' AND jsonb_typeof(hours)='object'))
);
CREATE TABLE IF NOT EXISTS schedule_days (
  day date PRIMARY KEY,
  mode text NOT NULL CHECK(mode IN ('published','closed','unpublished')),
  hours jsonb,
  template_id uuid REFERENCES schedule_templates(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE schedule_breaks ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'manual';
ALTER TABLE schedule_breaks ADD COLUMN IF NOT EXISTS source_key text;
ALTER TABLE appointment_notifications ADD COLUMN IF NOT EXISTS send_started_at timestamptz;
CREATE INDEX IF NOT EXISTS schedule_breaks_source ON schedule_breaks(source_type,source_key);
CREATE TABLE IF NOT EXISTS schedule_operations (
  request_key uuid PRIMARY KEY,
  input_hash text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS schedule_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  template_id uuid REFERENCES schedule_templates(id) ON DELETE SET NULL,
  template_version integer,
  dry_run boolean NOT NULL DEFAULT false,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS schedule_runs_recent ON schedule_runs(created_at DESC);
ALTER TABLE bfm_bookings ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE brt_bookings ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE psychology_bookings ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE program_enrollments ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE consultation_enrollments ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE TABLE IF NOT EXISTS booking_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id uuid NOT NULL,
  service_type text NOT NULL CHECK(service_type IN ('bfm','brt','psychology')),
  event_type text NOT NULL CHECK(event_type IN ('created','rescheduled','status_changed','archived','admin_action','payment_status_changed')),
  old_slot_id uuid REFERENCES slots(id) ON DELETE RESTRICT,
  new_slot_id uuid REFERENCES slots(id) ON DELETE RESTRICT,
  old_time timestamptz,
  new_time timestamptz,
  old_duration integer,
  new_duration integer,
  old_status text,
  new_status text NOT NULL,
  attendance text,
  payment_status text,
  actor text NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_events_booking ON booking_events(service_type,booking_id,id);
CREATE INDEX IF NOT EXISTS booking_events_old_slot ON booking_events(old_slot_id);
CREATE INDEX IF NOT EXISTS booking_events_new_slot ON booking_events(new_slot_id);
CREATE OR REPLACE FUNCTION append_booking_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE kind text; previous_id uuid; previous_time timestamptz; previous_duration integer;
        current_time_value timestamptz; current_duration integer; previous_status text;
BEGIN
  IF TG_OP='INSERT' THEN kind:='created';
  ELSE
    IF OLD.slot_id IS DISTINCT FROM NEW.slot_id THEN kind:='rescheduled';
    ELSIF OLD.archived_at IS DISTINCT FROM NEW.archived_at THEN kind:='archived';
    ELSIF OLD.status IS DISTINCT FROM NEW.status OR OLD.attendance IS DISTINCT FROM NEW.attendance THEN kind:='status_changed';
    ELSIF OLD.account_user_id IS DISTINCT FROM NEW.account_user_id THEN kind:='admin_action';
    ELSIF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN kind:='payment_status_changed';
    ELSE RETURN NEW; END IF;
    previous_id:=OLD.slot_id; previous_status:=OLD.status;
    SELECT slot_time,duration_minutes INTO previous_time,previous_duration FROM slots WHERE id=previous_id;
  END IF;
  SELECT slot_time,duration_minutes INTO current_time_value,current_duration FROM slots WHERE id=NEW.slot_id;
  INSERT INTO booking_events(booking_id,service_type,event_type,old_slot_id,new_slot_id,old_time,new_time,
    old_duration,new_duration,old_status,new_status,attendance,payment_status,actor,reason)
  VALUES(NEW.id,replace(TG_TABLE_NAME,'_bookings',''),kind,previous_id,NEW.slot_id,previous_time,current_time_value,
    previous_duration,current_duration,previous_status,NEW.status,NEW.attendance,NEW.payment_status,
    COALESCE(NULLIF(current_setting('body_state.actor',true),''),'system'),
    COALESCE(current_setting('body_state.reason',true),''));
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION protect_booking_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Booking history is append-only; archive bookings instead' USING ERRCODE='23514'; END $$;
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['bfm_bookings','brt_bookings','psychology_bookings'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname=table_name||'_v2_events') THEN
      EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION append_booking_event()',table_name||'_v2_events',table_name);
    END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname=table_name||'_v2_no_delete') THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION protect_booking_history()',table_name||'_v2_no_delete',table_name);
    END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='booking_events_append_only') THEN
    CREATE TRIGGER booking_events_append_only BEFORE UPDATE OR DELETE ON booking_events FOR EACH ROW EXECUTE FUNCTION protect_booking_history();
  END IF;
END $$;
