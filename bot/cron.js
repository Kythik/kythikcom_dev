/* ═══════════════════════════════════════════
   KYTHIK HUB — bot/cron.js
   Runs every 6 hours via Railway cron.

   Strategy:
   - Diff-based writes — only PATCH when something actually changed
   - Age-tiered refresh — recent threads checked every run,
     mid-age daily, old weekly, ancient skipped
   - Soft-delete — 3 consecutive misses before deleting (safety net)
   - Season-aware — old-season records skipped entirely
   - Comment count drift alone never triggers a write
     (displayed as "N+" on the frontend)

   Airtable fields read/written:
   READ:  DiscordMessageURL, CommentCount, ImageURLs, PostedAt,
          LastSyncedAt, MissingCount
   WRITE: ImageURLs (only on change),
          LastSyncedAt (when image url changes),
          MissingCount (when thread missing)
   NEVER WRITES: Featured (manual field), Title, Author, Tags,
                 Body, CommentCount, Channel, PostedAt
   ═══════════════════════════════════════════ */

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE  = process.env.AIRTABLE_BASE;
const TABLE          = 'Strategies';
const DISCORD_TOKEN  = process.env.DISCORD_BOT_TOKEN;

// Soft-delete threshold: how many consecutive cron runs a thread
// can be missing before we delete the Airtable record.
// At 6hr cadence × 3 misses = ~18 hours buffer.
const MAX_MISSING_COUNT = 3;

// Age tiers — how old a record can be (PostedAt) and still be refreshed.
// Older than ANCIENT_DAYS = skipped entirely.
const RECENT_DAYS  = 7;   // refresh every cron run (every 6hr)
const MID_DAYS     = 30;  // refresh once per day
const ANCIENT_DAYS = 90;  // older = skip entirely

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

function isImageAttachment(attachment) {
  if (attachment.content_type && attachment.content_type.startsWith('image/')) return true;
  const url = (attachment.url || '').toLowerCase().split('?')[0];
  return IMAGE_EXTENSIONS.some(ext => url.endsWith(ext));
}

/* ── SEASON CONFIG ──────────────────────── */
let SEASON_START = new Date('2026-04-16T19:00:00-07:00');
async function loadSeason() {
  try {
    const r = await fetch('https://raw.githubusercontent.com/kythikx/kythik-hub/main/season.json');
    const cfg = await r.json();
    if (cfg.seasonStart) SEASON_START = new Date(cfg.seasonStart);
  } catch (e) { /* use default */ }
}

function isCurrentSeason(postedAt) {
  if (!postedAt) return true;
  return new Date(postedAt) >= SEASON_START;
}

/* ── TIER CLASSIFICATION ────────────────── */
function getTier(postedAt, lastSyncedAt) {
  if (!postedAt) return 'recent'; // be conservative if we don't know

  const now      = Date.now();
  const ageMs    = now - new Date(postedAt).getTime();
  const ageDays  = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays > ANCIENT_DAYS) return 'skip';

  // Tier check based on POST age determines REFRESH cadence
  if (ageDays <= RECENT_DAYS) return 'recent';  // every run
  if (ageDays <= MID_DAYS)    return 'mid';     // every 24hr
  return 'old';                                  // every 7d

  // Synced-age check happens in shouldRefresh below
}

function shouldRefresh(tier, lastSyncedAt) {
  if (tier === 'skip') return false;
  if (tier === 'recent') return true; // always refresh recent

  if (!lastSyncedAt) return true; // never synced, must refresh

  const syncedAgeMs   = Date.now() - new Date(lastSyncedAt).getTime();
  const syncedAgeHrs  = syncedAgeMs / (1000 * 60 * 60);

  if (tier === 'mid') return syncedAgeHrs >= 24;
  if (tier === 'old') return syncedAgeHrs >= 168; // 7 days
  return true;
}

/* ── AIRTABLE ───────────────────────────── */
async function getAllRecords() {
  const records = [];
  let offset = null;

  while (true) {
    const fields = [
      'DiscordMessageURL',
      'CommentCount',
      'ImageURLs',
      'PostedAt',
      'LastSyncedAt',
      'MissingCount',
    ].map(f => `fields[]=${f}`).join('&');

    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}?${fields}${offset ? `&offset=${offset}` : ''}`;
    const res  = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
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
    method:  'PATCH',
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields })
  });
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
}

async function deleteRecord(recordId) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}/${recordId}`;
  await fetch(url, {
    method:  'DELETE',
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
  });
}

/* ── DISCORD ────────────────────────────── */
/* Fetch ONLY the OP (first message) — reply images intentionally excluded. */
async function getOpImages(threadId) {
  // Get first message in the thread (the OP)
  const res = await fetch(
    `https://discord.com/api/v10/channels/${threadId}/messages?limit=100&after=0`,
    { headers: { Authorization: `Bot ${DISCORD_TOKEN}` } }
  );

  if (res.status === 404) return 'deleted';
  if (!res.ok) return null;

  const messages = await res.json();
  if (!Array.isArray(messages) || !messages.length) return { imageURLs: '' };

  // The OP is the oldest message — last one in the chronologically-descending list
  // (Discord returns messages newest-first by default)
  const op = messages[messages.length - 1];

  const opImages = [];
  for (const a of (op.attachments || [])) {
    if (isImageAttachment(a)) opImages.push(a.url);
  }
  for (const e of (op.embeds || [])) {
    if (e.image?.url)     opImages.push(e.image.url);
    if (e.thumbnail?.url) opImages.push(e.thumbnail.url);
  }

  const imageURLs = [...new Set(opImages)].join(', ');
  return { imageURLs };
}

/* ── IMAGE URL DIFF ─────────────────────── */
/* Strips Discord CDN tokens so we don't trigger false "changed" detections.
   Discord image URLs have ?ex=...&is=...&hm=... tokens that rotate. */
function normalizeImageList(str) {
  return (str || '')
    .split(', ')
    .map(u => u.trim().split('?')[0])
    .filter(Boolean)
    .sort()
    .join(',');
}

function imagesChanged(existing, fresh) {
  return normalizeImageList(existing) !== normalizeImageList(fresh);
}

/* ── MAIN ───────────────────────────────── */
async function run() {
  console.log('═══════════════════════════════════');
  console.log('  Kythik Hub — Cron Refresh');
  console.log(`  ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════');

  await loadSeason();
  console.log(`Season start: ${SEASON_START.toISOString()}`);

  const records = await getAllRecords();
  console.log(`Loaded ${records.length} Airtable records.`);

  let writes        = 0;
  let skippedTier   = 0;
  let skippedSeason = 0;
  let skippedSync   = 0;
  let skippedSame   = 0;
  let deleted       = 0;
  let softDeleted   = 0;
  let missingPlus   = 0;
  let failed        = 0;

  for (const record of records) {
    const f          = record.fields;
    const discordURL = f.DiscordMessageURL;
    if (!discordURL) continue;

    // Skip old-season records entirely
    if (!isCurrentSeason(f.PostedAt)) {
      skippedSeason++;
      continue;
    }

    const tier = getTier(f.PostedAt);

    if (tier === 'skip') {
      skippedTier++;
      continue;
    }

    if (!shouldRefresh(tier, f.LastSyncedAt)) {
      skippedSync++;
      continue;
    }

    const threadId = discordURL.split('/').pop();

    try {
      const result = await getOpImages(threadId);

      // ── Missing thread (404) ──
      if (result === 'deleted') {
        const missingCount = (f.MissingCount || 0) + 1;

        if (missingCount >= MAX_MISSING_COUNT) {
          await deleteRecord(record.id);
          console.log(`✗ Soft-delete after ${missingCount} misses: ${discordURL}`);
          deleted++;
        } else {
          await patchRecord(record.id, { MissingCount: missingCount });
          console.log(`? Missing (${missingCount}/${MAX_MISSING_COUNT}): ${discordURL}`);
          missingPlus++;
        }
        await sleep(400);
        continue;
      }

      // ── Couldn't fetch (Discord error other than 404) ──
      if (!result) {
        console.log(`! Skipped (fetch failed): ${threadId}`);
        failed++;
        continue;
      }

      const { imageURLs } = result;
      const patch = {};

      // Reset MissingCount if it was non-zero (we found it again)
      if (f.MissingCount && f.MissingCount > 0) {
        patch.MissingCount = 0;
      }

      // Only write image URLs if they meaningfully changed
      if (imagesChanged(f.ImageURLs, imageURLs)) {
        patch.ImageURLs = imageURLs;
        patch.LastSyncedAt = new Date().toISOString();
      } else if (!f.LastSyncedAt) {
        // First sync ever — record it
        patch.LastSyncedAt = new Date().toISOString();
      }

      // ── No actual changes → no write ──
      if (Object.keys(patch).length === 0) {
        skippedSame++;
        await sleep(200); // still pace Discord calls
        continue;
      }

      await patchRecord(record.id, patch);
      writes++;
      console.log(`✓ Updated ${threadId}: ${Object.keys(patch).join(', ')}`);

    } catch (err) {
      console.error(`✗ Failed ${threadId}: ${err.message}`);
      failed++;
    }

    await sleep(400);
  }

  console.log('\n═══════════════════════════════════');
  console.log(`  Cron complete`);
  console.log(`  Writes:         ${writes}`);
  console.log(`  Skipped (same): ${skippedSame}`);
  console.log(`  Skipped (sync): ${skippedSync}`);
  console.log(`  Skipped (tier): ${skippedTier}`);
  console.log(`  Skipped (season):${skippedSeason}`);
  console.log(`  Missing flagged:${missingPlus}`);
  console.log(`  Deleted:        ${deleted}`);
  console.log(`  Failed:         ${failed}`);
  console.log('═══════════════════════════════════');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

run().catch(console.error);
