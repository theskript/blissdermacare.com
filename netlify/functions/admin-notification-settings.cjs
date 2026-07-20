'use strict';

const { requireAuth, getSupabase, logAudit, getClientIP } = require('./_utils.cjs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
};

// Metadata for the settings UI
const SETTING_META = {
  owner_emails:                   { label: 'Owner email recipients', description: 'Comma-separated. Leave empty to use OWNER_EMAIL env var.', type: 'text' },
  owner_phones:                   { label: 'Owner SMS recipients', description: 'Comma-separated. Leave empty to use OWNER_PHONE env var.', type: 'text' },
  notify_owner_on_new_booking:    { label: 'Notify owner on new in-person booking', description: 'Send SMS + email to owner when a pay-in-person booking is submitted.', type: 'bool' },
  notify_owner_on_stripe_payment: { label: 'Notify owner when Stripe payment completes', description: 'Send SMS + email to owner when a client pays online.', type: 'bool' },
  notify_client_email_on_booking: { label: 'Send confirmation email to client on booking', description: 'Client receives an email when their booking request is received.', type: 'bool' },
  notify_client_sms_on_booking:   { label: 'Send confirmation SMS to client on booking', description: 'Client receives an SMS when their booking request is received.', type: 'bool' },
  reminder_24h_enabled:           { label: '24-hour reminders enabled', description: 'Send SMS/email reminders 24 hours before appointments.', type: 'bool' },
  reminder_2h_enabled:            { label: '2-hour reminders enabled', description: 'Send SMS/email reminders ~2 hours before appointments.', type: 'bool' },
  reminder_statuses:              { label: 'Send reminders for these statuses', description: 'Comma-separated appointment statuses. e.g. Confirmed,Pending Payment', type: 'text' },
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let user;
  try { user = requireAuth(event, 'owner'); } catch (e) {
    return { statusCode: e.statusCode || 403, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }

  const sb = getSupabase();

  try {
    // GET — return all settings with metadata
    if (event.httpMethod === 'GET') {
      const { data, error } = await sb.from('notification_settings').select('key,value').order('key');
      if (error) throw new Error(error.message);

      const map = {};
      for (const row of (data || [])) map[row.key] = row.value;

      // Ensure all known keys are present with defaults
      const defaults = {
        owner_emails: '', owner_phones: '',
        notify_owner_on_new_booking: 'true', notify_owner_on_stripe_payment: 'true',
        notify_client_email_on_booking: 'true', notify_client_sms_on_booking: 'true',
        reminder_24h_enabled: 'true', reminder_2h_enabled: 'true',
        reminder_statuses: 'Confirmed,Pending Payment',
      };
      const settings = Object.entries(SETTING_META).map(([key, meta]) => ({
        key,
        value: map[key] ?? defaults[key] ?? '',
        ...meta,
      }));

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ settings }) };
    }

    // PATCH — update one setting
    if (event.httpMethod === 'PATCH') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { key, value } = body;
      if (!key || !(key in SETTING_META)) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Unknown setting key: ${key}` }) };
      }

      const safeValue = String(value ?? '').substring(0, 1000);
      const { error } = await sb.from('notification_settings')
        .upsert({ key, value: safeValue, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw new Error(error.message);

      logAudit({ action: 'Update Notification Setting', username: user.username, role: user.role, details: `${key} → ${safeValue.substring(0, 100)}`, ip: getClientIP(event) });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, key, value: safeValue }) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('admin-notification-settings error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
