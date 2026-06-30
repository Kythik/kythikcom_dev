/* ═══════════════════════════════════════════
   bot/blob.js
   Helper for uploading Discord images to Vercel Blob.
   Returns a permanent Blob URL the frontend can use forever.
   ═══════════════════════════════════════════ */

const { put, del } = require('@vercel/blob');

/* Detect file extension from a Discord URL (strip query params first). */
function getExt(url) {
  const clean = url.split('?')[0].toLowerCase();
  const match = clean.match(/\.(png|jpg|jpeg|gif|webp)$/i);
  return match ? match[1] : 'png';
}

/* Download a Discord image and upload it to Blob.
   Returns the permanent Blob URL, or null on failure. */
async function uploadDiscordImage(discordURL, threadId, index) {
  try {
    const res = await fetch(discordURL);
    if (!res.ok) {
      console.warn(`Blob upload skipped — Discord returned ${res.status} for ${discordURL}`);
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = getExt(discordURL);
    const pathname = `strats/${threadId}/${index}.${ext}`;

    const result = await put(pathname, buffer, {
      access: 'public',
      contentType: res.headers.get('content-type') || `image/${ext}`,
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    return result.url;
  } catch (err) {
    console.error(`Blob upload failed for ${discordURL}:`, err.message);
    return null;
  }
}

/* Upload an array of Discord URLs to Blob.
   Returns an array of Blob URLs (or empty array if all failed). */
async function uploadDiscordImages(discordURLs, threadId) {
  if (!discordURLs || !discordURLs.length) return [];

  const results = [];
  for (let i = 0; i < discordURLs.length; i++) {
    const blobURL = await uploadDiscordImage(discordURLs[i], threadId, i);
    if (blobURL) results.push(blobURL);
  }
  return results;
}

/* Delete all Blob images for a thread (called when thread is deleted). */
async function deleteThreadBlobs(threadId) {
  try {
    // Vercel Blob doesn't have a "delete by prefix" — but we know our naming pattern
    // so we can attempt to delete each one. We use list() for cleanup.
    const { list } = require('@vercel/blob');
    const result = await list({ prefix: `strats/${threadId}/` });
    if (result.blobs && result.blobs.length) {
      for (const b of result.blobs) {
        await del(b.url);
      }
      console.log(`✓ Deleted ${result.blobs.length} Blob(s) for thread ${threadId}`);
    }
  } catch (err) {
    console.error(`Failed to delete Blobs for thread ${threadId}:`, err.message);
  }
}

module.exports = {
  uploadDiscordImage,
  uploadDiscordImages,
  deleteThreadBlobs,
};
