-- Fixed prices for appointments paid immediately during booking.
INSERT INTO service_prices (code, label, price, prefix, is_active)
VALUES ('psychology', 'Психологическая реабилитация', 3000, '', true)
ON CONFLICT (code) DO NOTHING;

UPDATE service_prices
   SET prefix = '', updated_at = now()
 WHERE code IN ('bfm', 'brt', 'psychology');
