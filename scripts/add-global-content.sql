-- Global site content rows for the top notification bar
INSERT INTO site_content (page_key, section_key, label, type, value, sort_order) VALUES
  ('global', 'promo_bar_enabled',      'Show Promo Bar',                  'text', 'true',                                                                                                    1),
  ('global', 'promo_bar_text',         'Promo Bar Text (desktop)',         'text', 'Now offering Advanced Treatments & Semipermanent Makeup — plus member plans from $89/mo.',               2),
  ('global', 'promo_bar_text_mobile',  'Promo Bar Text (mobile)',          'text', 'Advanced Treatments & Semipermanent Makeup — now booking!',                                               3),
  ('global', 'promo_bar_link_text',    'Promo Bar Link Text',              'text', 'See member plans →',                                                                                     4),
  ('global', 'promo_bar_link_url',     'Promo Bar Link URL',               'text', '/memberships/',                                                                                          5)
ON CONFLICT (page_key, section_key) DO NOTHING;
