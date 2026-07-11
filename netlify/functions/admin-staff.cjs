'use strict';

/**
 * /.netlify/functions/admin-staff  — Owner only
 *
 * GET                     → list all staff accounts (no password hashes)
 * POST  { username, name, password, role }  → create account
 * PATCH { id, fields }    → update name/role/active
 * PATCH { id, resetPassword: 'newpass' }   → reset password
 */

const bcrypt = require('bcryptjs');
const { requireAuth, airtableList, airtableCreate, airtablePatch, logAudit, getClientIP } = require('./_utils.cjs');

const STAFF_TABLE = () => process.env.AIRTABLE_STAFF_TABLE || 'Staff';
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

  const ip = getClientIP(event);

  try {
    // GET — list staff
    if (event.httpMethod === 'GET') {
      const data = await airtableList(STAFF_TABLE(), {
        'sort[0][field]': 'Username',
        'sort[0][direction]': 'asc',
      });
      const records = (data.records || []).map(stripHash);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ records }) };
    }

    // POST — create new staff account
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

      // Check for duplicate username
      const existing = await airtableList(STAFF_TABLE(), {
        filterByFormula: `LOWER({Username})="${username.toLowerCase().replace(/"/g, '')}"`,
        maxRecords: 1,
      });
      if (existing.records && existing.records.length > 0) {
        return { statusCode: 409, headers: CORS, body: JSON.stringify({ error: `Username "${username}" is already taken` }) };
      }

      const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const rec = await airtableCreate(STAFF_TABLE(), {
        'Username':      username,
        'Name':          name,
        'Password Hash': hash,
        'Role':          role,
        'Active':        true,
      });

      logAudit({
        action: 'Create Staff',
        username: user.username,
        role: user.role,
        details: `Created account for ${username} (${name}) with role: ${role}`,
        targetId: rec.id,
        ip,
      });

      return { statusCode: 201, headers: CORS, body: JSON.stringify(stripHash(rec)) };
    }

    // PATCH — update or reset password
    if (event.httpMethod === 'PATCH') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }

      const { id, fields, resetPassword } = body;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Record ID required' }) };

      // Password reset
      if (resetPassword) {
        if (resetPassword.length < 8) {
          return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Password must be at least 8 characters' }) };
        }
        const hash = await bcrypt.hash(resetPassword, BCRYPT_ROUNDS);
        const rec = await airtablePatch(STAFF_TABLE(), id, { 'Password Hash': hash });
        logAudit({
          action: 'Reset Password',
          username: user.username,
          role: user.role,
          details: `Reset password for record ${id}`,
          targetId: id,
          ip,
        });
        return { statusCode: 200, headers: CORS, body: JSON.stringify(stripHash(rec)) };
      }

      // Field update (name, role, active)
      const allowed = {};
      if (fields?.Name    !== undefined) allowed['Name']   = fields.Name;
      if (fields?.Role    !== undefined) allowed['Role']   = fields.Role;
      if (fields?.Active  !== undefined) allowed['Active'] = fields.Active;

      const rec = await airtablePatch(STAFF_TABLE(), id, allowed);
      const action = fields?.Active === false ? 'Deactivate Staff'
                   : fields?.Active === true  ? 'Activate Staff'
                   : 'Update Staff';
      logAudit({
        action,
        username: user.username,
        role: user.role,
        details: `Updated staff record ${id}: ${JSON.stringify(allowed)}`,
        targetId: id,
        ip,
      });
      return { statusCode: 200, headers: CORS, body: JSON.stringify(stripHash(rec)) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('admin-staff error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message || 'Internal server error' }) };
  }
};
