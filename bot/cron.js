/* ═══════════════════════════════════════════
   KYTHIK HUB — bot/cron.js
   Runs every 30 minutes via Railway cron.
   - Refreshes comment counts from Discord
   - Refreshes expired image URLs
   - Auto-deletes records for deleted threads
   ═══════════════════════════════════════════ */

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE  = process.env.AIRTABLE_BASE;
const TABLE          = 'Strategies';
const DISCORD_TOKEN  = process.env.DISCORD_BOT_TOKEN;

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

function isImageAttachment(attachment) {
  if (attachment.content_type && attachment.content_type.startsWith('image/')) return true;
  const url = (attachment.url || '').toLowerCase().split('?')[0];
  return IMAGE_EXTENSIONS.some(ext => url.endsWith(ext));
}

/* ── AIRTABLE ───────────────────────────── */
async function getRecords() {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}` +
    `?fields[]=DiscordMessageURL&fields[]=CommentCount&fields[]=ImageURLs`;
  const res  = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
  });
  const data = await res.json();
  return data.records || [];
}

async function updateRecord(recordId, fields) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}/${recordId}`;
  await fetch(url, {
    method:  'PATCH',
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields })
  });
}

async function deleteRecord(recordId) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}/${recordId}`;
  await fetch(url, {
    method:  'DELETE',
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
  });
}

/* ── DISCORD ────────────────────────────── */
async function getThreadData(threadId) {
  const res = await fetch(
    `https://discord.com/api/v10/channels/${threadId}/messages?limit=100`,
    { headers: { Authorization: `Bot ${DISCORD_TOKEN}` } }
  );

  if (res.status === 404) return 'deleted';
  if (!res.ok) return null;

  const messages = await res.json();
  if (!Array.isArray(messages)) return null;

  // Comment count = all messages minus the first post
  const commentCount = Math.max(0, messages.length - 1);

  // Collect fresh image URLs from ALL messages
  const allImages = [];
  for (const msg of messages) {
    for (const a of (msg.attachments || [])) {
      if (isImageAttachment(a)) allImages.push(a.url);
    }
    for (const e of (msg.embeds || [])) {
      if (e.image?.url) allImages.push(e.image.url);
    }
  }
  const imageURLs = [...new Set(allImages)].join(', ');

  return { commentCount, imageURLs };
}

/* ── MAIN ───────────────────────────────── */
async function run() {
  console.log('Starting refresh...');
  const records = await getRecords();
  console.log(`Found ${records.length} records.`);

  let updated  = 0;
  let deleted  = 0;
  let skipped  = 0;
  let failed   = 0;

  for (const record of records) {
    const discordURL = record.fields.DiscordMessageURL;
    if (!discordURL) continue;

    const parts    = discordURL.split('/');
    const threadId = parts[parts.length - 1];

    try {
      const result = await getThreadData(threadId);

      if (result === 'deleted') {
        await deleteRecord(record.id);
        console.log(`✓ Deleted: ${discordURL}`);
        deleted++;
        await new Promise(r => setTimeout(r, 300));
        continue;
      }

      if (!result) {
        console.log(`Skipped ${threadId} — couldn't fetch`);
        skipped++;
        continue;
      }

      const { commentCount, imageURLs } = result;
      const patch = {};

      // Always update comment count
      patch.CommentCount = commentCount;

      // Update image URLs if they've changed (expired tokens get new ones)
      const existingURLs = (record.fields.ImageURLs || '')
        .split(', ')
        .map(u => u.split('?')[0])  // strip token params for comparison
        .filter(Boolean)
        .join(',');

      const freshURLs = imageURLs
        .split(', ')
        .map(u => u.split('?')[0])
        .filter(Boolean)
        .join(',');

      if (freshURLs !== existingURLs || imageURLs !== record.fields.ImageURLs) {
        patch.ImageURLs = imageURLs;
      }

      await updateRecord(record.id, patch);

      if (patch.ImageURLs) {
        console.log(`✓ Updated ${threadId} — comments: ${commentCount}, images refreshed`);
      } else {
        console.log(`✓ Updated ${threadId} — comments: ${commentCount}`);
      }

      updated++;

    } catch (err) {
      console.error(`✗ Failed ${threadId}: ${err.message}`);
      failed++;
    }

    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\nDone. Updated: ${updated}, Deleted: ${deleted}, Skipped: ${skipped}, Failed: ${failed}`);
}

run().catch(console.error);
