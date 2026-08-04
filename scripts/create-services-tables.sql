-- ─────────────────────────────────────────────────────────────────────────────
-- Run this in the Supabase SQL editor BEFORE deploying the services CMS.
-- ─────────────────────────────────────────────────────────────────────────────

-- Services
CREATE TABLE IF NOT EXISTS services (
  id             uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  slug           text    UNIQUE NOT NULL,
  name           text    NOT NULL,
  category       text    NOT NULL, -- facials | lash-brow-body | advanced | packages | semipermanent | wellness
  price          int     NOT NULL DEFAULT 0, -- in cents
  duration       int,                        -- in minutes
  description    text,
  tagline        text,
  image_url      text,
  is_package     boolean DEFAULT false,
  is_bookable    boolean DEFAULT true,       -- show in online booking form
  active         boolean DEFAULT true,
  sort_order     int     DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS services_category_idx ON services(category);
CREATE INDEX IF NOT EXISTS services_active_idx   ON services(active);

-- Membership plans
CREATE TABLE IF NOT EXISTS membership_plans (
  id                 uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  slug               text    UNIQUE NOT NULL,
  name               text    NOT NULL,
  price              int     NOT NULL, -- in cents per month
  stripe_price_id    text,             -- recurring Stripe Price ID (replaces env var)
  stripe_product_id  text,             -- Stripe Product ID
  description        text,
  perks              text[]  DEFAULT '{}',
  sort_order         int     DEFAULT 0,
  active             boolean DEFAULT true,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

-- ─── Seed services from the existing hardcoded list ───────────────────────────
INSERT INTO services (slug, name, category, price, duration, sort_order) VALUES
  -- Facials
  ('signature-radiance-facial',          'Signature Radiance Facial',            'facials',       9900,  60, 10),
  ('brightening-peel',                   'Brightening Peel',                     'facials',      12800,  60, 20),
  ('diamond-glow',                       'Diamond Glow',                         'facials',      11900,  60, 30),
  ('teen-skincare-facial',               'Teen Skincare Facial',                 'facials',       6400,  45, 40),
  ('high-frequency-skin-tightening',     'High Frequency Skin Tightening',       'facials',       9500,  60, 50),
  ('pumpkin-enzyme-facial',              'Pumpkin Enzyme Facial',                'facials',       8500,  60, 60),
  ('chlorophyll-skin-tightening-facial', 'Chlorophyll Skin Tightening Facial',   'facials',      10500,  60, 70),
  ('pineapple-enzyme-facial',            'Pineapple Enzyme Facial',              'facials',       8800,  60, 80),
  ('skin-recovery-facial',               'Skin Recovery Facial',                 'facials',       9200,  60, 90),
  ('dermaplane-glow-facial',             'Dermaplane Glow Facial',               'facials',      10500,  60,100),
  ('smooth-canvas-facial',               'Smooth Canvas Facial',                 'facials',       8900,  60,110),
  ('vampire-facial-prp',                 'Vampire Facial (PRP)',                 'facials',      38000,  90,120),
  -- Lash, Brow & Body
  ('lash-extensions',                    'Lash Extensions',                      'lash-brow-body',15900,120, 10),
  ('lash-extensions-fill',               'Lash Extensions Fill',                 'lash-brow-body', 4300, 60, 20),
  ('lash-lift-brow-lamination',          'Lash Lift & Brow Lamination',          'lash-brow-body', 7900, 60, 30),
  ('body-and-face-waxing',               'Body & Face Waxing',                   'lash-brow-body', 6500, 45, 40),
  ('brazilian-wax',                      'Brazilian Wax',                        'lash-brow-body', 8700, 45, 50),
  ('spray-tan',                          'Custom Airbrush Spray Tan',            'lash-brow-body', 6500, 30, 60),
  -- Advanced Treatments
  ('prp-treatment',                      'PRP (Platelet-Rich Plasma)',            'advanced',      39900, 90, 10),
  ('lip-filler',                         'Lip Filler',                           'advanced',      59900, 60, 20),
  ('ed-injectables',                     'Erectile Dysfunction Injectables',     'advanced',      49900, 60, 30),
  ('collagen-induction-therapy',         'Collagen Induction Therapy',           'advanced',      29900, 60, 40),
  ('weight-loss-program',                'Weight Loss Program (GLP-1/Semiglutide)','advanced',    29900, 60, 50),
  -- Semipermanent Makeup
  ('scalp-micropigmentation',            'Scalp Micropigmentation',              'semipermanent', 65000,180, 10),
  ('lip-neutralization',                 'Lip Neutralization',                   'semipermanent', 39900,120, 20),
  ('lip-blush',                          'Lip Blush',                            'semipermanent', 49900,150, 30),
  ('nano-brows',                         'Nano Brows',                           'semipermanent', 49900,150, 40),
  ('powder-brows',                       'Powder Brows',                         'semipermanent', 54900,150, 50),
  ('custom-semipermanent-makeup',        'Custom Semipermanent Makeup',          'semipermanent', 45000,120, 60),
  -- Wellness
  ('iv-hydration-therapy',               'IV Hydration Therapy',                 'wellness',      14900, 60, 10),
  ('lab-collection',                     'Personalized Lab Collection',          'wellness',      19900, 60, 20),
  ('hormone-lab-panel',                  'Hormone Lab Panel Support',            'wellness',      34900, 90, 30),
  ('regenerative-blood-services',        'Regenerative Blood-Based Services',    'wellness',      45000, 90, 40),
  -- Packages
  ('bronze-bare-glow',                   'Bronze & Bare Glow Package',           'packages',      11000,120, 10),
  ('lash-body-smooth',                   'Lash & Body Smooth Package',           'packages',      18500,120, 20),
  ('brow-lash-wax-ritual',               'Brow, Lash & Wax Ritual Package',      'packages',      11500,120, 30),
  ('glow-smooth-escape',                 'Glow & Smooth Escape Package',         'packages',      13500,120, 40),
  ('mix-match-package',                  'Mix & Match Escape Package',           'packages',      12900,120, 50),
  -- Other
  ('other',                              'Other / Not Sure',                     'facials',         100,  60,999)
ON CONFLICT (slug) DO NOTHING;

UPDATE services SET is_package = true WHERE category = 'packages';

-- ─── Seed membership plans ────────────────────────────────────────────────────
-- stripe_price_id: fill in your actual Stripe Price IDs below (or leave null
-- and update via the admin panel after creating prices in Stripe dashboard).
INSERT INTO membership_plans (slug, name, price, stripe_price_id, description, perks, sort_order) VALUES
  ('glow-ritual',   'The Glow Ritual Membership',   8900,  NULL,
   '1 facial credit/month + 10% off all additional services',
   ARRAY['1 facial credit per month','10% off all additional services','Priority booking'],
   10),
  ('radiance-plan', 'The Radiance Plan Membership', 15900, NULL,
   '1 premium facial + 1 lash/brow/body service + 15% off',
   ARRAY['1 premium facial per month','1 lash, brow, or body service per month','15% off all additional services','Priority booking'],
   20),
  ('vip-luxe',      'The Bliss VIP Membership',     24900, NULL,
   '1 facial + 1 lash + 1 body + 20% off + quarterly bonus',
   ARRAY['1 facial per month','1 lash service per month','1 body treatment per month','20% off all additional services','Quarterly seasonal package upgrade (up to $185 value)','Priority booking & dedicated esthetician'],
   30)
ON CONFLICT (slug) DO NOTHING;

-- Supabase Storage bucket for service images — run separately if needed:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('service-images', 'service-images', true)
-- ON CONFLICT DO NOTHING;
