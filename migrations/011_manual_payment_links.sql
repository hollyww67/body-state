-- Admin-generated T-Bank payment links need a longer lifetime than checkout orders.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_link_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS orders_pending_payment_links_idx
  ON orders (payment_link_expires_at)
  WHERE payment_method = 'tinkoff_link' AND status = 'pending';
