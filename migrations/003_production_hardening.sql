-- Columns used by the application but missing from the original standalone schema.
ALTER TABLE page_content ADD COLUMN IF NOT EXISTS meta_keywords text;
ALTER TABLE page_content ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE faq_answers ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';

ALTER TABLE orders ADD COLUMN IF NOT EXISTS external_order_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_url text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_data jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_released_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_issue boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS orders_external_order_id_idx ON orders (external_order_id) WHERE external_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_id_unique_idx ON orders (payment_id) WHERE payment_id IS NOT NULL;

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS reviews_product_created_idx ON reviews (product_id, created_at DESC);

ALTER TABLE bfm_bookings ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
ALTER TABLE brt_bookings ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
ALTER TABLE psychology_bookings ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
ALTER TABLE psychology_bookings ADD COLUMN IF NOT EXISTS program_id bigint REFERENCES psychology_programs(id) ON DELETE SET NULL;

ALTER TABLE orders ALTER COLUMN address SET DEFAULT 'Не указан';
