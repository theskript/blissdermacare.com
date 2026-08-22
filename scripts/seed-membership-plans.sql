-- Seed the 3 membership plans into the membership_plans table
-- Slugs match the data-plan attributes on src/pages/memberships/index.astro
-- Safe to re-run: ON CONFLICT updates price/name but preserves existing Stripe IDs

INSERT INTO membership_plans (slug, name, price, description, perks, sort_order, active)
VALUES
  (
    'glow-ritual',
    'The Glow Ritual',
    8900,   -- $89.00/month in cents
    'For the consistent skincare client who wants glowing skin year-round.',
    '["1 Facial Credit/month (up to $99 value — Signature Radiance, Pineapple Enzyme, Skin Recovery, Pumpkin Enzyme, or Teen Facial)", "10% off all additional services booked", "Priority scheduling — book before non-members", "Cancel or pause anytime"]',
    1,
    true
  ),
  (
    'radiance-plan',
    'The Radiance Plan',
    15900,  -- $159.00/month
    'Two services per month — a premium facial plus your choice of lash, brow, or body treatment.',
    '["1 Premium Facial Credit/month (up to $128 value — Diamond Glow, Brightening Peel, Dermaplane Glow, Chlorophyll, Smooth Canvas, High Frequency + all Tier 1 facials)", "1 Lash, Brow, or Body Credit/month (up to $87 value — Lash Lift & Brow Lamination, Body & Face Waxing, Brazilian Wax, or Spray Tan)", "15% off all additional services booked", "Priority scheduling — skip the waitlist", "Free skin consultation included", "Cancel or pause anytime"]',
    2,
    true
  ),
  (
    'vip-luxe',
    'The Bliss VIP',
    24900,  -- $249.00/month
    'Three services every month plus quarterly bonuses — the ultimate self-care routine at maximum savings.',
    '["1 Premium Facial Credit/month (any facial up to $128)", "1 Lash Service Credit/month (up to $159 value — Full Lash Extensions, Lash Fill, or Lash Lift & Brow Lamination)", "1 Body Treatment Credit/month (up to $87 value — Body & Face Waxing, Brazilian Wax, or Spray Tan)", "20% off all additional services & packages", "VIP first-access booking window", "Quarterly bonus: 1 complimentary seasonal package upgrade (up to $185 value)", "Free personalized skincare plan every 6 months", "Unused credits roll over 30 days", "Cancel or pause anytime"]',
    3,
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  price       = EXCLUDED.price,
  description = EXCLUDED.description,
  perks       = EXCLUDED.perks,
  sort_order  = EXCLUDED.sort_order,
  active      = EXCLUDED.active,
  updated_at  = now();
