-- Service categories table — admin-manageable category definitions
CREATE TABLE IF NOT EXISTS service_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        VARCHAR(60)  UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  tagline     VARCHAR(200),
  description TEXT,
  page_url    VARCHAR(200),
  image_url   TEXT,
  sort_order  INTEGER DEFAULT 0,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

INSERT INTO service_categories (slug, name, tagline, page_url, sort_order) VALUES
  ('facials',        'Facials',                'Dermaplaning · Enzyme Facials · Peels · PRP · & more',      '/services/facials/',              1),
  ('lash-brow-body', 'Lash, Brow & Body',      'Lash Extensions · Waxing · Spray Tan · Scalp Therapy',      '/services/lash-brow-body/',        2),
  ('advanced',       'Advanced Treatments',    'PRP · Lip Filler · Injectables · CIT · Weight Loss',        '/services/advanced-treatments/',   3),
  ('semipermanent',  'Semipermanent Makeup',   'Nano Brows · Powder Brows · Lip Blush · Scalp SMP',         '/services/semipermanent-makeup/',  4),
  ('wellness',       'Ancillary Services',     'IV Hydration · Lab Collection · Hormone Panel · Regenerative','/services/ancillary/',            5),
  ('packages',       'Seasonal Packages',      'Two services · One visit · Up to $27 savings',              '/services/packages/',              6)
ON CONFLICT (slug) DO NOTHING;
