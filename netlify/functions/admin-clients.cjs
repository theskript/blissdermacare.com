'use strict';

const { requireAuth, getSupabase } = require('./_utils.cjs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let user;
  try { user = requireAuth(event); } catch (e) {
    return { statusCode: e.statusCode || 401, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const q = event.queryStringParameters || {};
    const search = (q.search || '').replace(/'/g, '').substring(0, 100);

    let query = getSupabase()
      .from('appointments')
      .select('id,client_name,client_email,client_phone,date,status,source,services,notes,internal_notes,price')
      .order('date', { ascending: false });

    if (search) {
      query = query.or(`client_name.ilike.%${search}%,client_email.ilike.%${search}%,client_phone.ilike.%${search}%`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    // Group by email to build client profiles
    const clientMap = new Map();
    for (const row of (rows || [])) {
      const email = (row.client_email || '').toLowerCase().trim();
      const key = email || (row.client_name || '').toLowerCase().trim() || row.id;

      if (!clientMap.has(key)) {
        clientMap.set(key, {
          email: row.client_email || '',
          name: row.client_name || '',
          phone: row.client_phone || '',
          source: row.source || '',
          totalVisits: 0,
          firstVisit: row.date || null,
          lastVisit: row.date || null,
          appointments: [],
        });
      }

      const c = clientMap.get(key);
      if (row.date && row.date >= (c.lastVisit || '')) {
        if (row.client_name) c.name = row.client_name;
        if (row.client_phone) c.phone = row.client_phone;
      }
      c.totalVisits += 1;
      if (row.date && (!c.firstVisit || row.date < c.firstVisit)) c.firstVisit = row.date;
      if (row.date && (!c.lastVisit  || row.date > c.lastVisit))  c.lastVisit  = row.date;

      c.appointments.push({
        id:            row.id,
        date:          row.date || '',
        time:          row.time || '',
        services:      row.services || '',
        status:        row.status || '',
        source:        row.source || '',
        notes:         row.notes || '',
        internalNotes: row.internal_notes || '',
        ...(user.role === 'owner' ? { price: row.price || 0 } : {}),
      });
    }

    // ── Merge pre-service form submissions ───────────────────────────────────
    // Pull every form entry so we can (a) add clients not yet in appointments
    // and (b) attach questionnaire data to existing clients.
    try {
      let formQuery = getSupabase()
        .from('pre_service_forms')
        .select('name,email,phone,appointment_date,skin_conditions,allergies,medical_history,medications,recent_treatments,created_at')
        .order('created_at', { ascending: false });

      if (search) {
        formQuery = formQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      const { data: forms } = await formQuery;

      for (const form of (forms || [])) {
        const email = (form.email || '').toLowerCase().trim();
        const key   = email || (form.name || '').toLowerCase().trim();
        if (!key) continue;

        if (!clientMap.has(key)) {
          // Client exists only in questionnaires — no booked appointment yet
          clientMap.set(key, {
            email:        form.email || '',
            name:         (form.name || '').trim(),
            phone:        form.phone || '',
            source:       'form',
            totalVisits:  0,
            firstVisit:   null,
            lastVisit:    null,
            appointments: [],
          });
        }

        const c = clientMap.get(key);
        // Fill in missing contact info from the form
        if (!c.phone && form.phone) c.phone = form.phone;
        if (!c.name  && form.name)  c.name  = form.name.trim();

        // Attach the most recent questionnaire (forms are ordered desc by created_at)
        if (!c.questionnaire) {
          c.questionnaire = {
            skinConditions:   form.skin_conditions   || [],
            allergies:        form.allergies         || null,
            medicalHistory:   form.medical_history   || [],
            medications:      form.medications       || null,
            recentTreatments: form.recent_treatments || null,
            submittedAt:      form.created_at        || null,
          };
        }
      }
    } catch (formErr) {
      console.warn('pre_service_forms query failed (non-fatal):', formErr.message);
    }

    const clients = Array.from(clientMap.values())
      .sort((a, b) => (b.lastVisit || b.questionnaire?.submittedAt || '').localeCompare(a.lastVisit || a.questionnaire?.submittedAt || ''));

    // Attach membership data (non-fatal if memberships table doesn't exist yet)
    try {
      const emails = clients.map(c => c.email.toLowerCase()).filter(Boolean);
      if (emails.length > 0) {
        const { data: memberships } = await getSupabase()
          .from('memberships')
          .select('email,plan,plan_label,status,current_period_end,stripe_subscription_id')
          .in('email', emails);

        if (memberships?.length) {
          // Build a map: email → most relevant membership (active first, then latest)
          const memMap = new Map();
          for (const m of memberships) {
            const key = (m.email || '').toLowerCase();
            const existing = memMap.get(key);
            // Prefer active > past_due > others; if same priority keep existing
            const priority = (s) => s === 'active' ? 0 : s === 'past_due' ? 1 : 2;
            if (!existing || priority(m.status) < priority(existing.status)) {
              memMap.set(key, m);
            }
          }
          for (const c of clients) {
            const m = memMap.get(c.email.toLowerCase());
            if (m) {
              c.membership = {
                plan:       m.plan,
                planLabel:  m.plan_label,
                status:     m.status,
                renewsAt:   m.current_period_end,
              };
            }
          }
        }
      }
    } catch (memErr) {
      console.warn('Memberships query failed (non-fatal):', memErr.message);
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ clients, total: clients.length }) };
  } catch (err) {
    console.error('admin-clients error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
