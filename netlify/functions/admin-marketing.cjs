'use strict';

/**
 * GET    — list campaigns
 * GET?recipients=true&segment=X — preview recipient count/list for a segment
 * POST   — create (draft or send immediately)
 * PATCH  — update draft
 * DELETE — delete draft
 */

const crypto = require('crypto');
const { requireAuth, getSupabase, sendEmail, sendSMS, logAudit, getClientIP } = require('./_utils.cjs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

// Small delay between sends to avoid rate-limit bursts
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Build an HMAC token to validate unsubscribe links
function unsubToken(email) {
  const secret = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET || 'bliss-secret';
  return crypto.createHmac('sha256', secret).update(email.toLowerCase()).digest('hex').slice(0, 16);
}

function unsubLink(email, siteUrl) {
  return `${siteUrl}/unsubscribe?email=${encodeURIComponent(email)}&token=${unsubToken(email)}`;
}

// ── Segment queries ───────────────────────────────────────────────────────────
async function getRecipients(sb, segmentType) {
  const days30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const days60 = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];
  const days90 = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

  let query = sb.from('appointments')
    .select('client_name, client_email, client_phone, date')
    .not('client_email', 'is', null)
    .neq('client_email', '')
    .not('status', 'in', '("Cancelled","No-Show")');

  if (segmentType === 'recent_30')  query = query.gte('date', days30);
  if (segmentType === 'recent_60')  query = query.gte('date', days60);
  if (segmentType === 'lapsed_90')  query = query.lt('date', days90).lte('date', new Date(Date.now() - 90 * 86400000 - 365 * 86400000).toISOString().split('T')[0]);

  const { data: rows, error } = await query.order('date', { ascending: false });
  if (error) throw new Error(error.message);

  // Deduplicate by email, keep most recent record
  const emailMap = new Map();
  for (const r of (rows || [])) {
    const e = r.client_email.toLowerCase().trim();
    if (!emailMap.has(e)) emailMap.set(e, r);
  }

  // Fetch members separately for members segment
  let memberEmails = new Set();
  if (segmentType === 'members') {
    const { data: mems } = await sb.from('memberships').select('email').eq('status', 'active');
    memberEmails = new Set((mems || []).map(m => m.email.toLowerCase()));
  }

  // Filter by segment
  let recipients = [...emailMap.values()];
  if (segmentType === 'members') {
    recipients = recipients.filter(r => memberEmails.has(r.client_email.toLowerCase()));
  }
  if (segmentType === 'new_clients') {
    // Only clients who appear exactly once
    const counts = new Map();
    for (const r of (rows || [])) counts.set(r.client_email.toLowerCase(), (counts.get(r.client_email.toLowerCase()) || 0) + 1);
    recipients = recipients.filter(r => counts.get(r.client_email.toLowerCase()) === 1);
  }

  // Remove unsubscribed
  const { data: unsubs } = await sb.from('marketing_unsubscribes')
    .select('email').eq('unsub_email', true);
  const unsubSet = new Set((unsubs || []).map(u => u.email.toLowerCase()));
  recipients = recipients.filter(r => !unsubSet.has(r.client_email.toLowerCase()));

  return recipients;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let user;
  try { user = requireAuth(event); } catch (e) {
    return { statusCode: e.statusCode || 401, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }
  if (user.role !== 'owner') {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Owner access required' }) };
  }

  const sb  = getSupabase();
  const ip  = getClientIP(event);
  const q   = event.queryStringParameters || {};

  try {
    // ── GET ───────────────────────────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      // Preview recipients for a segment
      if (q.recipients === 'true') {
        const recipients = await getRecipients(sb, q.segment || 'all');
        return { statusCode: 200, headers: CORS, body: JSON.stringify({
          count: recipients.length,
          preview: recipients.slice(0, 5).map(r => ({ name: r.client_name, email: r.client_email })),
        }) };
      }
      // List campaigns
      const { data, error } = await sb.from('marketing_campaigns')
        .select('id, name, subject, channels, segment_type, status, sent_at, recipient_count, sent_count, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      // Also fetch unsubscribe count
      const { count: unsubCount } = await sb.from('marketing_unsubscribes').select('*', { count: 'exact', head: true });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ campaigns: data || [], unsubCount: unsubCount || 0 }) };
    }

    // ── POST — create + optionally send ───────────────────────────────────────
    if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { name, subject, body_html, body_text, body_sms, channels = ['email'],
              segment_type = 'all', action = 'draft' } = body;
      if (!name) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'name is required' }) };

      const siteUrl = (process.env.URL || 'https://blissdermacare.com').replace(/\/$/, '');

      // Save campaign record
      const { data: campaign, error: insertErr } = await sb.from('marketing_campaigns').insert({
        name, subject, body_html, body_text, body_sms,
        channels, segment_type,
        status: action === 'send' ? 'sending' : 'draft',
        created_by: user.username,
        updated_at: new Date().toISOString(),
      }).select().single();
      if (insertErr) throw new Error(insertErr.message);

      if (action !== 'send') {
        return { statusCode: 201, headers: CORS, body: JSON.stringify(campaign) };
      }

      // ── Send ─────────────────────────────────────────────────────────────
      const recipients = await getRecipients(sb, segment_type);
      let sentCount = 0, failCount = 0;
      const errors = [];

      for (const r of recipients) {
        const emailAddr = r.client_email;
        const phone     = r.client_phone;

        // Email channel
        if (channels.includes('email') && emailAddr) {
          const unsub = unsubLink(emailAddr, siteUrl);
          const footer = `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center;">
            You are receiving this because you booked with Bliss Dermacare.<br/>
            <a href="${unsub}" style="color:#999;">Unsubscribe</a>
          </div>`;
          const html = (body_html || '') + footer;
          const plain = (body_text || body_html?.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim() || '') + `\n\nUnsubscribe: ${unsub}`;
          try {
            await sendEmail({ to: emailAddr, subject: subject || name, html, text: plain });
            sentCount++;
          } catch (e) { failCount++; errors.push(`email:${emailAddr}: ${e.message}`); }
          await sleep(80); // ~12 emails/sec
        }

        // SMS channel
        if (channels.includes('sms') && phone) {
          const stopNote = '\nReply STOP to unsubscribe.';
          try {
            await sendSMS(phone, (body_sms || body_text || '') + stopNote);
            if (!channels.includes('email')) sentCount++;
          } catch (e) { errors.push(`sms:${phone}: ${e.message}`); }
          await sleep(200); // ~5 SMS/sec
        }
      }

      // Update campaign status
      await sb.from('marketing_campaigns').update({
        status: 'sent', sent_at: new Date().toISOString(),
        recipient_count: recipients.length, sent_count: sentCount, updated_at: new Date().toISOString(),
      }).eq('id', campaign.id);

      await logAudit(sb, { action: 'Marketing Campaign Sent', username: user.username, role: user.role,
        targetId: campaign.id, details: `${name} — ${sentCount}/${recipients.length} sent`, ip });

      return { statusCode: 200, headers: CORS, body: JSON.stringify({
        id: campaign.id, status: 'sent', sentCount, failCount, total: recipients.length,
        errors: errors.slice(0, 10),
      }) };
    }

    // ── PATCH — update draft ──────────────────────────────────────────────────
    if (event.httpMethod === 'PATCH') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { id, ...fields } = body;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id required' }) };
      const allowed = ['name','subject','body_html','body_text','body_sms','channels','segment_type'];
      const update = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)));
      update.updated_at = new Date().toISOString();
      const { data, error } = await sb.from('marketing_campaigns').update(update).eq('id', id).eq('status', 'draft').select().single();
      if (error) throw new Error(error.message);
      return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
    }

    // ── DELETE — delete draft ─────────────────────────────────────────────────
    if (event.httpMethod === 'DELETE') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { id } = body;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id required' }) };
      await sb.from('marketing_campaigns').delete().eq('id', id).eq('status', 'draft');
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ deleted: true }) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('admin-marketing error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
