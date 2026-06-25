/* ═══════════════════════════════════════════
   KYTHIK HUB — bot/backfill.js
   One-time script to import/update existing
   Discord forum threads in Airtable.

   Image policy: OP-only.
   Images come from the first message in each thread.
   Replies are excluded — they're discussion, not strategy content.

   Run with: node backfill.js
   ═══════════════════════════════════════════ */

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE  = process.env.AIRTABLE_BASE;
const TABLE          = 'Strategies';
const DISCORD_TOKEN  = process.env.DISCORD_BOT_TOKEN;
const FARMS_CHANNEL  = process.env.FARMS_CHANNEL_ID;
const BUILDS_CHANNEL = process.env.BUILDS_CHANNEL_ID;

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

function isImageAttachment(attachment) {
  if (attachment.content_type && attachment.content_type.startsWith('image/')) return true;
  const url = (attachment.url || attachment.proxy_url || '').toLowerCase().split('?')[0];
  return IMAGE_EXTENSIONS.some(ext => url.endsWith(ext));
}

/* ── DISCORD HELPERS ────────────────────── */

async function getChannelTags(channelId) {
  const res = await fetch(
    `https://discord.com/api/v10/channels/${channelId}`,
    { headers: { Authorization: `Bot ${DISCORD_TOKEN}` } }
  );
  if (!res.ok) return {};
  const data = await res.json();
  const map = {};
  (data.available_tags || []).forEach(t => { map[t.id] = t.name; });
  return map;
}

async function getGuildId(channelId) {
  const res = await fetch(
    `https://discord.com/api/v10/channels/${channelId}`,
    { headers: { Authorization: `Bot ${DISCORD_TOKEN}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.guild_id;
}

async function getActiveThreads(channelId) {
  const guildId = await getGuildId(channelId);
  if (!guildId) return [];

  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/threads/active`,
    { headers: { Authorization: `Bot ${DISCORD_TOKEN}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.threads || []).filter(t => String(t.parent_id) === String(channelId));
}

async function getArchivedThreads(channelId) {
  const threads = [];
  let before = null;

  while (true) {
    const url = `https://discord.com/api/v10/channels/${channelId}/threads/archived/public?limit=100` +
      (before ? `&before=${before}` : '');

    const res = await fetch(url, { headers: { Authorization: `Bot ${DISCORD_TOKEN}` } });
    if (!res.ok) { console.error(`Failed to fetch archived threads: ${res.status}`); break; }

    const data = await res.json();
    threads.push(...(data.threads || []));

    if (!data.has_more) break;
    const last = data.threads[data.threads.length - 1];
    before = last.thread_metadata.archive_timestamp;
  }

  return threads;
}

/* Get thread data — body + author from OP, comment count from total messages,
   IMAGES ONLY FROM THE OP (replies intentionally excluded). */
async function getThreadData(threadId) {
  const res = await fetch(
    `https://discord.com/api/v10/channels/${threadId}/messages?limit=100`,
    { headers: { Authorization: `Bot ${DISCORD_TOKEN}` } }
  );
  if (!res.ok) return { content: '', author: '', images: '', commentCount: 0 };

  const messages = await res.json();
  if (!messages.length) return { content: '', author: '', images: '', commentCount: 0 };

  // OP = oldest message = last one in newest-first response
  const op = messages[messages.length - 1];

  const opImages = [];
  for (const a of (op.attachments || [])) {
    if (isImageAttachment(a)) opImages.push(a.url);
  }
  for (const e of (op.embeds || [])) {
    if (e.image?.url)     opImages.push(e.image.url);
    if (e.thumbnail?.url) opImages.push(e.thumbnail.url);
  }

  return {
    content:      op.content || '',
    author:       op.author?.username || '',
    images:       [...new Set(opImages)].join(', '),
    commentCount: Math.max(0, messages.length - 1),
  };
}

/* ── AIRTABLE HELPERS ───────────────────── */
async function getExistingRecords() {
  const existing = new Map();
  let offset = null;

  while (true) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}` +
      `?fields[]=DiscordMessageURL&fields[]=ImageURLs&fields[]=Tags&fields[]=PostedAt&fields[]=LastSyncedAt${offset ? `&offset=${offset}` : ''}`;

    const res  = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
    const data = await res.json();

    (data.records || []).forEach(r => {
      if (r.fields.DiscordMessageURL) {
        existing.set(r.fields.DiscordMessageURL, {
          id:           r.id,
          hasImages:    !!r.fields.ImageURLs,
          hasTags:      !!r.fields.Tags,
          hasPostedAt:  !!r.fields.PostedAt,
          hasLastSync:  !!r.fields.LastSyncedAt,
        });
      }
    });

    if (!data.offset) break;
    offset = data.offset;
  }

  return existing;
}

async function addToAirtable(record) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields: record })
  });
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data;
}

async function patchAirtable(recordId, fields) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}/${recordId}`;
  const res  = await fetch(url, {
    method:  'PATCH',
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields })
  });
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
}

/* ── MAIN ───────────────────────────────── */
async function run() {
  console.log('═══════════════════════════════════');
  console.log('  Kythik Hub — Backfill Script');
  console.log('  (OP images only)');
  console.log('═══════════════════════════════════');

  console.log('\nFetching channel tag maps...');
  const [farmsTags, buildsTags] = await Promise.all([
    getChannelTags(FARMS_CHANNEL),
    getChannelTags(BUILDS_CHANNEL),
  ]);
  console.log(`Farms tags: ${Object.values(farmsTags).join(', ') || 'none'}`);
  console.log(`Builds tags: ${Object.values(buildsTags).join(', ') || 'none'}`);

  const tagMaps = { Farms: farmsTags, Builds: buildsTags };

  console.log('\nChecking existing Airtable records...');
  const existingRecords = await getExistingRecords();
  console.log(`Found ${existingRecords.size} existing records.`);

  console.log('\nFetching Discord threads...');
  const [farmsActive, farmsArchived] = await Promise.all([
    getActiveThreads(FARMS_CHANNEL),
    getArchivedThreads(FARMS_CHANNEL),
  ]);
  const [buildsActive, buildsArchived] = await Promise.all([
    getActiveThreads(BUILDS_CHANNEL),
    getArchivedThreads(BUILDS_CHANNEL),
  ]);

  console.log(`Farms: ${farmsActive.length} active, ${farmsArchived.length} archived`);
  console.log(`Builds: ${buildsActive.length} active, ${buildsArchived.length} archived`);

  const allThreads = [
    ...[...farmsActive, ...farmsArchived].map(t => ({ ...t, channelName: 'Farms' })),
    ...[...buildsActive, ...buildsArchived].map(t => ({ ...t, channelName: 'Builds' })),
  ];

  console.log(`Total threads: ${allThreads.length}`);

  let imported = 0;
  let updated  = 0;
  let skipped  = 0;
  let failed   = 0;

  for (const thread of allThreads) {
    const guildId    = thread.guild_id;
    const discordURL = `https://discord.com/channels/${guildId}/${thread.id}`;
    const existing   = existingRecords.get(discordURL);

    const tagMap = tagMaps[thread.channelName] || {};
    const tags   = (thread.applied_tags || [])
      .map(id => tagMap[id] || null)
      .filter(Boolean)
      .join(', ');

    try {
      const { content, author, images, commentCount } = await getThreadData(thread.id);

      const postedAt = thread.thread_metadata?.create_timestamp
        || thread.timestamp
        || null;

      if (existing) {
        const patch = {};
        if (!existing.hasImages && images)         patch.ImageURLs    = images;
        if (!existing.hasTags && tags)             patch.Tags         = tags;
        if (!existing.hasPostedAt && postedAt)     patch.PostedAt     = postedAt;
        if (!existing.hasLastSync)                 patch.LastSyncedAt = new Date().toISOString();

        if (Object.keys(patch).length) {
          await patchAirtable(existing.id, patch);
          console.log(`✓ Updated: ${thread.name} (${Object.keys(patch).join(', ')})`);
          updated++;
        } else {
          skipped++;
        }
      } else {
        await addToAirtable({
          Title:             thread.name,
          Author:            author,
          Channel:           thread.channelName,
          Body:              content,
          DiscordMessageURL: discordURL,
          ImageURLs:         images,
          Tags:              tags,
          CommentCount:      commentCount,
          PostedAt:          postedAt,
          LastSyncedAt:      new Date().toISOString(),
          MissingCount:      0,
        });
        console.log(`✓ Imported: ${thread.name}`);
        imported++;
      }

      await new Promise(resolve => setTimeout(resolve, 250));

    } catch (err) {
      console.error(`✗ Failed: ${thread.name} — ${err.message}`);
      failed++;
    }
  }

  console.log('\n═══════════════════════════════════');
  console.log(`  Done!`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Updated:  ${updated}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Failed:   ${failed}`);
  console.log('═══════════════════════════════════');
}

run().catch(console.error);
