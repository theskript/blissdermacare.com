'use strict';

const { getSupabase, getClientIP } = require('./_utils.cjs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const clean = (value, max) => String(value || '').trim().slice(0, max);

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (body.website) return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };

  const clientName = clean(body.clientName, 80);
  const email = clean(body.email, 160).toLowerCase();
  const serviceName = clean(body.serviceName, 120);
  const reviewText = clean(body.reviewText, 1200);
  const rating = Number(body.rating);
  const consent = body.consent === true;

  if (!clientName || !email || !serviceName || !reviewText || !consent) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Please complete all required fields.' }) };
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Please enter a valid email address.' }) };
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Please choose a rating from 1 to 5.' }) };
  }
  if (reviewText.length < 20) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Please share at least 20 characters about your experience.' }) };
  }

  const { error } = await getSupabase().from('reviews').insert({
    client_name: clientName,
    email,
    service_name: serviceName,
    rating,
    review_text: reviewText,
    consent,
    ip: getClientIP(event),
    user_agent: event.headers?.['user-agent'] || null,
    referrer: event.headers?.referer || null,
  });

  if (error) {
    console.error('review-submission error:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'We could not submit your review. Please try again.' }) };
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
};