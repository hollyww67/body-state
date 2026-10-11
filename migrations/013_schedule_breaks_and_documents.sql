CREATE TABLE IF NOT EXISTS schedule_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text NOT NULL DEFAULT 'Перерыв',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (ends_at <= starts_at + interval '7 days')
);
CREATE INDEX IF NOT EXISTS schedule_breaks_time_idx ON schedule_breaks (starts_at, ends_at);

CREATE TABLE IF NOT EXISTS about_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS about_documents_sort_idx ON about_documents (sort_order, created_at);

UPDATE page_content
   SET title = CASE
     WHEN slug = 'bfm' THEN 'Физическая реабилитация'
     WHEN slug = 'psychology' THEN 'Психологическая реабилитация'
     ELSE title
   END,
       content = replace(
         replace(
           replace(content, 'Социально-психологическая реабилитация', 'Психологическая реабилитация'),
           'Биофасциальная модуляция', 'Физическая реабилитация'
         ),
         'БФМ', 'Физическая реабилитация'
       ),
       updated_at = now()
 WHERE slug IN ('home', 'rehabilitation', 'consultation', 'bfm', 'psychology');

UPDATE service_prices SET label = 'Физическая реабилитация', updated_at = now() WHERE code = 'bfm';
