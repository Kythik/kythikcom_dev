/* ═══════════════════════════════════════════
   KYTHIK HUB — bot/backfill.js
   Migrate all existing Discord image URLs to Vercel Blob.

   Run once after deploying Blob integration:
   - Fetches all Airtable strategies
   - For each, fetches the Discord OP fresh
   - Uploads OP images to Blob
   - Updates Airtable ImageURLs to point to Blob URLs

   Run with: node backfill.js
   ═══════════════════════════════════════════ */

const { uploadDiscordImages } = require('./blob');

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE  = process.env.AIRTABLE_BASE;
const TABLE          = 'Strategies';
const DISCORD_TOKEN  = process.env.DISCORD_BOT_TOKEN;

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

function isImageAttachment(attachment) {
  if (attachment.content_type && attachment.content_type.startsWith('image/')) return true;
  const url = (attachment.url || attachment.proxy_url || '').toLowerCase().split('?')[0];
  return IMAGE_EXTENSIONS.some(ext => url.endsWith(ext));
}

function isBlobURL(url) {
  return !!url && url.includes('.public.blob.vercel-storage.com');
}

/* ── AIRTABLE ───────────────────────────── */
async function getAllRecords() {
  const records = [];
  let offset = null;
  while (true) {
    const fields = ['DiscordMessageURL', 'ImageURLs', 'PostedAt']
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

/* ── DISCORD ────────────────────────────── */
async function getOpDiscordURLs(threadId) {
  const res = await fetch(
    `https://discord.com/api/v10/channels/${threadId}/messages?limit=100`,
    { headers: { Authorization: `Bot ${DISCORD_TOKEN}` } }
  );
  if (!res.ok) return null;
  const messages = await res.json();
  if (!Array.isArray(messages) || !messages.length) return [];
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
  console.log('  Kythik Hub — Blob Backfill');
  console.log('═══════════════════════════════════\n');

  const records = await getAllRecords();
  console.log(`Loaded ${records.length} records.\n`);

  let migrated = 0;
  let alreadyMigrated = 0;
  let noImages = 0;
  let failed = 0;

  for (const record of records) {
    const f = record.fields;
    const discordURL = f.DiscordMessageURL;
    if (!discordURL) continue;

    // Skip if already migrated to Blob
    if (isBlobURL(f.ImageURLs)) {
      alreadyMigrated++;
      continue;
    }

    const threadId = discordURL.split('/').pop();

    try {
      const discordURLs = await getOpDiscordURLs(threadId);

      if (!discordURLs || !discordURLs.length) {
        noImages++;
        continue;
      }

      const blobURLs = await uploadDiscordImages(discordURLs, threadId);

      if (!blobURLs.length) {
        console.log(`✗ All uploads failed for ${threadId}`);
        failed++;
        continue;
      }

      await patchRecord(record.id, {
        ImageURLs:    blobURLs.join(', '),
        LastSyncedAt: new Date().toISOString(),
        MissingCount: 0,
      });

      console.log(`✓ Migrated ${blobURLs.length} images: ${threadId}`);
      migrated++;

    } catch (err) {
      console.error(`✗ Failed ${threadId}: ${err.message}`);
      failed++;
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n═══════════════════════════════════');
  console.log(`  Backfill complete`);
  console.log(`  Migrated:         ${migrated}`);
  console.log(`  Already on Blob:  ${alreadyMigrated}`);
  console.log(`  No OP images:     ${noImages}`);
  console.log(`  Failed:           ${failed}`);
  console.log('═══════════════════════════════════');
}

run().catch(console.error);
