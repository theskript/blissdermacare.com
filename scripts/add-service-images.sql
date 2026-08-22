-- Add image_url to services that have matching images in /public/images/
-- Run in Supabase SQL Editor

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

-- Verify
SELECT slug, name, image_url FROM services WHERE image_url IS NOT NULL ORDER BY category, name;
