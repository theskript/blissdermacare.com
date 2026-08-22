-- Seed careers job openings into site_content table.
-- Run in Supabase SQL Editor after confirming site_content table and columns (page_key, section_key, value).

INSERT INTO site_content (page_key, section_key, label, value)
VALUES (
  'careers',
  'openings',
  'Job Openings',
  '[
    {
      "title": "Licensed Esthetician",
      "type": "Full-time or Part-time",
      "typeColor": "bg-primary-100 text-primary-700",
      "description": "Join our client-facing team delivering customized facials, chemical peels, and advanced skin treatments. You''ll work one-on-one with clients in a private, calm studio setting — no rushed medspa energy.",
      "requirements": [
        "Active Florida State Esthetician License (required)",
        "1+ years of professional experience preferred (new grads welcome to apply)",
        "Experience with facials, extractions, and chemical peels",
        "Strong communication and client care skills",
        "Passion for skincare education and results-driven care"
      ],
      "preferred": [
        "Experience with microneedling, LED therapy, or lash/brow services",
        "Familiarity with professional skincare brands (PCA Skin, Dermalogica, etc.)"
      ]
    },
    {
      "title": "Client Experience Coordinator",
      "type": "Part-time",
      "typeColor": "bg-neutral-100 text-neutral-700",
      "description": "Be the first point of contact for our clients — managing bookings, responding to inquiries, and keeping the studio running smoothly. This is a key role for someone who loves people, is organized, and takes pride in delivering a warm first impression.",
      "requirements": [
        "Excellent written and verbal communication skills",
        "Highly organized with strong attention to detail",
        "Comfortable managing scheduling, follow-ups, and client communication",
        "Professional demeanor and reliability"
      ],
      "preferred": [
        "Background in beauty, wellness, or hospitality",
        "Experience with booking platforms or CRM tools",
        "Social media savvy (helpful for occasional content support)"
      ]
    },
    {
      "title": "Part-time / Seasonal Esthetician",
      "type": "Flexible",
      "typeColor": "bg-amber-100 text-amber-700",
      "description": "Looking for flexible, high-quality work without a rigid schedule? We schedule part-time and seasonal estheticians to support demand during peak periods. Great for licensed estheticians who want supplemental income and a great working environment.",
      "requirements": [
        "Active Florida State Esthetician License (required)",
        "Availability for at least 2 days per week",
        "Reliable, professional, and client-focused"
      ],
      "preferred": [
        "At least one specialized service beyond basic facials",
        "Comfortable working independently in a private studio setting"
      ]
    }
  ]'
)
ON CONFLICT (page_key, section_key) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value;
