-- Seed seasonal packages into the services table
-- Run once in Supabase SQL Editor
-- Slugs must match the hardcoded checkbox values in src/pages/book/index.astro

INSERT INTO services (slug, name, category, price, duration, tagline, description, is_package, is_bookable, active, sort_order, updated_at)
VALUES
  (
    'lash-body-smooth',
    'Lash & Body Smooth',
    'packages',
    18500,   -- $185.00 in cents
    135,
    'Lash Extensions + Body Waxing',
    'Classic, hybrid, volume or mega lash set combined with full body & face waxing. Two sessions, 60 min each, with a 15-min break. Waxing: Age 21+.',
    true, true, true, 1,
    now()
  ),
  (
    'brow-lash-wax-ritual',
    'Brow, Lash & Wax Ritual',
    'packages',
    11500,   -- $115.00
    135,
    'Lash Lift + Brow Lamination + Waxing',
    'Lash lift & brow lamination with tinting, plus brow waxing. Lasts 6–8 weeks. Two sessions, 60 min each, with a 15-min break. Age 21+.',
    true, true, true, 2,
    now()
  ),
  (
    'glow-smooth-escape',
    'Glow & Smooth Escape',
    'packages',
    13500,   -- $135.00
    135,
    'Dermaplane Facial + Body Waxing',
    'Dermaplaning exfoliation & peach fuzz removal combined with full body & face waxing. Custom serum & hydration mask included. Age 21+.',
    true, true, true, 3,
    now()
  ),
  (
    'mix-match-package',
    'Mix & Match Escape',
    'packages',
    12900,   -- $129.00 starting price
    135,
    'Waxing + Your Choice of Service',
    'Body or face waxing (60 min) plus your choice of facial, lash, or wax service. $15 package discount applied off the combined total. Age 21+.',
    true, true, true, 4,
    now()
  ),
  (
    'bronze-bare-glow',
    'Bronze & Bare Glow',
    'packages',
    11000,   -- $110.00
    105,
    'Body Waxing + Custom Airbrush Spray Tan',
    'Full body waxing for the ultimate exfoliated canvas, followed by a custom airbrush spray tan matched to your skin tone. Vegan, paraben-free DHA. Age 21+ (waxing).',
    true, true, true, 5,
    now()
  )
ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  category    = EXCLUDED.category,
  price       = EXCLUDED.price,
  duration    = EXCLUDED.duration,
  tagline     = EXCLUDED.tagline,
  description = EXCLUDED.description,
  is_package  = EXCLUDED.is_package,
  is_bookable = EXCLUDED.is_bookable,
  active      = EXCLUDED.active,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = now();
