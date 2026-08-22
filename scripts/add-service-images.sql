-- Add image_url to services. Run in Supabase SQL Editor.
-- Local /images/ files take priority; Pexels CDN used as fallback for services without local images.

-- ── Local images ───────────────────────────────────────────────────────────
UPDATE services SET image_url = '/images/diamond-glow.jpg'               WHERE slug = 'diamond-glow'               AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = '/images/smooth-canvas-facial.jpg'        WHERE slug = 'smooth-canvas-facial'        AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = '/images/spray-tan-service.jpg'           WHERE slug = 'spray-tan'                   AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = '/images/bronze-bare-glow-package.jpg'    WHERE slug = 'bronze-bare-glow'            AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = '/images/iv-hydration-therapy.jpg'        WHERE slug = 'iv-hydration-therapy'        AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = '/images/lip-blush-treatment.jpg'         WHERE slug = 'lip-blush'                   AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = '/images/lip-filler-treatment.jpg'        WHERE slug = 'lip-filler'                  AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = '/images/nano-brows-treatment.jpg'        WHERE slug = 'nano-brows'                  AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = '/images/powder-brows-treatment.jpg'      WHERE slug = 'powder-brows'                AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = '/images/weight-loss-program.jpg'         WHERE slug = 'weight-loss-program'         AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = '/images/ed-injectables-treatment.jpg'    WHERE slug = 'ed-injectables'              AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = '/images/collagen-induction-therapy.jpg'  WHERE slug = 'collagen-induction-therapy'  AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = '/images/collagen-induction-therapy.jpg'  WHERE slug = 'prp-treatment'               AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = '/images/permanent-makeup-session.jpg'    WHERE slug = 'scalp-micropigmentation'     AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = '/images/eyebrow-permanent-makeup.jpg'    WHERE slug = 'nano-brows'                  AND image_url IS NULL;
UPDATE services SET image_url = '/images/dermaplane-glow-facial.jpg'      WHERE slug = 'glow-smooth-escape'          AND (image_url IS NULL OR image_url = '');

-- ── Pexels CDN fallbacks (services without a local image) ──────────────────
UPDATE services SET image_url = 'https://images.pexels.com/photos/3997993/pexels-photo-3997993.jpeg?auto=compress&cs=tinysrgb&w=600'
  WHERE slug = 'signature-radiance-facial'  AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = 'https://images.pexels.com/photos/3997993/pexels-photo-3997993.jpeg?auto=compress&cs=tinysrgb&w=600'
  WHERE slug = 'teen-skincare-facial'       AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = 'https://images.pexels.com/photos/5128234/pexels-photo-5128234.jpeg?auto=compress&cs=tinysrgb&w=600'
  WHERE slug = 'lash-extensions'            AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = 'https://images.pexels.com/photos/5128234/pexels-photo-5128234.jpeg?auto=compress&cs=tinysrgb&w=600'
  WHERE slug = 'lash-extensions-fill'       AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = 'https://images.pexels.com/photos/5178001/pexels-photo-5178001.jpeg?auto=compress&cs=tinysrgb&w=600'
  WHERE slug = 'lash-lift-brow-lamination'  AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = 'https://images.pexels.com/photos/3757942/pexels-photo-3757942.jpeg?auto=compress&cs=tinysrgb&w=600'
  WHERE slug = 'body-and-face-waxing'       AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = 'https://images.pexels.com/photos/3757942/pexels-photo-3757942.jpeg?auto=compress&cs=tinysrgb&w=600'
  WHERE slug = 'brazilian-wax'              AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = 'https://images.pexels.com/photos/5128234/pexels-photo-5128234.jpeg?auto=compress&cs=tinysrgb&w=600'
  WHERE slug = 'lash-body-smooth'           AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = 'https://images.pexels.com/photos/5178001/pexels-photo-5178001.jpeg?auto=compress&cs=tinysrgb&w=600'
  WHERE slug = 'brow-lash-wax-ritual'       AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = 'https://images.pexels.com/photos/3757942/pexels-photo-3757942.jpeg?auto=compress&cs=tinysrgb&w=600'
  WHERE slug = 'mix-match-package'          AND (image_url IS NULL OR image_url = '');
UPDATE services SET image_url = 'https://images.pexels.com/photos/29648626/pexels-photo-29648626.jpeg?auto=compress&cs=tinysrgb&w=600'
  WHERE slug = 'vampire-facial-prp'         AND (image_url IS NULL OR image_url = '');

-- Verify
SELECT slug, name, image_url FROM services ORDER BY category, name;
