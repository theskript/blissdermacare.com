-- Global settings: maintenance mode and nav customization
INSERT INTO site_content (page_key, section_key, label, type, value, sort_order) VALUES
  ('global', 'maintenance_mode',    'Maintenance Mode (true = site offline for visitors)',  'text',     'false', 10),
  ('global', 'maintenance_message', 'Maintenance Page Message',                              'textarea', 'We are currently performing maintenance. Please check back soon.', 11),
  ('global', 'nav_hidden',          'Hidden Nav Items — JSON array of IDs to hide (e.g. ["careers","partners"])', 'text', '[]', 20),
  ('global', 'nav_extra',           'Extra Nav Items — JSON array of {label,url} (e.g. [{"label":"Blog","url":"/blog/"}])',  'text', '[]', 21)
ON CONFLICT (page_key, section_key) DO NOTHING;
