ALTER TABLE psychology_rooms ADD COLUMN IF NOT EXISTS account_user_id uuid REFERENCES account_users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS psychology_rooms_account_idx ON psychology_rooms(account_user_id);
CREATE INDEX IF NOT EXISTS psychology_bookings_room_idx ON psychology_bookings(room_id) WHERE room_id IS NOT NULL;
-- Legacy rooms are retained, but require an assigned client for access.
UPDATE psychology_bookings SET room_id=gen_random_uuid()::text
WHERE booking_type='online' AND status='confirmed' AND payment_status='paid' AND room_id IS NULL;
