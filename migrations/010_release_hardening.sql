ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS products_public_catalog_idx
  ON products (is_active, sort_order, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'brt_bookings_slot_id_fkey'
       AND conrelid = 'brt_bookings'::regclass
  ) THEN
    ALTER TABLE brt_bookings
      ADD CONSTRAINT brt_bookings_slot_id_fkey
      FOREIGN KEY (slot_id) REFERENCES slots(id) ON DELETE SET NULL;
  END IF;
END
$$;
