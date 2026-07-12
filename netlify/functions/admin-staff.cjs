'use strict';

const bcrypt = require('bcryptjs');
const { requireAuth, getSupabase, staffFromDB, staffToDB, logAudit, getClientIP } = require('./_utils.cjs');

const BCRYPT_ROUNDS = 12;
const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
};

function stripHash(rec) {
  const f = { ...rec.fields };
  delete f['Password Hash'];
  return { ...rec, fields: f };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let user;
  try { user = requireAuth(event, 'owner'); } catch (e) {
    return { statusCode: e.statusCode || 403, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }

  const sb = getSupabase();
  const ip = getClientIP(event);

  try {
    // GET — list staff
    if (event.httpMethod === 'GET') {
      const { data, error } = await sb.from('staff').select('*').order('username');
      if (error) throw new Error(error.message);
      const records = (data || []).map(staffFromDB).map(stripHash);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ records }) };
    }

    // POST — create account
    if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { username, name, password, role = 'staff' } = body;
      if (!username || !password || !name) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'username, name, and password are required' }) };
      }
      if (!['owner', 'staff'].includes(role)) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'role must be owner or staff' }) };
      }
      if (password.length < 8) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Password must be at least 8 characters' }) };
      }

      // Duplicate check
      const { data: existing } = await sb.from('staff').select('id').ilike('username', username).maybeSingle();
      if (existing) {
        return { statusCode: 409, headers: CORS, body: JSON.stringify({ error: `Username "${username}" is already taken` }) };
      }

      const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const { data, error } = await sb.from('staff')
        .insert({ username, name, password_hash: hash, role, active: true })
        .select().single();
      if (error) throw new Error(error.message);

      logAudit({ action: 'Create Staff', username: user.username, role: user.role, details: `Created account for ${username} (${name}), role: ${role}`, targetId: data.id, ip });
      return { statusCode: 201, headers: CORS, body: JSON.stringify(stripHash(staffFromDB(data))) };
    }

    // PATCH — update or reset password
    if (event.httpMethod === 'PATCH') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { id, fields, resetPassword } = body;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Record ID required' }) };

      if (resetPassword) {
        if (resetPassword.length < 8) {
          return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Password must be at least 8 characters' }) };
        }
        const hash = await bcrypt.hash(resetPassword, BCRYPT_ROUNDS);
        const { data, error } = await sb.from('staff').update({ password_hash: hash }).eq('id', id).select().single();
        if (error) throw new Error(error.message);
        logAudit({ action: 'Reset Password', username: user.username, role: user.role, details: `Reset password for staff record ${id}`, targetId: id, ip });
        return { statusCode: 200, headers: CORS, body: JSON.stringify(stripHash(staffFromDB(data))) };
      }

      // Field update (name, role, active)
      const allowed = {};
      if (fields?.Name   !== undefined) allowed['Name']   = fields.Name;
      if (fields?.Role   !== undefined) allowed['Role']   = fields.Role;
      if (fields?.Active !== undefined) allowed['Active'] = fields.Active;

      const { data, error } = await sb.from('staff').update(staffToDB(allowed)).eq('id', id).select().single();
      if (error) throw new Error(error.message);

      const action = fields?.Active === false ? 'Deactivate Staff'
                   : fields?.Active === true  ? 'Activate Staff'
                   : 'Update Staff';
      logAudit({ action, username: user.username, role: user.role, details: `Updated staff ${id}: ${JSON.stringify(allowed)}`, targetId: id, ip });
      return { statusCode: 200, headers: CORS, body: JSON.stringify(stripHash(staffFromDB(data))) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('admin-staff error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
