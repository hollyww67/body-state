-- Additive: historical prices are deliberately not reconstructed from today's prices.
ALTER TABLE bfm_bookings ADD COLUMN IF NOT EXISTS journey_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS access_hash text,
  ADD COLUMN IF NOT EXISTS hold_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS notification_revision integer NOT NULL DEFAULT 0;
ALTER TABLE brt_bookings ADD COLUMN IF NOT EXISTS journey_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS access_hash text,
  ADD COLUMN IF NOT EXISTS hold_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS notification_revision integer NOT NULL DEFAULT 0;
ALTER TABLE psychology_bookings ADD COLUMN IF NOT EXISTS journey_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS access_hash text,
  ADD COLUMN IF NOT EXISTS hold_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS notification_revision integer NOT NULL DEFAULT 0;
ALTER TABLE bfm_bookings ADD COLUMN IF NOT EXISTS request_key uuid UNIQUE;
ALTER TABLE brt_bookings ADD COLUMN IF NOT EXISTS request_key uuid UNIQUE;
ALTER TABLE psychology_bookings ADD COLUMN IF NOT EXISTS request_key uuid UNIQUE;

CREATE TABLE IF NOT EXISTS appointment_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  service_type text NOT NULL CHECK(service_type IN ('bfm','brt','psychology')),
  event_type text NOT NULL CHECK(event_type IN ('created','confirmed','rescheduled','cancelled','reminder')),
  revision integer NOT NULL,
  channel text NOT NULL CHECK(channel IN ('sms','email')),
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','retry','accepted','delivered','failed','not_configured','cancelled','uncertain')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  provider_message_id text,
  processing_at timestamptz,
  accepted_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(booking_id, service_type, event_type, revision, channel)
);
CREATE INDEX IF NOT EXISTS appointment_notifications_queue_idx ON appointment_notifications(next_attempt_at, scheduled_at) WHERE status IN ('queued','retry');
CREATE INDEX IF NOT EXISTS appointment_notifications_booking_idx ON appointment_notifications(service_type, booking_id);
CREATE TABLE IF NOT EXISTS payment_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  booking_id uuid,
  service_type text,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
  result text CHECK(result IN ('contacted_client','refund_handled_externally','new_booking_agreed','no_action_required')),
  comment text,
  updated_by text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id,reason)
);
CREATE TABLE IF NOT EXISTS payment_case_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES payment_cases(id) ON DELETE RESTRICT,
  actor text NOT NULL,
  status text NOT NULL,
  result text,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Surface pre-existing exceptions without changing bank or booking facts.
INSERT INTO payment_cases(order_id,booking_id,service_type,reason)
SELECT DISTINCT o.id,b.id,b.service,'paid_cancelled_booking'
FROM orders o
CROSS JOIN LATERAL jsonb_array_elements(o.items) item
JOIN (
  SELECT id,'bfm' AS service,status FROM bfm_bookings
  UNION ALL SELECT id,'brt',status FROM brt_bookings
  UNION ALL SELECT id,'psychology',status FROM psychology_bookings
) b ON b.id::text=item->>'bookingId' AND b.service=item->>'bookingType'
WHERE o.status IN ('paid','shipped','delivered') AND b.status='cancelled'
ON CONFLICT(order_id,reason) DO NOTHING;
