-- Seed memberships page admin-editable credit descriptions.
-- Run in Supabase SQL Editor after updating credit prices.

INSERT INTO site_content (page_key, section_key, label, value, type, sort_order) VALUES
  ('memberships', 'tier1_facial_credit_desc', 'Tier 1: Facial Credit Description',
   'Choose from any eligible facial: Signature Radiance ($65), Teen Facial ($45), Smooth Canvas ($99), Anti-Aging ($99), Diamond Glow ($99) & more',
   'textarea', 10),
  ('memberships', 'tier2_facial_credit_desc', 'Tier 2: Premium Facial Credit Description',
   'Diamond Glow ($99), Smooth Canvas ($99), Microneedling ($130), Chemical Peel ($130), Anti-Aging ($99) + all Tier 1 facials',
   'textarea', 20),
  ('memberships', 'tier2_body_credit_desc', 'Tier 2: Lash/Body Credit Description',
   'Lash Lift & Brow Lamination ($65), Body & Face Waxing ($65), Brazilian Wax ($45), or Custom Spray Tan ($35)',
   'textarea', 21),
  ('memberships', 'tier3_lash_credit_desc', 'Tier 3 VIP: Lash Credit Description',
   'Full Lash Extensions ($65), Lash Fill ($55), or Lash Lift & Brow Lamination ($65)',
   'textarea', 30),
  ('memberships', 'tier3_body_credit_desc', 'Tier 3 VIP: Body Credit Description',
   'Body & Face Waxing ($65), Brazilian Wax ($45), or Custom Spray Tan ($35)',
   'textarea', 31)

ON CONFLICT (page_key, section_key) DO UPDATE
  SET label = EXCLUDED.label,
      type  = EXCLUDED.type,
      sort_order = EXCLUDED.sort_order;
