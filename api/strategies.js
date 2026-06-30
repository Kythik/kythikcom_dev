/* ═══════════════════════════════════════════
   api/strategies.js — Public API endpoint
   Key-protected. Returns clean strategy JSON
   for third-party use.

   Usage: /api/strategies?key=YOUR_KEY
   or:    Authorization: Bearer YOUR_KEY

   Implementation: This endpoint calls /api/airtable internally
   instead of hitting Airtable directly. That way all API
   consumers share the same 6hr CDN cache layer — no matter
   how many keys are issued, Airtable is only hit once per
   cache window. Protects against cache-busting / abusive
   developers eating the API call budget.
   ═══════════════════════════════════════════ */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=3600');

  // ── Key check ────────────────────────────
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

  // ── Fetch from internal /api/airtable (cache-shared) ──
  try {
    // Build absolute URL to our own /api/airtable endpoint
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host     = req.headers.host;
    const internalURL = `${protocol}://${host}/api/airtable`;

    const internalRes = await fetch(internalURL);
    if (!internalRes.ok) {
      throw new Error(`Internal airtable endpoint returned ${internalRes.status}`);
    }
    const data = await internalRes.json();

    // ── Reshape to public API format ──
    const strategies = (data.records || []).map(r => ({
      title:      r.Title || '',
      author:     r.Author || '',
      channel:    r.Channel || '',
      tags:       r.Tags || '',
      body:       r.Body || '',
      imageURLs:  r.ImageURLs || '',
      discordURL: r.DiscordMessageURL || '',
      comments:   r.CommentCount || 0,
      postedAt:   r.PostedAt || r.Created || '',
      featured:   r.Featured || false,
    }));

    return res.status(200).json({
      source:      'kythik.com',
      season:      data.season || 'Unknown',
      seasonStart: data.seasonStart || null,
      lastUpdated: data.lastUpdated || new Date().toISOString(),
      count:       strategies.length,
      strategies,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
