-- Fix duplicate service images and add missing images for newer services.
-- Run in Supabase SQL Editor. No null-guard — overwrites existing duplicates.

-- ── FACIALS ────────────────────────────────────────────────────────────────
-- Signature facial — professional facial treatment (woman, steam towel)
UPDATE services SET image_url = 'https://images.pexels.com/photos/3997993/pexels-photo-3997993.jpeg?auto=compress&cs=tinysrgb&w=600'
  WHERE slug = 'signature-radiance-facial';

-- Teen facial — young woman applying cleanser / acne care (different from above)
UPDATE services SET image_url = 'https://images.pexels.com/photos/3762875/pexels-photo-3762875.jpeg?auto=compress&cs=tinysrgb&w=600'
  WHERE slug = 'teen-skincare-facial';

-- Smooth Canvas Facial — local photo
UPDATE services SET image_url = '/images/smooth-canvas-facial.jpg'
  WHERE slug = 'smooth-canvas-facial';

-- Diamond Glow — local photo
UPDATE services SET image_url = '/images/diamond-glow.jpg'
  WHERE slug = 'diamond-glow';

-- Microneedling / Collagen Induction (handles both common slug variants)
UPDATE services SET image_url = '/images/collagen-induction-therapy.jpg'
  WHERE slug IN ('microneedling', 'microneedling-facial', 'collagen-induction-therapy');

-- PRP — medical blood-draw treatment (distinct from microneedling)
UPDATE services SET image_url = 'https://images.pexels.com/photos/29648626/pexels-photo-29648626.jpeg?auto=compress&cs=tinysrgb&w=600'
  WHERE slug IN ('prp-treatment', 'vampire-facial-prp');

-- ── LASH, BROW & BODY ──────────────────────────────────────────────────────
-- Full lash extension set — technician applying individual lashes (close-up)
UPDATE services SET image_url = 'https://images.pexels.com/photos/5128234/pexels-photo-5128234.jpeg?auto=compress&cs=tinysrgb&w=600'
  WHERE slug = 'lash-extensions';

-- Lash fill — same lash application scene but lighter session; use fill angle
UPDATE services SET image_url = 'https://images.pexels.com/photos/5128238/pexels-photo-5128238.jpeg?auto=compress&cs=tinysrgb&w=600'
  WHERE slug = 'lash-extensions-fill';

-- Lash Lift & Brow Lamination — brow shaping / lamination treatment
UPDATE services SET image_url = 'https://images.pexels.com/photos/5178001/pexels-photo-5178001.jpeg?auto=compress&cs=tinysrgb&w=600'
  WHERE slug = 'lash-lift-brow-lamination';

-- Body & Face Waxing — wax strips applied to leg/arm
UPDATE services SET image_url = 'https://images.pexels.com/photos/3757942/pexels-photo-3757942.jpeg?auto=compress&cs=tinysrgb&w=600'
  WHERE slug = 'body-and-face-waxing';

-- Brazilian Wax — different waxing image (warm wax application, distinct angle)
UPDATE services SET image_url = 'https://images.pexels.com/photos/4465124/pexels-photo-4465124.jpeg?auto=compress&cs=tinysrgb&w=600'
  WHERE slug = 'brazilian-wax';

-- Spray Tan — local photo
UPDATE services SET image_url = '/images/spray-tan-service.jpg'
  WHERE slug = 'spray-tan';

-- ── SEMIPERMANENT MAKEUP ───────────────────────────────────────────────────
UPDATE services SET image_url = '/images/nano-brows-treatment.jpg'         WHERE slug = 'nano-brows';
UPDATE services SET image_url = '/images/powder-brows-treatment.jpg'       WHERE slug = 'powder-brows';
UPDATE services SET image_url = '/images/lip-blush-treatment.jpg'          WHERE slug = 'lip-blush';
UPDATE services SET image_url = '/images/permanent-makeup-session.jpg'     WHERE slug = 'scalp-micropigmentation';
UPDATE services SET image_url = '/images/lip-filler-treatment.jpg'         WHERE slug = 'lip-filler';
UPDATE services SET image_url = '/images/lip-neutralization-treatment.jpg' WHERE slug = 'lip-neutralization';
UPDATE services SET image_url = '/images/eyebrow-permanent-makeup.jpg'     WHERE slug = 'custom-semipermanent-makeup';

-- ── ADVANCED TREATMENTS ────────────────────────────────────────────────────
UPDATE services SET image_url = '/images/ed-injectables-treatment.jpg'     WHERE slug = 'ed-injectables';
UPDATE services SET image_url = '/images/weight-loss-program.jpg'          WHERE slug = 'weight-loss-program';

-- ── ANCILLARY ─────────────────────────────────────────────────────────────
UPDATE services SET image_url = '/images/iv-hydration-therapy.jpg'         WHERE slug = 'iv-hydration-therapy';

-- ── PACKAGES ──────────────────────────────────────────────────────────────
-- Bronze & Bare Glow — local photo
UPDATE services SET image_url = '/images/bronze-bare-glow-package.jpg'
  WHERE slug = 'bronze-bare-glow';

-- Lash & Body Smooth — lash-focused package image (different number in lash series)
UPDATE services SET image_url = 'https://images.pexels.com/photos/5128234/pexels-photo-5128234.jpeg?auto=compress&cs=tinysrgb&w=600'
  WHERE slug = 'lash-body-smooth';

-- Glow & Smooth Escape — dermaplane facial local image
UPDATE services SET image_url = '/images/dermaplane-glow-facial.jpg'
  WHERE slug = 'glow-smooth-escape';

-- Brow, Lash & Wax Ritual — brow close-up (different Pexels ID from lash-lift page)
UPDATE services SET image_url = 'https://images.pexels.com/photos/5178003/pexels-photo-5178003.jpeg?auto=compress&cs=tinysrgb&w=600'
  WHERE slug = 'brow-lash-wax-ritual';

-- Mix & Match Escape — relaxed spa client (distinct spa scene)
UPDATE services SET image_url = 'https://images.pexels.com/photos/3985150/pexels-photo-3985150.jpeg?auto=compress&cs=tinysrgb&w=600'
  WHERE slug = 'mix-match-package';

-- ── VERIFY — shows slug, name, image_url for all services ─────────────────
SELECT slug, name, image_url FROM services ORDER BY category, name;
