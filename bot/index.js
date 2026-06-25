/* ═══════════════════════════════════════════
   KYTHIK HUB — bot/index.js
   Live Discord bot — syncs forum threads to Airtable.

   Image policy: OP-only.
   Images come ONLY from the first message in each thread.
   Reply images are intentionally excluded — replies are
   discussion, not strategy content.

   Triggers:
   - threadCreate  → add record (OP body + images + tags + comment count)
   - threadUpdate  → update title/tags only
   - messageUpdate → update body + OP images (only if first message)
   - threadDelete  → remove record (current-season only)
   ═══════════════════════════════════════════ */

const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE  = process.env.AIRTABLE_BASE;
const TABLE          = 'Strategies';
const FARMS_CHANNEL  = process.env.FARMS_CHANNEL_ID;
const BUILDS_CHANNEL = process.env.BUILDS_CHANNEL_ID;

// Season config — loaded from season.json, refreshed every 6 hours
let SEASON_START = new Date('2026-04-16T19:00:00-07:00');

async function refreshSeasonConfig() {
  try {
    const r = await fetch('https://raw.githubusercontent.com/kythikx/kythik-hub/main/season.json');
    const cfg = await r.json();
    if (cfg.seasonStart) SEASON_START = new Date(cfg.seasonStart);
    console.log(`Season config loaded: ${cfg.seasonName} starts ${cfg.seasonStart}`);
  } catch(e) {
    console.warn('Could not load season.json, using default:', e.message);
  }
}

function isCurrentSeason(date) {
  if (!date) return true;
  return new Date(date) >= SEASON_START;
}

// Load on startup, refresh every 6 hours
refreshSeasonConfig();
setInterval(refreshSeasonConfig, 6 * 60 * 60 * 1000);

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

function isImageAttachment(a) {
  if (a.contentType && a.contentType.startsWith('image/')) return true;
  const url = (a.url || '').toLowerCase().split('?')[0];
  return IMAGE_EXTENSIONS.some(ext => url.endsWith(ext));
}

/* Get images from a single message (OP).
   This is the ONLY way images enter Airtable in this codebase. */
function getOpImages(message) {
  if (!message) return '';
  const images = [];
  for (const a of message.attachments.values()) {
    if (isImageAttachment(a)) images.push(a.url);
  }
  for (const e of (message.embeds || [])) {
    if (e.image?.url) images.push(e.image.url);
    if (e.thumbnail?.url) images.push(e.thumbnail.url);
  }
  return [...new Set(images)].join(', ');
}

/* ── AIRTABLE HELPERS ───────────────────── */
async function findRecord(discordURL) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}` +
    `?filterByFormula=${encodeURIComponent(`{DiscordMessageURL}="${discordURL}"`)}`;
  const res  = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
  const data = await res.json();
  return data.records && data.records.length ? data.records[0] : null;
}

async function addToAirtable(fields) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

async function updateAirtable(recordId, fields) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}/${recordId}`;
  const res  = await fetch(url, {
    method:  'PATCH',
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

async function deleteFromAirtable(discordURL) {
  const record = await findRecord(discordURL);
  if (!record) { console.log(`No record found for ${discordURL}`); return; }
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}/${record.id}`;
  await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
  console.log(`✓ Deleted record: ${record.id}`);
}

function getTags(thread) {
  if (!thread.appliedTags || !thread.parent) return '';
  return thread.appliedTags
    .map(tagId => {
      const tag = thread.parent.availableTags?.find(t => t.id === tagId);
      return tag ? tag.name : null;
    })
    .filter(Boolean)
    .join(', ');
}

function isOurChannel(parentId) {
  return parentId === FARMS_CHANNEL || parentId === BUILDS_CHANNEL;
}

function channelName(parentId) {
  return parentId === FARMS_CHANNEL ? 'Farms' : 'Builds';
}

/* ── THREAD CREATED ─────────────────────── */
client.on('threadCreate', async (thread) => {
  if (!isOurChannel(thread.parentId)) return;

  try {
    await new Promise(r => setTimeout(r, 2000));
    const messages     = await thread.messages.fetch({ limit: 100 });
    const op           = messages.last(); // first message = OP
    const content      = op ? op.content : '';
    const author       = op ? op.author.username : thread.ownerId;
    const opImages     = op ? getOpImages(op) : '';
    const commentCount = Math.max(0, messages.size - 1);
    const url          = `https://discord.com/channels/${thread.guildId}/${thread.id}`;
    const tags         = getTags(thread);

    await addToAirtable({
      Title:             thread.name,
      Author:            author,
      Channel:           channelName(thread.parentId),
      Body:              content,
      DiscordMessageURL: url,
      Tags:              tags,
      ImageURLs:         opImages,
      CommentCount:      commentCount,
      PostedAt:          thread.createdAt ? thread.createdAt.toISOString() : new Date().toISOString(),
      LastSyncedAt:      new Date().toISOString(),
      MissingCount:      0,
    });
    console.log(`✓ Saved: ${thread.name}`);
  } catch (err) {
    console.error('threadCreate error:', err.message);
  }
});

/* ── THREAD UPDATED (title/tags changed) ── */
client.on('threadUpdate', async (oldThread, newThread) => {
  if (!isOurChannel(newThread.parentId)) return;
  if (!isCurrentSeason(newThread.createdAt)) return; // ignore old season threads

  const titleChanged = oldThread.name !== newThread.name;
  const tagsChanged  = JSON.stringify(oldThread.appliedTags) !== JSON.stringify(newThread.appliedTags);
  if (!titleChanged && !tagsChanged) return;

  try {
    const url    = `https://discord.com/channels/${newThread.guildId}/${newThread.id}`;
    const record = await findRecord(url);
    if (!record) return;

    const patch = {};
    if (titleChanged) patch.Title = newThread.name;
    if (tagsChanged)  patch.Tags  = getTags(newThread);

    await updateAirtable(record.id, patch);
    console.log(`✓ Updated thread: ${newThread.name} (${Object.keys(patch).join(', ')})`);
  } catch (err) {
    console.error('threadUpdate error:', err.message);
  }
});

/* ── MESSAGE UPDATED (body/images changed) ─
   Only fires for the OP message (the first one in the thread).
   Reply edits are intentionally ignored — replies don't contribute
   images or body to the strategy record. */
client.on('messageUpdate', async (oldMsg, newMsg) => {
  if (!newMsg.channel || !newMsg.channel.parentId) return;
  if (!isOurChannel(newMsg.channel.parentId)) return;
  if (!isCurrentSeason(newMsg.channel.createdAt)) return; // ignore old season

  try {
    // Verify this is the OP message of the thread, not a reply
    const messages = await newMsg.channel.messages.fetch({ limit: 1, after: '0' });
    const firstMsg = messages.last();
    if (!firstMsg || firstMsg.id !== newMsg.id) return; // not the OP

    const url    = `https://discord.com/channels/${newMsg.guildId}/${newMsg.channel.id}`;
    const record = await findRecord(url);
    if (!record) return;

    await updateAirtable(record.id, {
      Body:         newMsg.content || '',
      ImageURLs:    getOpImages(newMsg),
      LastSyncedAt: new Date().toISOString(),
    });
    console.log(`✓ Updated OP body/images: ${newMsg.channel.name}`);
  } catch (err) {
    console.error('messageUpdate error:', err.message);
  }
});

/* ── THREAD DELETED ─────────────────────── */
client.on('threadDelete', async (thread) => {
  if (!isOurChannel(thread.parentId)) return;
  if (!isCurrentSeason(thread.createdAt)) return; // don't auto-delete old season archives
  try {
    const url = `https://discord.com/channels/${thread.guildId}/${thread.id}`;
    await deleteFromAirtable(url);
    console.log(`✓ Deleted: ${thread.name}`);
  } catch (err) {
    console.error('threadDelete error:', err.message);
  }
});

/* ── READY ──────────────────────────────── */
client.once('ready', () => {
  console.log(`Bot online: ${client.user.tag}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);
