'use strict';

/**
 * GET /.netlify/functions/admin-analytics
 * Returns aggregated business metrics from the appointments table.
 * ?months=6 (default) — how many months back to look
 */

const { requireAuth, getSupabase } = require('./_utils.cjs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  let user;
  try { user = requireAuth(event); } catch (e) {
    return { statusCode: e.statusCode || 401, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }

  const q      = event.queryStringParameters || {};
  const months = Math.min(parseInt(q.months || '6', 10), 24);
  const since  = new Date(Date.now() - months * 30 * 86400000).toISOString().split('T')[0];

  try {
    const sb = getSupabase();
    const fields = user.role === 'owner'
      ? 'client_name, client_email, date, time, services, status, price'
      : 'client_name, client_email, date, time, services, status';

    const { data: rows, error } = await sb
      .from('appointments')
      .select(fields)
      .gte('date', since)
      .not('status', 'in', '("Cancelled","No-Show")')
      .order('date', { ascending: true });

    if (error) throw new Error(error.message);
    const appts = rows || [];

    // ── Top services ──────────────────────────────────────────────────────────
    const svcMap = new Map();
    for (const a of appts) {
      (a.services || '').split(',').map(s => s.trim()).filter(Boolean).forEach(svc => {
        // Normalise: strip "(PRP)" etc for cleaner grouping
        const name = svc.length > 50 ? svc.substring(0, 50) + '…' : svc;
        svcMap.set(name, (svcMap.get(name) || 0) + 1);
      });
    }
    const topServices = [...svcMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // ── Top clients ───────────────────────────────────────────────────────────
    const clientMap = new Map();
    for (const a of appts) {
      const key = a.client_email || a.client_name;
      if (!key) continue;
      const existing = clientMap.get(key);
      if (existing) { existing.count++; existing.lastVisit = a.date; }
      else clientMap.set(key, { name: a.client_name, email: a.client_email, count: 1, lastVisit: a.date });
    }
    const topClients = [...clientMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // ── Busiest days of week ──────────────────────────────────────────────────
    const dayCount = new Array(7).fill(0);
    for (const a of appts) {
      if (a.date) dayCount[new Date(a.date + 'T12:00:00').getDay()]++;
    }
    const byDay = dayCount.map((count, i) => ({ day: DAY_NAMES[i], count }));

    // ── Busiest hours ─────────────────────────────────────────────────────────
    const hourMap = new Map();
    for (const a of appts) {
      if (!a.time) continue;
      const m = a.time.match(/(\d{1,2}):\d{2}\s*(AM|PM)?/i);
      if (!m) continue;
      let h = parseInt(m[1], 10);
      const mer = (m[2] || '').toUpperCase();
      if (mer === 'PM' && h !== 12) h += 12;
      if (mer === 'AM' && h === 12) h = 0;
      const label = `${h === 0 ? 12 : h > 12 ? h - 12 : h}:00 ${h < 12 ? 'AM' : 'PM'}`;
      hourMap.set(h, { hour: h, label, count: (hourMap.get(h)?.count || 0) + 1 });
    }
    const byHour = [...hourMap.values()].sort((a, b) => a.hour - b.hour);

    // ── Monthly trend ─────────────────────────────────────────────────────────
    const monthMap = new Map();
    for (const a of appts) {
      if (!a.date) continue;
      const key = a.date.substring(0, 7); // YYYY-MM
      const ex  = monthMap.get(key) || { month: key, count: 0, revenue: 0 };
      ex.count++;
      if (user.role === 'owner') ex.revenue += a.price || 0;
      monthMap.set(key, ex);
    }
    const monthlyTrend = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));

    // ── Quick stats ───────────────────────────────────────────────────────────
    const totalRevenue    = user.role === 'owner' ? appts.reduce((s, a) => s + (a.price || 0), 0) : null;
    const uniqueClients   = new Set(appts.map(a => a.client_email || a.client_name).filter(Boolean)).size;
    const repeatClients   = [...clientMap.values()].filter(c => c.count > 1).length;
    const avgApptPerMonth = appts.length / Math.max(months, 1);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        period: { months, since },
        total: appts.length,
        uniqueClients,
        repeatClients,
        avgApptPerMonth: Math.round(avgApptPerMonth * 10) / 10,
        totalRevenue,
        topServices,
        topClients,
        byDay,
        byHour,
        monthlyTrend,
      }),
    };
  } catch (err) {
    console.error('admin-analytics error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
