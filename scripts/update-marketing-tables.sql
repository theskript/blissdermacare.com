-- Run in Supabase SQL editor

ALTER TABLE marketing_campaigns
  ADD COLUMN IF NOT EXISTS scheduled_for    timestamptz,
  ADD COLUMN IF NOT EXISTS custom_recipients jsonb    DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS segment_label    text,
  ADD COLUMN IF NOT EXISTS error_count      int      DEFAULT 0;

CREATE INDEX IF NOT EXISTS mkt_campaigns_scheduled_idx ON marketing_campaigns(scheduled_for) WHERE status = 'scheduled';

-- Email/SMS templates
CREATE TABLE IF NOT EXISTS marketing_templates (
  id         uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text    NOT NULL,
  subject    text,
  body_html  text,
  body_text  text,
  body_sms   text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Seed with useful starter templates
INSERT INTO marketing_templates (name, subject, body_html, body_sms) VALUES
('Promotional Offer', 'Special offer just for you 💗',
 '<h2 style="font-family:Georgia,serif;color:#1a1a1a">A special offer for you</h2><p>Hi there! We''re excited to share an exclusive offer just for our valued clients.</p><p><strong>[Add your offer details here]</strong></p><p>Use this link to book: <a href="https://blissdermacare.com/book/">Book Now →</a></p><p>This offer expires on <strong>[date]</strong>. Don''t miss out!</p><p>With love,<br/>Bliss Dermacare</p>',
 'Hi! Bliss Dermacare has a special offer just for you: [details]. Book at blissdermacare.com/book/ — expires [date].'),
('Win-Back Campaign', 'We miss you! Come back 💅',
 '<h2 style="font-family:Georgia,serif;color:#1a1a1a">We miss you!</h2><p>Hi [name], it''s been a while since your last visit and we wanted to check in.</p><p>Your skin deserves consistent care, and we''d love to see you back at the studio.</p><p>As a thank-you for returning, we''re offering <strong>[discount]</strong> on your next booking.</p><p><a href="https://blissdermacare.com/book/" style="background:#7c3aed;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:600;display:inline-block;margin-top:8px">Book Now →</a></p><p>See you soon!<br/>Bliss Dermacare</p>',
 'Hey! We miss you at Bliss Dermacare. Book your next appointment and get [discount]: blissdermacare.com/book/'),
('Membership Promo', 'Join our membership program ⭐',
 '<h2 style="font-family:Georgia,serif;color:#1a1a1a">Save more with a membership</h2><p>Did you know our members save up to $132/month on professional skincare?</p><ul><li>Monthly facial + lash + body credits</li><li>Up to 20% off all additional services</li><li>Priority booking every time</li><li>Cancel or pause anytime</li></ul><p>Plans start at just $89/month.</p><p><a href="https://blissdermacare.com/memberships/" style="background:#7c3aed;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:600;display:inline-block;margin-top:8px">View Plans →</a></p>',
 'Save up to $132/mo with a Bliss Dermacare membership. Plans from $89/mo. Details: blissdermacare.com/memberships/'),
('Appointment Reminder', 'Reminder: Your upcoming appointment',
 '<h2 style="font-family:Georgia,serif;color:#1a1a1a">Your appointment reminder</h2><p>Just a friendly reminder that you have an upcoming appointment with us!</p><p><strong>Date:</strong> [date]<br/><strong>Time:</strong> [time]<br/><strong>Service:</strong> [service]</p><p>We''re located at <strong>8905 Regents Park Dr, Tampa, FL 33647</strong>.</p><p>Questions? Call or text us at (609) 366-0857.</p><p>See you soon!<br/>Bliss Dermacare</p>',
 'Reminder: Your appointment at Bliss Dermacare on [date] at [time]. Address: 8905 Regents Park Dr, Tampa FL. Questions? (609) 366-0857'),
('New Service Announcement', 'Exciting news: New service available! 🎉',
 '<h2 style="font-family:Georgia,serif;color:#1a1a1a">We''re excited to announce something new!</h2><p>We''ve just added a new service to our menu and we wanted you to be the first to know.</p><h3>[New Service Name]</h3><p>[Service description]</p><p><strong>Price:</strong> $[price] · <strong>Duration:</strong> [time] minutes</p><p>As one of our valued clients, you can be among the first to book.</p><p><a href="https://blissdermacare.com/book/" style="background:#7c3aed;color:white;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:600;display:inline-block;margin-top:8px">Book This Service →</a></p>',
 'Exciting news from Bliss Dermacare: [New Service] is now available! Book at blissdermacare.com/book/')
ON CONFLICT DO NOTHING;

-- Saved audiences
CREATE TABLE IF NOT EXISTS marketing_audiences (
  id           uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text    NOT NULL,
  segment_type text    NOT NULL DEFAULT 'all',
  description  text,
  created_at   timestamptz DEFAULT now()
);

INSERT INTO marketing_audiences (name, segment_type, description) VALUES
  ('All Clients',            'all',       'Every client who has ever booked'),
  ('Recent — Last 30 Days',  'recent_30', 'Clients with an appointment in the last 30 days'),
  ('Recent — Last 60 Days',  'recent_60', 'Clients with an appointment in the last 60 days'),
  ('Lapsed — 90+ Days',      'lapsed_90', 'Clients who haven''t visited in over 90 days'),
  ('Active Members',         'members',   'Clients with an active membership subscription'),
  ('New Clients',            'new_clients','Clients who have only visited once')
ON CONFLICT DO NOTHING;
