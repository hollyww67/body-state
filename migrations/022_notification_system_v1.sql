-- Expand-only, no historical backfill/replay. Apply after schema021.
ALTER TABLE appointment_notifications ALTER COLUMN booking_id DROP NOT NULL;
ALTER TABLE appointment_notifications ALTER COLUMN service_type DROP NOT NULL;
ALTER TABLE appointment_notifications DROP CONSTRAINT appointment_notifications_event_type_check;
ALTER TABLE appointment_notifications ADD CONSTRAINT appointment_notifications_event_type_check
 CHECK(event_type IN ('created','confirmed','rescheduled','cancelled','reminder','reminder_24h','reminder_2h','paid','reset_requested','password_changed','delivery_alert'));
ALTER TABLE appointment_notifications DROP CONSTRAINT appointment_notifications_channel_check;
ALTER TABLE appointment_notifications ADD CONSTRAINT appointment_notifications_channel_check CHECK(channel IN ('sms','email','max'));
ALTER TABLE appointment_notifications ADD COLUMN engine text NOT NULL DEFAULT 'legacy' CHECK(engine IN ('legacy','v1'));
ALTER TABLE appointment_notifications ADD COLUMN event_key text UNIQUE;
ALTER TABLE appointment_notifications ADD COLUMN account_user_id uuid REFERENCES account_users(id) ON DELETE RESTRICT;
ALTER TABLE appointment_notifications ADD COLUMN payload jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE appointment_notifications ADD COLUMN recipient_role text NOT NULL DEFAULT 'client' CHECK(recipient_role IN ('client','admin'));
-- The old uniqueness domain remains exact for legacy workers. V1 has an explicit
-- logical event key (including recipient role); do not silently suppress a V1 event
-- because a historical legacy row has the same booking revision.
DO $$ DECLARE item record; BEGIN
 FOR item IN SELECT conname FROM pg_constraint WHERE conrelid='appointment_notifications'::regclass
   AND contype='u' AND pg_get_constraintdef(oid)='UNIQUE (booking_id, service_type, event_type, revision, channel)' LOOP
   EXECUTE format('ALTER TABLE appointment_notifications DROP CONSTRAINT %I',item.conname);
 END LOOP;
END $$;
CREATE UNIQUE INDEX appointment_notifications_legacy_event ON appointment_notifications(booking_id,service_type,event_type,revision,channel) WHERE engine='legacy';
ALTER TABLE appointment_notifications ADD CONSTRAINT appointment_notifications_v1_key CHECK(engine='legacy' OR event_key IS NOT NULL);
CREATE INDEX appointment_notifications_v1_queue ON appointment_notifications(next_attempt_at,id) WHERE engine='v1' AND status IN ('queued','retry');
CREATE TABLE notification_channel_activation (
 channel text PRIMARY KEY CHECK(channel IN ('email','max')),
 activated_at timestamptz NOT NULL
);
CREATE TABLE account_notification_settings (
 account_user_id uuid PRIMARY KEY REFERENCES account_users(id) ON DELETE CASCADE,
 reminders_24h boolean NOT NULL DEFAULT true,
 reminders_2h boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE max_pairing_codes (
 account_user_id uuid PRIMARY KEY REFERENCES account_users(id) ON DELETE CASCADE,
 code_hash text UNIQUE NOT NULL CHECK(code_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX max_pairing_codes_expiry ON max_pairing_codes(expires_at);
CREATE TABLE max_account_bindings (
 account_user_id uuid PRIMARY KEY REFERENCES account_users(id) ON DELETE CASCADE,
 max_user_id text UNIQUE NOT NULL, max_chat_id text UNIQUE NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE max_incoming_updates (
 update_key text PRIMARY KEY CHECK(update_key ~ '^[a-f0-9]{64}$'),
 update_type text NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz
);
CREATE TABLE max_admin_pairing (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 code_hash text UNIQUE NOT NULL CHECK(code_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz NOT NULL,
 pending_user_id text, pending_chat_id text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE max_admin_binding (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 max_user_id text UNIQUE NOT NULL, max_chat_id text UNIQUE NOT NULL,
 confirmed_at timestamptz NOT NULL DEFAULT now()
);
