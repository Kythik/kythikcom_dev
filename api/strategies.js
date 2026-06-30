/* ═══════════════════════════════════════════
   api/strategies.js — Public API endpoint
   Key-protected. Returns clean strategy JSON
   for third-party use.
   Usage: /api/strategies?key=YOUR_KEY
   or: Authorization: Bearer YOUR_KEY
   ═══════════════════════════════════════════ */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=3600');

  // Key check — query param or Authorization header
  const VALID_KEYS = [
    process.env.API_KEY_1,
    process.env.API_KEY_2,
    process.env.API_KEY_3,
  ].filter(Boolean);

  const providedKey =
    req.query.key ||
    (req.headers.authorization || '').replace('Bearer ', '').trim();

  if (!providedKey || !VALID_KEYS.includes(providedKey)) {
    return res.status(401).json({
      error: 'Unauthorized. Contact kythik.com to request API access.',
    });
  }

  const TOKEN = process.env.AIRTABLE_TOKEN;
  const BASE  = process.env.AIRTABLE_BASE;
  const TABLE = 'Strategies';
  const seasonCfg   = await fetch('https://www.kythik.com/torchlight/season.json').then(r => r.json()).catch(() => ({ seasonStart: '2026-04-16T19:00:00-07:00', seasonName: 'Unknown' }));
  const SEASON_START = seasonCfg.seasonStart;
  const SEASON_NAME  = seasonCfg.seasonName;

  try {
    const formula = `IS_AFTER({PostedAt}, '${new Date(SEASON_START).toISOString()}')`;

    const url = [
      `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}`,
      `?filterByFormula=${encodeURIComponent(formula)}`,
      '&sort[0][field]=PostedAt',
      '&sort[0][direction]=desc',
      '&maxRecords=100'
    ].join('');

    const airtableRes = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });

    if (!airtableRes.ok) throw new Error(`Airtable ${airtableRes.status}`);

    const data = await airtableRes.json();

    // Clean output — no internal Airtable IDs exposed
    const strategies = (data.records || []).map(r => ({
      title:      r.fields.Title || '',
      author:     r.fields.Author || '',
      channel:    r.fields.Channel || '',
      tags:       r.fields.Tags || '',
      body:       r.fields.Body || '',
      imageURLs:  r.fields.ImageURLs || '',
      discordURL: r.fields.DiscordMessageURL || '',
      comments:   r.fields.CommentCount || 0,
      postedAt:   r.fields.PostedAt || r.fields.Created || '',
      featured:   r.fields.Featured || false,
    }));

    return res.status(200).json({
      source:      'kythik.com',
      season:      SEASON_NAME,
      seasonStart: SEASON_START,
      lastUpdated: new Date().toISOString(),
      count:       strategies.length,
      strategies,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
