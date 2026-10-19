// Public event facts for the pages. Server-side equivalents live in netlify/functions/_vendor-event.cjs.
export const vendorEvent = {
  name: 'Health & Financial Wellness Event',
  date: 'Friday, November 6, 2026',
  dateShort: 'Fri, Nov 6',
  time: '10:00 AM – 1:00 PM',
  location: 'Bliss Dermacare',
  address: '8905 Regents Park Dr, Tampa, FL 33647',
  fee: 25,
  // Last moment the homepage feature is shown (event day, 1 PM ET = 18:00 UTC in November)
  endsAt: '2026-11-06T18:00:00Z',
  samplePolicy: 'Sample-size items only: trial/travel sizes, single-use packets, or small tasting portions. Full-size products are not permitted at vendor tables.',
};
