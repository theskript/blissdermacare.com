-- Comprehensive site_content seed — run once in Supabase SQL Editor
-- Uses ON CONFLICT DO NOTHING so existing admin edits are preserved

-- ── Contact page ──────────────────────────────────────────────────────────────
INSERT INTO site_content (page_key, section_key, label, type, value, sort_order) VALUES
  ('contact', 'hero_h1',      'Page Title',             'text', 'Contact Us',                                                         1),
  ('contact', 'hero_sub',     'Page Subtitle',           'text', 'Questions, concerns, or just want to say hello — we respond quickly.', 2),
  ('contact', 'phone',        'Phone Number',            'text', '(609) 366-0857',                                                      3),
  ('contact', 'phone_hours',  'Phone Hours',             'text', 'Mon–Fri, 10 AM – 7 PM',                                              4),
  ('contact', 'email',        'Email Address',           'text', 'info@blissdermacare.com',                                             5),
  ('contact', 'email_sub',    'Email Response Note',     'text', 'We respond within 24 hours',                                          6),
  ('contact', 'instagram',    'Instagram Handle',        'text', '@blissdermacare',                                                     7),
  ('contact', 'instagram_sub','Instagram Sub-Text',      'text', 'DMs welcome — we''re active daily',                                  8),
  ('contact', 'address_1',    'Address Line 1',          'text', '8905 Regents Park Dr',                                               9),
  ('contact', 'address_2',    'Address Line 2',          'text', 'Tampa, FL 33647',                                                    10),
  ('contact', 'address_note', 'Studio Note',             'text', 'We operate as a private studio — appointments required.',            11),
  ('contact', 'cta_h2',       'CTA Heading',             'text', 'Ready to book?',                                                     12),
  ('contact', 'cta_p',        'CTA Paragraph',           'text', 'Submit a booking request online and we''ll confirm within 24 hours.',13)
ON CONFLICT (page_key, section_key) DO NOTHING;

-- ── About page ────────────────────────────────────────────────────────────────
INSERT INTO site_content (page_key, section_key, label, type, value, sort_order) VALUES
  ('about', 'hero_h1',     'Page Title',           'text',     'About Bliss Dermacare',                                                                      1),
  ('about', 'hero_sub',    'Page Subtitle',         'text',     'Built on science, delivered with care — right here in Tampa, FL.',                           2),
  ('about', 'about_h2',    'Who We Are Heading',    'text',     'Professional skincare done right.',                                                          3),
  ('about', 'about_p1',    'About Paragraph 1',     'textarea', 'At Bliss Dermacare, we believe great skin starts with great science and genuine care. We''re a Florida-licensed skincare studio based in Tampa, combining proven techniques with personalized treatment plans built around your unique skin.', 4),
  ('about', 'about_p2',    'About Paragraph 2',     'textarea', 'Whether you''re tackling acne, hyperpigmentation, signs of aging, or just want a consistent glow — every session is tailored to your specific goals, never a generic template.', 5),
  ('about', 'stat1',       'Stat 1 Value',          'text',     'FL',                                                                                         6),
  ('about', 'stat1_label', 'Stat 1 Label',          'text',     'Licensed Esthetician',                                                                       7),
  ('about', 'stat2',       'Stat 2 Value',          'text',     '7+',                                                                                         8),
  ('about', 'stat2_label', 'Stat 2 Label',          'text',     'Years of Experience',                                                                        9),
  ('about', 'stat3',       'Stat 3 Value',          'text',     '5.0★',                                                                                      10),
  ('about', 'stat3_label', 'Stat 3 Label',          'text',     'Average Client Rating',                                                                     11),
  ('about', 'why_h2',      'Why Us Heading',        'text',     'No shortcuts. No cookie-cutter treatments.',                                                 12),
  ('about', 'why_sub',     'Why Us Subtitle',       'text',     'We care about long-term skin health, not just one good session.',                            13),
  ('about', 'cta_h2',      'CTA Heading',           'text',     'Let''s get started.',                                                                       14),
  ('about', 'cta_p',       'CTA Paragraph',         'text',     'Not sure which treatment is right for you? Schedule a free skin assessment and we''ll build a plan together.', 15)
ON CONFLICT (page_key, section_key) DO NOTHING;

-- ── FAQ page ──────────────────────────────────────────────────────────────────
INSERT INTO site_content (page_key, section_key, label, type, value, sort_order) VALUES
  ('faq', 'hero_h1', 'Page Title',    'text', 'FAQ',                                                                              1),
  ('faq', 'hero_sub','Page Subtitle', 'text', 'Everything you need to know before your first (or next) appointment.',             2),
  ('faq', 'items',   'FAQ Items',     'json', '[
    {"q":"Do you offer membership or recurring plans?","a":"Yes — we offer three monthly membership tiers: The Glow Ritual ($89/mo), The Radiance Plan ($159/mo), and The Bliss VIP ($249/mo). Each plan includes monthly service credits, priority booking, and a member discount on additional services. Credits roll over 30 days (VIP only), and you can cancel or pause anytime. Visit our <a href=''/memberships/'' class=''text-primary-600 hover:underline''>memberships page</a> to compare plans and sign up."},
    {"q":"Do I need an appointment, or can I walk in?","a":"Appointments are required. We''re a private studio, not a drop-in salon. Book online through our booking page or reach out directly by phone or text. Same-day appointments may be available depending on the schedule — just ask."},
    {"q":"How do I know which treatment is right for me?","a":"Not sure where to start? That''s what our free consultation is for. Submit a consultation request and we''ll reach out to assess your skin type, concerns, and goals — then recommend the best starting point. No pressure, no upselling."},
    {"q":"What''s included in the Demo Model Program?","a":"The Demo Model Program gives you access to professional skincare treatments at 50–80% off the standard rate. You''ll receive the exact same products and expertise as any other client. In return, we ask for honest feedback and — optionally, with your written consent — to document your results. Availability is limited and varies by what techniques are being practiced."},
    {"q":"Do you offer injectable treatments like PRP, lip filler, or weight loss injections?","a":"Yes — we now offer a full Advanced Treatments menu including PRP (Platelet-Rich Plasma) therapy, Lip Filler, Erectile Dysfunction Injectables, Collagen Induction Therapy (microneedling), and a GLP-1/Semiglutide-assisted Weight Loss Program. All injectable services are performed professionally and require a standalone booking. Visit our <a href=''/services/advanced-treatments/'' class=''text-primary-600 hover:underline''>Advanced Treatments section</a> for details and pricing."},
    {"q":"What is semipermanent makeup and how long does it last?","a":"Semipermanent makeup uses pigment deposited into the upper layers of the skin to create long-lasting cosmetic enhancements. We offer Nano Brows, Powder Brows, Lip Blush, Scalp Micropigmentation, and Custom treatments. Results typically last 1–3 years depending on the technique and your skin type, with a touch-up recommended at 6–12 months."},
    {"q":"What should I do before and after a facial or treatment?","a":"Before: Avoid retinoids, exfoliants, and waxing for at least 48 hours prior. Arrive with clean skin if possible. After: Skip heavy makeup for 24 hours, avoid direct sun exposure, stay hydrated, and follow the specific aftercare instructions given to you post-treatment."},
    {"q":"Do you offer in-home (mobile) services?","a":"Yes — through our Luxury In-Home Experience package. We bring the same professional equipment and products to your home. A brief consultation call is required before your first mobile booking. Service is available within a 10-mile radius of Tampa, FL. Travel fees may apply."},
    {"q":"What payment methods do you accept?","a":"We accept all major credit cards (Visa, Mastercard, Amex), cash, Zelle, Venmo, and Apple Pay. Payment is collected at the time of service."},
    {"q":"What is your cancellation policy?","a":"We ask for at least 24 hours notice if you need to cancel or reschedule. Late cancellations or no-shows may be subject to a cancellation fee. Life happens — just communicate with us and we''ll do our best to work it out."}
  ]', 3)
ON CONFLICT (page_key, section_key) DO NOTHING;

-- ── Careers page job openings ─────────────────────────────────────────────────
INSERT INTO site_content (page_key, section_key, label, type, value, sort_order) VALUES
  ('careers', 'hero_h1', 'Page Title',    'text', 'Join Our Team',                                                                          1),
  ('careers', 'hero_sub','Page Subtitle', 'text', 'We''re looking for passionate, skilled professionals who care deeply about skincare and the people they serve.', 2),
  ('careers', 'openings','Job Openings',  'json', '[
    {"title":"Licensed Esthetician","type":"Full-time or Part-time","typeColor":"bg-primary-100 text-primary-700","description":"Join our client-facing team delivering customized facials, chemical peels, and advanced skin treatments. You''ll work one-on-one with clients in a private, calm studio setting — no rushed medspa energy.","requirements":["Active Florida State Esthetician License (required)","1+ years of professional experience preferred (new grads welcome to apply)","Experience with facials, extractions, and chemical peels","Strong communication and client care skills","Passion for skincare education and results-driven care"],"preferred":["Experience with microneedling, LED therapy, or lash/brow services","Familiarity with professional skincare brands (PCA Skin, Dermalogica, etc.)"]},
    {"title":"Client Experience Coordinator","type":"Part-time","typeColor":"bg-neutral-100 text-neutral-700","description":"Be the first point of contact for our clients — managing bookings, responding to inquiries, and keeping the studio running smoothly.","requirements":["Excellent written and verbal communication skills","Highly organized with strong attention to detail","Comfortable managing scheduling, follow-ups, and client communication","Professional demeanor and reliability"],"preferred":["Background in beauty, wellness, or hospitality","Experience with booking platforms or CRM tools","Social media savvy (helpful for occasional content support)"]},
    {"title":"Part-time / Seasonal Esthetician","type":"Flexible","typeColor":"bg-amber-100 text-amber-700","description":"Looking for flexible, high-quality work without a rigid schedule? We schedule part-time and seasonal estheticians to support demand during peak periods.","requirements":["Active Florida State Esthetician License (required)","Availability for at least 2 days per week","Reliable, professional, and client-focused"],"preferred":["At least one specialized service beyond basic facials","Comfortable working independently in a private studio setting"]}
  ]', 3)
ON CONFLICT (page_key, section_key) DO NOTHING;

-- ── Global: discount percentages ─────────────────────────────────────────────
INSERT INTO site_content (page_key, section_key, label, type, value, sort_order) VALUES
  ('global', 'discount_first_responder_veteran', 'Community Discount: First Responder / Veteran (%)', 'text', '15', 30),
  ('global', 'discount_teacher_educator',         'Community Discount: Teacher / Educator (%)',         'text', '10', 31),
  ('global', 'discount_senior_65_plus',            'Community Discount: Senior 65+ (%)',                 'text', '10', 32),
  ('global', 'discount_student',                   'Community Discount: Student (%)',                    'text', '10', 33)
ON CONFLICT (page_key, section_key) DO NOTHING;

-- ── Home page ─────────────────────────────────────────────────────────────────
INSERT INTO site_content (page_key, section_key, label, type, value, sort_order) VALUES
  ('home', 'hero_h1', 'Hero Headline', 'text',     'Clinical skincare with a softer, more personal approach.',                                                                1),
  ('home', 'hero_sub', 'Hero Subtext', 'textarea', 'Bliss Dermacare offers customized facials and skin-focused treatments designed to restore clarity, calm, and confidence without the rushed feel of a typical medspa visit.', 2)
ON CONFLICT (page_key, section_key) DO NOTHING;

-- ── Services hub page ─────────────────────────────────────────────────────────
INSERT INTO site_content (page_key, section_key, label, type, value, sort_order) VALUES
  ('services', 'hero_h1', 'Page Title',    'text', 'Our Services',                                                                                                        1),
  ('services', 'hero_sub','Page Subtitle', 'text', 'Every treatment is personalized. Browse by category to find what''s right for you, then book your appointment.',      2)
ON CONFLICT (page_key, section_key) DO NOTHING;
