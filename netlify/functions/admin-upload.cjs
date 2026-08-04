'use strict';

/**
 * POST /.netlify/functions/admin-upload
 * Returns a Supabase Storage signed upload URL so the browser can PUT
 * the image file directly without routing the binary through this function.
 *
 * Body: { bucket: string, path: string }  (path = e.g. 'services/my-service.jpg')
 * Response: { signedUrl, publicUrl, path }
 */

const { requireAuth, getSupabase } = require('./_utils.cjs');

const CORS = {
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':'Content-Type, Authorization',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};

const ALLOWED_BUCKETS = new Set(['service-images']);

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try { requireAuth(event); } catch (e) {
    return { statusCode: e.statusCode || 401, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { bucket = 'service-images', path: filePath } = body;
  if (!filePath) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'path is required' }) };
  if (!ALLOWED_BUCKETS.has(bucket))
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Bucket not allowed' }) };

  // Sanitize path
  const cleanPath = filePath.replace(/\.\./g, '').replace(/^\/+/, '').substring(0, 200);

  const sb = getSupabase();
  const { data, error } = await sb.storage.from(bucket).createSignedUploadUrl(cleanPath);
  if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) };

  const { data: publicData } = sb.storage.from(bucket).getPublicUrl(cleanPath);

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ signedUrl: data.signedUrl, token: data.token, path: cleanPath, publicUrl: publicData.publicUrl }),
  };
};
