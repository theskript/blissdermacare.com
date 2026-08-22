-- Fix bad slugs that were entered with spaces or capital letters
-- Run once in Supabase SQL Editor
-- Also update any appointments that reference these slugs

UPDATE services SET slug = 'spray-tan',     updated_at = now() WHERE slug = 'Spray-Tan';
UPDATE services SET slug = 'chemical-peel', updated_at = now() WHERE slug = 'Chemical Peel';

-- Update appointment records that referenced the old slugs
UPDATE appointments SET services = replace(services, 'Spray-Tan',    'spray-tan')     WHERE services LIKE '%Spray-Tan%';
UPDATE appointments SET services = replace(services, 'Chemical Peel','chemical-peel') WHERE services LIKE '%Chemical Peel%';
