'use strict';

/**
 * Netlify scheduled function — runs every 15 minutes.
 * Finds campaigns with status='scheduled' and scheduled_for <= now() and sends them.
 */

const crypto = require('crypto');
const { getSupabase, sendEmail, sendSMS } = require('./_utils.cjs');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function unsubToken(email) {
  const secret = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET || 'bliss-secret';
  return crypto.createHmac('sha256', secret).update(email.toLowerCase()).digest('hex').slice(0, 16);
}

exports.handler = async () => {
  const sb      = getSupabase();
  const siteUrl = (process.env.URL || 'https://blissdermacare.com').replace(/\/$/, '');
  const now     = new Date().toISOString();

  // Find all due scheduled campaigns
  const { data: dueCampaigns, error } = await sb.from('marketing_campaigns')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_for', now);

  if (error) { console.error('Scheduler: fetch error', error.message); return { statusCode: 500 }; }
  if (!dueCampaigns?.length) { console.log('Scheduler: no campaigns due'); return { statusCode: 200 }; }

  for (const campaign of dueCampaigns) {
    // Mark as sending to prevent duplicate sends
    await sb.from('marketing_campaigns').update({ status: 'sending', updated_at: now }).eq('id', campaign.id);

    try {
      let recipients = [];

      if (campaign.segment_type === 'custom') {
        recipients = (campaign.custom_recipients || []).filter(r => r.email);
      } else {
        const days30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
        const days60 = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];
        const days90 = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

        let query = sb.from('appointments').select('client_name, client_email, client_phone').not('client_email','is',null).neq('client_email','').not('status','in','("Cancelled","No-Show")');
        if (campaign.segment_type === 'recent_30') query = query.gte('date', days30);
        if (campaign.segment_type === 'recent_60') query = query.gte('date', days60);
        if (campaign.segment_type === 'lapsed_90') {
          const twoYearsAgo = new Date(Date.now() - 730 * 86400000).toISOString().split('T')[0];
          query = query.lt('date', days90).gte('date', twoYearsAgo);
        }
        const { data: rows } = await query.order('date', { ascending: false });
        const emailMap = new Map();
        for (const r of (rows || [])) {
          const e = r.client_email.toLowerCase();
          if (!emailMap.has(e)) emailMap.set(e, r);
        }
        if (campaign.segment_type === 'members') {
          const { data: mems } = await sb.from('memberships').select('email').eq('status', 'active');
          const memberSet = new Set((mems || []).map(m => m.email.toLowerCase()));
          recipients = [...emailMap.values()].filter(r => memberSet.has(r.client_email.toLowerCase()));
        } else {
          recipients = [...emailMap.values()];
        }
      }

      // Remove unsubscribed
      const { data: unsubs } = await sb.from('marketing_unsubscribes').select('email').eq('unsub_email', true);
      const unsubSet = new Set((unsubs || []).map(u => u.email.toLowerCase()));
      recipients = recipients.filter(r => !(unsubSet.has((r.client_email || r.email || '').toLowerCase())));

      let sentCount = 0, errorCount = 0;
      const channels = campaign.channels || ['email'];

      for (const r of recipients) {
        const emailAddr = r.client_email || r.email;
        const phone     = r.client_phone || r.phone;
        if (channels.includes('email') && emailAddr) {
          const unsub   = `${siteUrl}/unsubscribe?email=${encodeURIComponent(emailAddr)}&token=${unsubToken(emailAddr)}`;
          const footer  = `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">Bliss Dermacare · 8905 Regents Park Dr, Tampa, FL 33647<br/><a href="${unsub}" style="color:#9ca3af;">Unsubscribe</a></div>`;
          try { await sendEmail({ to: emailAddr, subject: campaign.subject || campaign.name, html: (campaign.body_html||'') + footer, text: campaign.body_text || '' }); sentCount++; } catch { errorCount++; }
          await sleep(80);
        }
        if (channels.includes('sms') && phone) {
          try { await sendSMS(phone, (campaign.body_sms||'') + '\nReply STOP to unsubscribe.'); if (!channels.includes('email')) sentCount++; } catch { errorCount++; }
          await sleep(200);
        }
      }

      await sb.from('marketing_campaigns').update({
        status: 'sent', sent_at: new Date().toISOString(),
        recipient_count: recipients.length, sent_count: sentCount, error_count: errorCount,
        updated_at: new Date().toISOString(),
      }).eq('id', campaign.id);

      console.log(`Scheduler: sent campaign "${campaign.name}" — ${sentCount}/${recipients.length}`);
    } catch (err) {
      console.error(`Scheduler: failed campaign ${campaign.id}:`, err.message);
      await sb.from('marketing_campaigns').update({ status: 'draft', updated_at: new Date().toISOString() }).eq('id', campaign.id);
    }
  }

  return { statusCode: 200 };
};
