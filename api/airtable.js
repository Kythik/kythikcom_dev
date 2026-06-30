/* ═══════════════════════════════════════════
   api/airtable.js — Vercel serverless function
   CDN-cached via Cache-Control headers.
   Vercel CDN caches the response for 6hrs,
   so Airtable is only hit when cache expires.
   ═══════════════════════════════════════════ */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // CDN caches for 6hrs, serves stale for 1hr while revalidating
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=3600');

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const BASE           = process.env.AIRTABLE_BASE;
  const TABLE          = 'Strategies';

  if (!AIRTABLE_TOKEN || !BASE) {
    return res.status(500).json({ error: 'Missing Airtable credentials.' });
  }

  try {
    let SEASON_START = '2026-04-16T19:00:00-07:00';
    let SEASON_NAME  = 'SS12: Lunaria';
    try {
      const cfg = await fetch('https://www.kythik.com/torchlight/season.json').then(r => r.json());
      if (cfg.seasonStart) SEASON_START = cfg.seasonStart;
      if (cfg.seasonName)  SEASON_NAME  = cfg.seasonName;
    } catch(e) { /* use defaults */ }

    const seasonISO = new Date(SEASON_START).toISOString();
    const formula   = encodeURIComponent(
      `OR(IS_AFTER({PostedAt}, '${seasonISO}'), AND({PostedAt}='', IS_AFTER({Created}, '${seasonISO}')))`
    );

    const url = `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}?filterByFormula=${formula}&sort[0][field]=Created&sort[0][direction]=desc&maxRecords=100`;

    const airtableRes = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
    if (!airtableRes.ok) throw new Error(`Airtable ${airtableRes.status}`);

    const data    = await airtableRes.json();
    const records = (data.records || []).map(r => ({ id: r.id, ...r.fields }));

    // lastUpdated = the latest LastSyncedAt across records (when bot/cron actually
    // touched data). NOT the current request time, which would defeat CDN caching
    // and always read as "just now" on the frontend.
    const syncTimes = records
      .map(r => r.LastSyncedAt)
      .filter(Boolean)
      .map(t => new Date(t).getTime());

    const lastUpdated = syncTimes.length
      ? new Date(Math.max(...syncTimes)).toISOString()
      : null;

    return res.status(200).json({
      records,
      season:      SEASON_NAME,
      seasonStart: SEASON_START,
      lastUpdated,
      count:       records.length,
    });

  } catch (err) {
    console.error('airtable.js error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
