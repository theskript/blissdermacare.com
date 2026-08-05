'use strict';

const crypto = require('crypto');
const { requireAuth, getSupabase, sendEmail, sendSMS, logAudit, getClientIP } = require('./_utils.cjs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function unsubToken(email) {
  const secret = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET || 'bliss-secret';
  return crypto.createHmac('sha256', secret).update(email.toLowerCase()).digest('hex').slice(0, 16);
}
function unsubLink(email, siteUrl) {
  return `${siteUrl}/unsubscribe?email=${encodeURIComponent(email)}&token=${unsubToken(email)}`;
}

// ── Build recipient list from segment ─────────────────────────────────────────
async function getRecipientsForSegment(sb, segmentType) {
  const days30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const days60 = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];
  const days90 = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

  let query = sb.from('appointments')
    .select('client_name, client_email, client_phone, date')
    .not('client_email', 'is', null)
    .neq('client_email', '')
    .not('status', 'in', '("Cancelled","No-Show")');

  if (segmentType === 'recent_30') query = query.gte('date', days30);
  if (segmentType === 'recent_60') query = query.gte('date', days60);
  if (segmentType === 'lapsed_90') {
    const twoYearsAgo = new Date(Date.now() - 730 * 86400000).toISOString().split('T')[0];
    query = query.lt('date', days90).gte('date', twoYearsAgo);
  }

  const { data: rows, error } = await query.order('date', { ascending: false });
  if (error) throw new Error(error.message);

  const emailMap = new Map();
  for (const r of (rows || [])) {
    const e = r.client_email.toLowerCase().trim();
    if (!emailMap.has(e)) emailMap.set(e, r);
  }

  let recipients = [...emailMap.values()];

  if (segmentType === 'members') {
    const { data: mems } = await sb.from('memberships').select('email, customer_name').eq('status', 'active');
    const memberSet = new Set((mems || []).map(m => m.email.toLowerCase()));
    recipients = recipients.filter(r => memberSet.has(r.client_email.toLowerCase()));
  }

  if (segmentType === 'new_clients') {
    const counts = new Map();
    for (const r of (rows || [])) {
      const e = r.client_email.toLowerCase();
      counts.set(e, (counts.get(e) || 0) + 1);
    }
    recipients = recipients.filter(r => counts.get(r.client_email.toLowerCase()) === 1);
  }

  // Remove unsubscribed
  const { data: unsubs } = await sb.from('marketing_unsubscribes').select('email').eq('unsub_email', true);
  const unsubSet = new Set((unsubs || []).map(u => u.email.toLowerCase()));
  return recipients.filter(r => !unsubSet.has(r.client_email.toLowerCase()));
}

// ── Send a campaign to a list of recipients ────────────────────────────────────
async function sendToRecipients(sb, campaign, recipients, siteUrl) {
  let sentCount = 0, errorCount = 0;
  const errors = [];
  const channels = campaign.channels || ['email'];

  for (const r of recipients) {
    const emailAddr = r.client_email || r.email;
    const phone     = r.client_phone || r.phone;

    if (channels.includes('email') && emailAddr) {
      const unsub = unsubLink(emailAddr, siteUrl);
      const footer = `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">
        You are receiving this because you have an appointment with Bliss Dermacare.<br/>
        8905 Regents Park Dr, Tampa, FL 33647 · (609) 366-0857<br/>
        <a href="${unsub}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
      </div>`;
      const html  = (campaign.body_html || '') + footer;
      const plain = (campaign.body_text || campaign.body_html?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '') +
                    `\n\nUnsubscribe: ${unsub}`;
      try {
        await sendEmail({ to: emailAddr, subject: campaign.subject || campaign.name, html, text: plain });
        sentCount++;
      } catch (e) { errorCount++; errors.push(`email:${emailAddr}: ${e.message}`); }
      await sleep(80);
    }

    if (channels.includes('sms') && phone) {
      const stopNote = '\nReply STOP to unsubscribe.';
      try {
        await sendSMS(phone, (campaign.body_sms || campaign.body_text || '') + stopNote);
        if (!channels.includes('email')) sentCount++;
      } catch (e) { errors.push(`sms:${phone}: ${e.message}`); }
      await sleep(200);
    }
  }

  return { sentCount, errorCount, errors: errors.slice(0, 20), total: recipients.length };
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
  const res  = q.resource || 'campaign';

  try {
    // ── Templates ─────────────────────────────────────────────────────────────
    if (res === 'templates') {
      if (event.httpMethod === 'GET') {
        const { data, error } = await sb.from('marketing_templates').select('*').order('created_at', { ascending: false });
        if (error) throw new Error(error.message);
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ templates: data || [] }) };
      }
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }
      if (event.httpMethod === 'POST') {
        const { data, error } = await sb.from('marketing_templates').insert({ ...body, updated_at: new Date().toISOString() }).select().single();
        if (error) throw new Error(error.message);
        return { statusCode: 201, headers: CORS, body: JSON.stringify(data) };
      }
      if (event.httpMethod === 'PATCH') {
        const { id, ...fields } = body;
        fields.updated_at = new Date().toISOString();
        const { data, error } = await sb.from('marketing_templates').update(fields).eq('id', id).select().single();
        if (error) throw new Error(error.message);
        return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
      }
      if (event.httpMethod === 'DELETE') {
        await sb.from('marketing_templates').delete().eq('id', body.id);
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ deleted: true }) };
      }
    }

    // ── Audiences ─────────────────────────────────────────────────────────────
    if (res === 'audiences') {
      if (event.httpMethod === 'GET') {
        const { data, error } = await sb.from('marketing_audiences').select('*').order('created_at');
        if (error) throw new Error(error.message);
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ audiences: data || [] }) };
      }
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }
      if (event.httpMethod === 'POST') {
        const { data, error } = await sb.from('marketing_audiences').insert(body).select().single();
        if (error) throw new Error(error.message);
        return { statusCode: 201, headers: CORS, body: JSON.stringify(data) };
      }
      if (event.httpMethod === 'DELETE') {
        await sb.from('marketing_audiences').delete().eq('id', body.id);
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ deleted: true }) };
      }
    }

    // ── Unsubscribes ──────────────────────────────────────────────────────────
    if (res === 'unsubscribes') {
      if (event.httpMethod === 'GET') {
        let query = sb.from('marketing_unsubscribes').select('*').order('created_at', { ascending: false });
        if (q.search) query = query.ilike('email', `%${q.search}%`);
        const { data, count, error } = await query.limit(100);
        if (error) throw new Error(error.message);
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ unsubscribes: data || [], total: count }) };
      }
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }
      if (event.httpMethod === 'PATCH') {
        const { id, resubscribe } = body;
        await sb.from('marketing_unsubscribes').update({
          unsub_email: !resubscribe, unsub_sms: !resubscribe,
          source: resubscribe ? 're-subscribe' : 'manual', updated_at: new Date().toISOString()
        }).eq('id', id);
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
      }
    }

    // ── Campaign: recipients preview ──────────────────────────────────────────
    if (event.httpMethod === 'GET' && q.recipients === 'true') {
      const seg = q.segment || 'all';
      if (seg === 'custom') {
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ count: 0, preview: [] }) };
      }
      const recipients = await getRecipientsForSegment(sb, seg);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({
        count: recipients.length,
        preview: recipients.slice(0, 8).map(r => ({ name: r.client_name, email: r.client_email })),
      }) };
    }

    // ── Campaign: client search (for individual picker) ───────────────────────
    if (event.httpMethod === 'GET' && q.clientSearch) {
      const search = q.clientSearch.replace(/'/g, '').substring(0, 80);
      const { data } = await sb.from('appointments')
        .select('client_name, client_email, client_phone')
        .or(`client_name.ilike.%${search}%,client_email.ilike.%${search}%,client_phone.ilike.%${search}%`)
        .not('client_email', 'is', null)
        .neq('client_email', '')
        .order('client_name').limit(20);
      // Deduplicate by email
      const seen = new Set();
      const results = [];
      for (const r of (data || [])) {
        const e = r.client_email.toLowerCase();
        if (!seen.has(e)) { seen.add(e); results.push(r); }
      }
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ clients: results }) };
    }

    // ── Campaign: list ────────────────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const { data, error } = await sb.from('marketing_campaigns')
        .select('id, name, subject, channels, segment_type, segment_label, status, sent_at, scheduled_for, recipient_count, sent_count, error_count, created_at')
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw new Error(error.message);
      const { count: unsubCount } = await sb.from('marketing_unsubscribes').select('*', { count: 'exact', head: true });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ campaigns: data || [], unsubCount: unsubCount || 0 }) };
    }

    // ── Campaign: create / test / send / schedule ────────────────────────────
    if (event.httpMethod === 'POST' && res === 'campaign') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const {
        name, subject, body_html, body_text, body_sms,
        channels = ['email'], segment_type = 'all', segment_label = '',
        custom_recipients = [], scheduled_for,
        action = 'draft', test_email,
      } = body;

      const siteUrl = (process.env.URL || 'https://blissdermacare.com').replace(/\/$/, '');

      // ── Test send ──────────────────────────────────────────────────────────
      if (action === 'test') {
        if (!test_email) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'test_email is required' }) };
        const footer = '<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;"><strong>[TEST EMAIL]</strong> — This is a preview. Unsubscribe links are disabled in test sends.</div>';
        try {
          await sendEmail({ to: test_email, subject: `[TEST] ${subject || name}`, html: (body_html || '') + footer, text: body_text || '' });
          return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, sentTo: test_email }) };
        } catch (e) {
          return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: e.message }) };
        }
      }

      // Save campaign record
      const campaignData = {
        name, subject, body_html, body_text, body_sms, channels, segment_type,
        segment_label: segment_label || segment_type,
        custom_recipients: custom_recipients || [],
        created_by: user.username, updated_at: new Date().toISOString(),
        status: action === 'send' ? 'sending' : action === 'schedule' ? 'scheduled' : 'draft',
        scheduled_for: action === 'schedule' ? scheduled_for : null,
      };

      const { data: campaign, error: insertErr } = await sb.from('marketing_campaigns').insert(campaignData).select().single();
      if (insertErr) throw new Error(insertErr.message);

      if (action === 'draft' || action === 'schedule') {
        return { statusCode: 201, headers: CORS, body: JSON.stringify(campaign) };
      }

      // ── Send now ───────────────────────────────────────────────────────────
      let recipients;
      if (segment_type === 'custom') {
        recipients = (custom_recipients || []).filter(r => r.email);
        // Remove unsubscribed from custom list too
        const { data: unsubs } = await sb.from('marketing_unsubscribes').select('email').eq('unsub_email', true);
        const unsubSet = new Set((unsubs || []).map(u => u.email.toLowerCase()));
        recipients = recipients.filter(r => !unsubSet.has(r.email.toLowerCase()));
      } else {
        recipients = await getRecipientsForSegment(sb, segment_type);
      }

      const result = await sendToRecipients(sb, campaign, recipients, siteUrl);

      await sb.from('marketing_campaigns').update({
        status: 'sent', sent_at: new Date().toISOString(),
        recipient_count: result.total, sent_count: result.sentCount,
        error_count: result.errorCount, updated_at: new Date().toISOString(),
      }).eq('id', campaign.id);

      await logAudit(sb, { action: 'Marketing Campaign Sent', username: user.username, role: user.role,
        targetId: campaign.id, details: `${name} — ${result.sentCount}/${result.total} sent`, ip });

      return { statusCode: 200, headers: CORS, body: JSON.stringify({
        id: campaign.id, ...result,
      }) };
    }

    // ── Campaign: update draft ────────────────────────────────────────────────
    if (event.httpMethod === 'PATCH' && res === 'campaign') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { id, ...fields } = body;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id required' }) };
      const allowed = ['name','subject','body_html','body_text','body_sms','channels','segment_type','segment_label','custom_recipients','scheduled_for'];
      const update = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)));
      update.updated_at = new Date().toISOString();
      const { data, error } = await sb.from('marketing_campaigns').update(update).eq('id', id).in('status', ['draft','scheduled']).select().single();
      if (error) throw new Error(error.message);
      return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
    }

    // ── Campaign: delete ──────────────────────────────────────────────────────
    if (event.httpMethod === 'DELETE' && res === 'campaign') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      await sb.from('marketing_campaigns').delete().eq('id', body.id).in('status', ['draft','scheduled']);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ deleted: true }) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('admin-marketing error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
