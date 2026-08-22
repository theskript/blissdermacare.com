-- Add Seasonal Packages to service_categories so it appears in "Also Explore" on category pages.
-- Run in Supabase SQL Editor.

INSERT INTO service_categories (slug, name, tagline, description, page_url, active, sort_order)
VALUES (
  'packages',
  'Seasonal Packages',
  'Summer 2026',
  'Two services, one visit — save up to $27. Limited seasonal availability.',
  '/services/packages/',
  true,
  6
)
ON CONFLICT (slug) DO UPDATE SET
  name       = EXCLUDED.name,
  active     = true,
  sort_order = EXCLUDED.sort_order;
