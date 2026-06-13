/* ═══════════════════════════════════════════
   api/twitch.js — Vercel serverless function
   Checks if kythikx is live. If not, returns
   the most recent VOD id.
   ═══════════════════════════════════════════ */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');

  const CLIENT_ID     = process.env.TWITCH_CLIENT_ID;
  const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
  const LOGIN         = 'kythikx';

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).json({ error: 'Missing Twitch credentials in environment.' });
  }

  try {
    // 1. Get app access token
    const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`
    });

    if (!tokenRes.ok) throw new Error(`Token fetch failed: ${tokenRes.status}`);
    const { access_token } = await tokenRes.json();

    const headers = {
      'Client-ID':     CLIENT_ID,
      'Authorization': `Bearer ${access_token}`
    };

    // 2. Check if live
    const streamRes  = await fetch(`https://api.twitch.tv/helix/streams?user_login=${LOGIN}`, { headers });
    if (!streamRes.ok) throw new Error(`Stream check failed: ${streamRes.status}`);
    const streamData = await streamRes.json();
    const isLive     = streamData.data && streamData.data.length > 0;

    if (isLive) {
      return res.status(200).json({ isLive: true, vodId: null });
    }

    // 3. Not live — get latest VOD
    const userRes  = await fetch(`https://api.twitch.tv/helix/users?login=${LOGIN}`, { headers });
    if (!userRes.ok) throw new Error(`User fetch failed: ${userRes.status}`);
    const userData = await userRes.json();

    if (!userData.data || !userData.data.length) {
      return res.status(200).json({ isLive: false, vodId: null });
    }

    const userId  = userData.data[0].id;
    const vodRes  = await fetch(
      `https://api.twitch.tv/helix/videos?user_id=${userId}&type=archive&first=1`,
      { headers }
    );
    if (!vodRes.ok) throw new Error(`VOD fetch failed: ${vodRes.status}`);
    const vodData = await vodRes.json();
    const vodId   = vodData.data && vodData.data.length > 0 ? vodData.data[0].id : null;

    return res.status(200).json({ isLive: false, vodId });

  } catch (err) {
    console.error('Twitch API error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
