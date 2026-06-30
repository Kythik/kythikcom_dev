/* ═══════════════════════════════════════════
   KYTHIK HUB — bot/cron.js
   Runs every 6 hours via Railway cron.

   Image storage strategy: Blob caching (see bot/blob.js).
   Image URLs in Airtable are permanent Blob URLs.
   This cron NO LONGER refreshes image URLs — they never expire.

   Cron purpose now:
   - Soft-delete: detect threads that were deleted while bot was offline
   - Recover missing images: if a thread has no ImageURLs but Discord OP has images,
     upload them to Blob and update Airtable (catches bot-offline misses)
   - Update LastSyncedAt timestamp

   Airtable fields read/written:
   READ:  DiscordMessageURL, ImageURLs, PostedAt, LastSyncedAt, MissingCount
   WRITE: ImageURLs (only when recovering missing images),
          LastSyncedAt (when a write happens),
          MissingCount (when thread missing)
   NEVER WRITES: Title, Author, Tags, Body, CommentCount, Channel,
                 PostedAt, Featured
   ═══════════════════════════════════════════ */

const { uploadDiscordImages } = require('./blob');

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE  = process.env.AIRTABLE_BASE;
const TABLE          = 'Strategies';
const DISCORD_TOKEN  = process.env.DISCORD_BOT_TOKEN;

const MAX_MISSING_COUNT = 3;        // 3 consecutive misses → delete
const ANCIENT_DAYS      = 90;       // older than this = skip entirely

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

function isImageAttachment(attachment) {
  if (attachment.content_type && attachment.content_type.startsWith('image/')) return true;
  const url = (attachment.url || '').toLowerCase().split('?')[0];
  return IMAGE_EXTENSIONS.some(ext => url.endsWith(ext));
}

/* ── SEASON ─────────────────────────────── */
let SEASON_START = new Date('2026-04-16T19:00:00-07:00');
async function loadSeason() {
  try {
    const r = await fetch('https://www.kythik.com/torchlight/season.json');
    const cfg = await r.json();
    if (cfg.seasonStart) SEASON_START = new Date(cfg.seasonStart);
  } catch (e) {}
}
function isCurrentSeason(postedAt) {
  if (!postedAt) return true;
  return new Date(postedAt) >= SEASON_START;
}
function isAncient(postedAt) {
  if (!postedAt) return false;
  const ageDays = (Date.now() - new Date(postedAt).getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > ANCIENT_DAYS;
}

/* ── AIRTABLE ───────────────────────────── */
async function getAllRecords() {
  const records = [];
  let offset = null;

  while (true) {
    const fields = ['DiscordMessageURL', 'ImageURLs', 'PostedAt', 'LastSyncedAt', 'MissingCount']
      .map(f => `fields[]=${f}`).join('&');
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}?${fields}${offset ? `&offset=${offset}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
    const data = await res.json();
    if (data.error) throw new Error(JSON.stringify(data.error));
    records.push(...(data.records || []));
    if (!data.offset) break;
    offset = data.offset;
  }
  return records;
}

async function patchRecord(recordId, fields) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}/${recordId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
}

async function deleteRecord(recordId) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}/${recordId}`;
  await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
}

/* ── DISCORD ────────────────────────────── */
async function getOpDiscordURLs(threadId) {
  const res = await fetch(
    `https://discord.com/api/v10/channels/${threadId}/messages?limit=100`,
    { headers: { Authorization: `Bot ${DISCORD_TOKEN}` } }
  );
  if (res.status === 404) return 'deleted';
  if (!res.ok) return null;

  const messages = await res.json();
  if (!Array.isArray(messages) || !messages.length) return [];

  // Newest-first, so OP is last
  const op = messages[messages.length - 1];
  const urls = [];
  for (const a of (op.attachments || [])) {
    if (isImageAttachment(a)) urls.push(a.url);
  }
  for (const e of (op.embeds || [])) {
    if (e.image?.url) urls.push(e.image.url);
    if (e.thumbnail?.url) urls.push(e.thumbnail.url);
  }
  return [...new Set(urls)];
}

/* ── MAIN ───────────────────────────────── */
async function run() {
  console.log('═══════════════════════════════════');
  console.log(`  Kythik Hub — Cron Refresh`);
  console.log(`  ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════');

  await loadSeason();
  const records = await getAllRecords();
  console.log(`Loaded ${records.length} records.\n`);

  let recovered     = 0;   // had no images, now does
  let stillEmpty    = 0;   // had no images, OP has none either
  let healthy       = 0;   // already has Blob URLs, nothing to do
  let skippedSeason = 0;
  let skippedAncient= 0;
  let missingFlagged= 0;
  let deleted       = 0;
  let failed        = 0;

  for (const record of records) {
    const f = record.fields;
    const discordURL = f.DiscordMessageURL;
    if (!discordURL) continue;

    if (!isCurrentSeason(f.PostedAt)) { skippedSeason++; continue; }
    if (isAncient(f.PostedAt))        { skippedAncient++; continue; }

    const threadId = discordURL.split('/').pop();
    const hasImages = !!(f.ImageURLs && f.ImageURLs.trim());

    // If we already have Blob URLs, nothing to do most of the time.
    // But we still need to detect missing threads (404s).
    // To minimize Discord calls, only verify a thread exists if:
    //   - has no images (might be recoverable), OR
    //   - has missing count > 0 (track the soft-delete)
    if (hasImages && !f.MissingCount) {
      healthy++;
      continue;
    }

    try {
      const result = await getOpDiscordURLs(threadId);

      // Thread is gone
      if (result === 'deleted') {
        const missingCount = (f.MissingCount || 0) + 1;
        if (missingCount >= MAX_MISSING_COUNT) {
          await deleteRecord(record.id);
          console.log(`✗ Soft-delete: ${discordURL}`);
          deleted++;
        } else {
          await patchRecord(record.id, { MissingCount: missingCount });
          console.log(`? Missing (${missingCount}/${MAX_MISSING_COUNT}): ${discordURL}`);
          missingFlagged++;
        }
        await sleep(400);
        continue;
      }

      if (!result) { failed++; continue; }

      const discordURLs = result;
      const patch = {};

      // Thread exists — reset MissingCount if it was non-zero
      if (f.MissingCount && f.MissingCount > 0) {
        patch.MissingCount = 0;
      }

      // Recover missing images — only when current ImageURLs is empty
      if (!hasImages && discordURLs.length > 0) {
        const blobURLs = await uploadDiscordImages(discordURLs, threadId);
        if (blobURLs.length) {
          patch.ImageURLs = blobURLs.join(', ');
          patch.LastSyncedAt = new Date().toISOString();
          recovered++;
          console.log(`✓ Recovered ${blobURLs.length} images for ${threadId}`);
        } else {
          stillEmpty++;
        }
      } else if (!hasImages) {
        stillEmpty++;
      }

      if (Object.keys(patch).length > 0) {
        await patchRecord(record.id, patch);
      }

    } catch (err) {
      console.error(`✗ Failed ${threadId}: ${err.message}`);
      failed++;
    }

    await sleep(400);
  }

  console.log('\n═══════════════════════════════════');
  console.log(`  Cron complete`);
  console.log(`  Healthy:          ${healthy}`);
  console.log(`  Recovered images: ${recovered}`);
  console.log(`  Still empty:      ${stillEmpty}`);
  console.log(`  Skipped (season): ${skippedSeason}`);
  console.log(`  Skipped (ancient):${skippedAncient}`);
  console.log(`  Missing flagged:  ${missingFlagged}`);
  console.log(`  Deleted:          ${deleted}`);
  console.log(`  Failed:           ${failed}`);
  console.log('═══════════════════════════════════');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

run().catch(console.error);
