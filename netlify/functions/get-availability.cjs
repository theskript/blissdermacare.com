'use strict';

const { getSupabase } = require('./_utils.cjs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Default schedule (fallback if DB unavailable)
const DEFAULT_SCHEDULE = [
  { day_of_week: 0, is_open: false, open_time: '12:30', close_time: '19:00', slot_interval: 30 },
  { day_of_week: 1, is_open: false, open_time: '12:30', close_time: '19:00', slot_interval: 30 },
  { day_of_week: 2, is_open: false, open_time: '12:30', close_time: '19:00', slot_interval: 30 },
  { day_of_week: 3, is_open: true,  open_time: '12:30', close_time: '19:00', slot_interval: 30 },
  { day_of_week: 4, is_open: true,  open_time: '12:30', close_time: '19:00', slot_interval: 30 },
  { day_of_week: 5, is_open: true,  open_time: '12:30', close_time: '19:00', slot_interval: 30 },
  { day_of_week: 6, is_open: true,  open_time: '12:30', close_time: '18:00', slot_interval: 30 },
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const future = new Date();
    future.setDate(future.getDate() + 120);
    const futureStr = future.toISOString().split('T')[0];

    const sb = getSupabase();
    const [schedResult, ovrResult] = await Promise.all([
      sb.from('availability').select('day_of_week,is_open,open_time,close_time,slot_interval').order('day_of_week'),
      sb.from('availability_overrides').select('date,is_closed,open_time,close_time,notes').gte('date', today).lte('date', futureStr),
    ]);

    if (schedResult.error) throw new Error(schedResult.error.message);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ schedule: schedResult.data || [], overrides: ovrResult.data || [] }),
    };
  } catch (err) {
    console.error('[get-availability] Falling back to default schedule:', err.message);
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ schedule: DEFAULT_SCHEDULE, overrides: [], _fallback: true }),
    };
  }
};
