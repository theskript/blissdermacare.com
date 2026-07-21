'use strict';

/**
 * POST /.netlify/functions/pre-service-form
 * Saves a pre-service questionnaire submission to Supabase.
 */

const { getSupabase } = require('./_utils.cjs');

const CORS = {
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':'Content-Type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};

function toArray(val) {
  if (Array.isArray(val)) return val.length ? val : null;
  if (val && typeof val === 'string' && val.trim()) return [val.trim()];
  return null;
}

function nullIfEmpty(val) {
  const t = (val || '').trim();
  return t === '' ? null : t;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  // Required fields
  const { name, email, phone, appointment_date } = body;
  if (!name || !email || !phone || !appointment_date) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'name, email, phone, and appointment_date are required' }) };
  }

  const record = {
    name:                          nullIfEmpty(name),
    appointment_date:              nullIfEmpty(appointment_date),
    phone:                         nullIfEmpty(phone),
    email:                         nullIfEmpty(email)?.toLowerCase(),
    age_category:                  nullIfEmpty(body.age_category),
    guardian_name:                 nullIfEmpty(body.guardian_name),
    guardian_relationship:         nullIfEmpty(body.guardian_relationship),
    guardian_phone:                nullIfEmpty(body.guardian_phone),
    guardian_email:                nullIfEmpty(body.guardian_email),
    guardian_id_type:              nullIfEmpty(body.guardian_id_type),
    guardian_presence_commitment:  nullIfEmpty(body.guardian_presence_commitment),
    guardian_medical_accuracy:     nullIfEmpty(body.guardian_medical_accuracy),
    age_confirmation_adult:        nullIfEmpty(body.age_confirmation_adult),
    skin_conditions:               toArray(body.skin_conditions),
    allergies:                     nullIfEmpty(body.allergies),
    medical_history:               toArray(body.medical_history),
    medications:                   nullIfEmpty(body.medications),
    recent_treatments:             toArray(body.recent_treatments)?.join(', ') || null,
    alcohol_consumption:           nullIfEmpty(body.alcohol_consumption),
    skin_prep:                     toArray(body.skin_prep),
    hygiene_acknowledgment:        nullIfEmpty(body.hygiene_acknowledgment),
    appointment_acknowledgment:    nullIfEmpty(body.appointment_acknowledgment),
    post_care_acknowledgment:      nullIfEmpty(body.post_care_acknowledgment),
    refuse_service_acknowledgment: nullIfEmpty(body.refuse_service_acknowledgment),
    refund_policy_acknowledgment:  nullIfEmpty(body.refund_policy_acknowledgment),
    health_agreement:              nullIfEmpty(body.health_agreement),
    ip:       (event.headers['x-forwarded-for'] || '').split(',')[0].trim() || event.headers['client-ip'] || null,
    user_agent: event.headers['user-agent'] || null,
    referrer:   event.headers['referer']    || null,
    created_at: new Date().toISOString(),
  };

  try {
    const { error } = await getSupabase().from('pre_service_forms').insert(record);
    if (error) throw new Error(error.message);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('pre-service-form error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to save form. Please try again.' }) };
  }
};
