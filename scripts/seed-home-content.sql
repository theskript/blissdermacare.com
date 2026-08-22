-- Seed home page admin-editable sections into site_content.
-- Run in Supabase SQL Editor.
-- Uses ON CONFLICT so re-running is safe.

INSERT INTO site_content (page_key, section_key, label, value, type, sort_order) VALUES
  -- ── Spray Tan Spotlight ────────────────────────────────────────────────
  ('home', 'spray_tan_visible',    'Spray Tan Section: Show/Hide',     'true',                              'text',     10),
  ('home', 'spray_tan_badge',      'Spray Tan: Badge Text',            'Just Added · Summer 2026',           'text',     11),
  ('home', 'spray_tan_h2',         'Spray Tan: Heading',               'Custom Airbrush Spray Tan',          'text',     12),
  ('home', 'spray_tan_desc',       'Spray Tan: Description',           'Look effortlessly sun-kissed all summer — without the UV damage. Our new professional airbrush spray tan is customized to your skin tone for a flawless, streak-free bronze that develops beautifully in hours and lasts over a week.', 'textarea', 13),
  ('home', 'spray_tan_bullets',    'Spray Tan: Feature Bullets (JSON array)', '["Custom shade matching — light, medium, dark & ultra dark","Vegan, paraben-free DHA — no orange cast, no streaks","Results last 7–10 days with proper aftercare","Also available as the Bronze & Bare Glow package with body waxing"]', 'json', 14),
  ('home', 'spray_tan_image',      'Spray Tan: Image URL',             '/images/spray-tan-service.jpg',      'image',    15),
  ('home', 'spray_tan_card_label', 'Spray Tan: Card Label',            'Newest service — Summer 2026',       'text',     16),
  ('home', 'spray_tan_card_sub',   'Spray Tan: Card Sub-label',        'Also available: Bronze & Bare Glow Package ($110 — save $20)', 'text', 17),

  -- ── New Service Categories section ────────────────────────────────────
  ('home', 'cats_section_h2',  'New Categories: Heading',    'Advanced Treatments & Semipermanent Makeup.',          'text', 20),
  ('home', 'cats_section_sub', 'New Categories: Subheading', 'Two new service lines — medical-grade aesthetic procedures and precision permanent makeup, now available at Bliss Dermacare.', 'textarea', 21),

  -- ── New This Season / Packages section ────────────────────────────────
  ('home', 'season_h2',  'Packages Strip: Heading',    'Advanced Treatments, Semipermanent Makeup, new facials & seasonal packages.', 'text', 30),
  ('home', 'season_sub', 'Packages Strip: Subheading', 'Two new treatment categories — Advanced Treatments and Semipermanent Makeup — plus enzyme facials, Dermaplane Glow, Smooth Canvas Facial, custom airbrush spray tan, and seasonal face & body packages.', 'textarea', 31),

  -- ── Membership Feature section ─────────────────────────────────────────
  ('home', 'membership_h2',  'Membership Section: Heading',    'Your skin deserves consistency. Make it a ritual.',  'text',     40),
  ('home', 'membership_sub', 'Membership Section: Subheading', 'Stop booking one-off appointments at full price. Our monthly plans lock in your favorite treatments at significant savings — with priority scheduling and exclusive member discounts every time you visit.', 'textarea', 41)

ON CONFLICT (page_key, section_key) DO UPDATE
  SET label = EXCLUDED.label,
      type  = EXCLUDED.type,
      sort_order = EXCLUDED.sort_order;
-- Note: value is NOT updated on conflict — preserves any edits the admin has made.
