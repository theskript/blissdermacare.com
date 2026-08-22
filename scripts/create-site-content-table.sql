-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS site_content (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  page_key    text    NOT NULL,   -- 'home' | 'about' | 'faq' | 'contact' | 'services'
  section_key text    NOT NULL,   -- e.g. 'hero_h1', 'about_p1', 'faq_items'
  label       text    NOT NULL,   -- admin display label
  type        text    NOT NULL DEFAULT 'text',  -- 'text' | 'textarea' | 'html' | 'image' | 'json'
  value       text,
  sort_order  int     DEFAULT 0,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(page_key, section_key)
);

CREATE INDEX IF NOT EXISTS site_content_page_idx ON site_content(page_key);

-- ─── Seed: About page ─────────────────────────────────────────────────────────
INSERT INTO site_content (page_key, section_key, label, type, value, sort_order) VALUES
  ('about', 'hero_h1',      'Page Heading',             'text',     'About Bliss Dermacare',                                                  10),
  ('about', 'hero_sub',     'Page Subtitle',            'text',     'Built on science, delivered with care — right here in Tampa, FL.',        20),
  ('about', 'about_h2',     'Section Heading',          'text',     'Professional skincare done right.',                                       30),
  ('about', 'about_p1',     'About Paragraph 1',        'textarea', 'At Bliss Dermacare, we believe great skin starts with great science and genuine care. We''re a Florida-licensed skincare studio based in Tampa, combining proven techniques with personalized treatment plans built around your unique skin.', 40),
  ('about', 'about_p2',     'About Paragraph 2',        'textarea', 'Whether you''re tackling acne, hyperpigmentation, signs of aging, or just want a consistent glow — every session is tailored to your specific goals, never a generic template.', 50),
  ('about', 'stat1',        'Stat 1 (e.g. FL)',         'text',     'FL',                                                                      60),
  ('about', 'stat1_label',  'Stat 1 Label',             'text',     'Licensed Esthetician',                                                    70),
  ('about', 'stat2',        'Stat 2 (e.g. 7+)',         'text',     '7+',                                                                      80),
  ('about', 'stat2_label',  'Stat 2 Label',             'text',     'Years of Experience',                                                     90),
  ('about', 'stat3',        'Stat 3 (e.g. 5.0★)',       'text',     '5.0★',                                                                  100),
  ('about', 'stat3_label',  'Stat 3 Label',             'text',     'Average Client Rating',                                                  110),
  ('about', 'why_h2',       'Why Us Heading',           'text',     'No shortcuts. No cookie-cutter treatments.',                             120),
  ('about', 'why_sub',      'Why Us Subtitle',          'text',     'We care about long-term skin health, not just one good session.',         130),
  ('about', 'card1_title',  'Card 1 Title',             'text',     'Personalized Every Time',                                                140),
  ('about', 'card1_text',   'Card 1 Text',              'textarea', 'Your skin is assessed at every appointment. The treatment adapts to how your skin is behaving that day — not a preset menu item.', 150),
  ('about', 'card2_title',  'Card 2 Title',             'text',     'Professional-Grade Products',                                            160),
  ('about', 'card2_text',   'Card 2 Text',              'textarea', 'We use medical-grade, clinically tested products — not what you find off the shelf. Real results come from real formulations.', 170),
  ('about', 'card3_title',  'Card 3 Title',             'text',     'Building Long-Term Results',                                             180),
  ('about', 'card3_text',   'Card 3 Text',              'textarea', 'We''re not here for one good session. We track your progress, adjust when needed, and help you build a home care routine that sticks.', 190),
  ('about', 'cta_h2',       'CTA Heading',              'text',     'Let''s get started.',                                                    200),
  ('about', 'cta_p',        'CTA Paragraph',            'textarea', 'Not sure which treatment is right for you? Schedule a free skin assessment and we''ll build a plan together.', 210)
ON CONFLICT (page_key, section_key) DO NOTHING;

-- ─── Seed: FAQ page ───────────────────────────────────────────────────────────
INSERT INTO site_content (page_key, section_key, label, type, value, sort_order) VALUES
  ('faq', 'hero_h1',  'Page Heading',  'text',  'FAQ',                                                                         10),
  ('faq', 'hero_sub', 'Page Subtitle', 'text',  'Everything you need to know before your first (or next) appointment.',         20),
  ('faq', 'items',    'FAQ Items (JSON — array of {q, a} objects)', 'json',
   '[{"q":"Do you offer membership or recurring plans?","a":"Yes — we offer three monthly membership tiers: The Glow Ritual ($89/mo), The Radiance Plan ($159/mo), and The Bliss VIP ($249/mo). Each plan includes monthly service credits, priority booking, and a member discount on additional services."},{"q":"Do I need an appointment, or can I walk in?","a":"Appointments are required. We''re a private studio, not a drop-in salon. Book online through our booking page or reach out directly by phone or text."},{"q":"How do I know which treatment is right for me?","a":"Not sure where to start? That''s what our free consultation is for. Submit a consultation request and we''ll reach out to assess your skin type, concerns, and goals."},{"q":"What should I do before and after a facial?","a":"Before: Avoid retinoids, exfoliants, and waxing for at least 48 hours prior. Arrive with clean skin if possible. After: Skip heavy makeup for 24 hours, avoid direct sun exposure, stay hydrated."},{"q":"What payment methods do you accept?","a":"We accept all major credit cards (Visa, Mastercard, Amex), cash, Zelle, Venmo, and Apple Pay. Payment is collected at the time of service."},{"q":"What is your cancellation policy?","a":"We ask for at least 24 hours notice if you need to cancel or reschedule. Late cancellations or no-shows may be subject to a cancellation fee."}]',
   30)
ON CONFLICT (page_key, section_key) DO NOTHING;

-- ─── Seed: Contact page ───────────────────────────────────────────────────────
INSERT INTO site_content (page_key, section_key, label, type, value, sort_order) VALUES
  ('contact', 'hero_h1',       'Page Heading',          'text',  'Contact Us',                                    10),
  ('contact', 'hero_sub',      'Page Subtitle',         'text',  'Questions, concerns, or just want to say hello — we respond quickly.', 20),
  ('contact', 'phone',         'Phone Number',          'text',  '(609) 366-0857',                                30),
  ('contact', 'phone_hours',   'Phone Hours',           'text',  'Mon–Fri, 10 AM – 7 PM',                        40),
  ('contact', 'email',         'Email Address',         'text',  'info@blissdermacare.com',                       50),
  ('contact', 'email_sub',     'Email Sub-label',       'text',  'We respond within 24 hours',                    60),
  ('contact', 'instagram',     'Instagram Handle',      'text',  '@blissdermacare',                               70),
  ('contact', 'instagram_sub', 'Instagram Sub-label',   'text',  'DMs welcome — we''re active daily',              80),
  ('contact', 'address_1',     'Address Line 1',        'text',  '8905 Regents Park Dr',                          90),
  ('contact', 'address_2',     'Address Line 2',        'text',  'Tampa, FL 33647',                              100),
  ('contact', 'address_note',  'Address Note',          'text',  'We operate as a private studio — appointments required.', 110),
  ('contact', 'cta_h2',        'CTA Heading',           'text',  'Ready to book?',                               120),
  ('contact', 'cta_p',         'CTA Paragraph',         'text',  'Submit a booking request online and we''ll confirm within 24 hours.', 130)
ON CONFLICT (page_key, section_key) DO NOTHING;

-- ─── Seed: Home page ──────────────────────────────────────────────────────────
INSERT INTO site_content (page_key, section_key, label, type, value, sort_order) VALUES
  ('home', 'hero_h1',  'Hero Heading',    'text',     'Clinical skincare with a softer, more personal approach.', 10),
  ('home', 'hero_sub', 'Hero Subheading', 'textarea', 'Bliss Dermacare offers customized facials and skin-focused treatments designed to restore clarity, calm, and confidence without the rushed feel of a typical medspa visit.', 20)
ON CONFLICT (page_key, section_key) DO NOTHING;

-- ─── Seed: Services page ─────────────────────────────────────────────────────
INSERT INTO site_content (page_key, section_key, label, type, value, sort_order) VALUES
  ('services', 'hero_h1',  'Page Heading',  'text', 'Our Services',                                                                                                                          10),
  ('services', 'hero_sub', 'Page Subtitle', 'text', 'Every treatment is personalized. Browse by category to find what''s right for you, then book your appointment.', 20)
ON CONFLICT (page_key, section_key) DO NOTHING;
