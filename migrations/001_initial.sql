CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS page_content (
  id bigserial PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  meta_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text,
  content text NOT NULL DEFAULT '',
  image text,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS faq_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_time timestamptz NOT NULL,
  service_type text NOT NULL CHECK (service_type IN ('bfm', 'brt', 'psychology')),
  is_booked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slot_time, service_type)
);
CREATE INDEX IF NOT EXISTS slots_available_idx ON slots (service_type, slot_time) WHERE is_booked = false;

CREATE TABLE IF NOT EXISTS bfm_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid REFERENCES slots(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  client_phone text NOT NULL,
  client_email text,
  client_tg text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brt_bookings (LIKE bfm_bookings INCLUDING ALL);

CREATE TABLE IF NOT EXISTS psychology_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid REFERENCES slots(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  client_phone text NOT NULL,
  client_email text,
  client_tg text,
  booking_type text NOT NULL DEFAULT 'offline',
  room_id text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS program_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  client_phone text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consultation_enrollments (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL,
  message text,
  source text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  composition text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  volume_ml integer,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  category text NOT NULL DEFAULT 'care',
  subcategory text,
  popularity integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  client_phone text NOT NULL,
  address text NOT NULL DEFAULT 'Не указан',
  delivery text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  receipt_email text,
  receipt_phone text,
  payment_id text,
  payment_method text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_phone_idx ON orders (client_phone);
CREATE INDEX IF NOT EXISTS orders_payment_idx ON orders (payment_id);

CREATE TABLE IF NOT EXISTS reviews (
  id bigserial PRIMARY KEY,
  author_name text NOT NULL,
  text text NOT NULL,
  rating integer NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_gallery (
  id bigserial PRIMARY KEY,
  title text NOT NULL,
  description text,
  media_type text NOT NULL DEFAULT 'photo',
  before_image_url text,
  after_image_url text,
  video_url text,
  thumbnail_url text,
  category text,
  client_name text,
  service_type text,
  is_published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS psychology_programs (
  id bigserial PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  duration text,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS psychology_rooms (
  id bigserial PRIMARY KEY,
  room_id text NOT NULL UNIQUE,
  room_name text NOT NULL,
  created_by text NOT NULL,
  meeting_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_tokens (
  token text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bfm_bookings_contact_idx ON bfm_bookings (client_phone, client_email);
CREATE INDEX IF NOT EXISTS brt_bookings_contact_idx ON brt_bookings (client_phone, client_email);
CREATE INDEX IF NOT EXISTS psychology_bookings_contact_idx ON psychology_bookings (client_phone, client_email);
