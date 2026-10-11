ALTER TABLE bfm_bookings
  ADD COLUMN IF NOT EXISTS payment_option text NOT NULL DEFAULT 'online' CHECK (payment_option IN ('online', 'at_appointment')),
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'due'));

ALTER TABLE brt_bookings
  ADD COLUMN IF NOT EXISTS payment_option text NOT NULL DEFAULT 'online' CHECK (payment_option IN ('online', 'at_appointment')),
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'due'));

ALTER TABLE psychology_bookings
  ADD COLUMN IF NOT EXISTS payment_option text NOT NULL DEFAULT 'online' CHECK (payment_option IN ('online', 'at_appointment')),
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'due'));

UPDATE bfm_bookings SET payment_status='paid' WHERE status IN ('confirmed', 'completed') AND payment_status='pending';
UPDATE brt_bookings SET payment_status='paid' WHERE status IN ('confirmed', 'completed') AND payment_status='pending';
UPDATE psychology_bookings SET payment_status='paid' WHERE status IN ('confirmed', 'completed') AND payment_status='pending';
