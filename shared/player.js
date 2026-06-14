/* ═══════════════════════════════════════════
   player.js — Shared floating Twitch player
   Injects the mini player into any page with
   a <div id="floating-player"></div> placeholder.

   Requires CONFIG.TWITCH_CHANNEL and
   CONFIG.VERCEL_DOMAIN to be set before load:

     <script>
       const CONFIG = {
         TWITCH_CHANNEL: 'kythikx',
         VERCEL_DOMAIN:  'kythik.com',
       };
     </script>
     <script src="/player.js"></script>

   Also calls window.kythikUpdateLiveBadge(isLive)
   if available (from header.js), so the live badge
   stays in sync without a second /api/twitch fetch.
   ═══════════════════════════════════════════ */

(function () {
  const PLAYER_HTML = `
  <div class="fp" id="floatingPlayer">
    <div class="fp-screen">
      <div id="twitchSmall"></div>
    </div>
    <div class="fp-bar">
      <div class="fp-info">
        <div class="live-dot" id="fpDot"></div>
        <span class="fp-name">Kythik</span>
        <span class="fp-state" id="fpState"></span>
      </div>
      <div class="fp-actions">
        <button class="fp-unmute-btn" id="fpUnmuteBtn" onclick="window.kythikUnmutePlayer()" title="Unmute">🔇</button>
        <a class="fp-twitch-btn" href="https://twitch.tv/kythikx" target="_blank" rel="noopener">↗</a>
      </div>
    </div>
  </div>`;

  // Inject HTML
  const mount = document.getElementById('floating-player');
  if (mount) mount.outerHTML = PLAYER_HTML;

  // ── Init player ───────────────────────────
  async function init() {
    let isLive = false;
    let vodId  = null;

    try {
      const res  = await fetch('/api/twitch');
      const data = await res.json();
      isLive = !!data.isLive;
      vodId  = data.vodId || null;
    } catch(e) { console.warn('Twitch API failed', e); }

    updateUI(isLive);

    const channel = (window.CONFIG && CONFIG.TWITCH_CHANNEL) || 'kythikx';
    const domain  = (window.CONFIG && CONFIG.VERCEL_DOMAIN)  || 'kythik.com';
    const base    = `https://player.twitch.tv/?parent=${domain}&parent=www.${domain}&autoplay=true&muted=true`;
    const src     = isLive
      ? `${base}&channel=${channel}`
      : vodId
        ? `${base}&video=${vodId}`
        : `${base}&channel=${channel}`;

    const container = document.getElementById('twitchSmall');
    if (!container) return;

    const iframe           = document.createElement('iframe');
    iframe.src             = src;
    iframe.allowFullscreen = true;
    iframe.allow           = 'autoplay; fullscreen';
    iframe.style.cssText   = 'width:100%;height:100%;border:none;display:block;';
    container.appendChild(iframe);
    window.twitchIframe = iframe;
  }

  // ── Update live status UI ─────────────────
  function updateUI(isLive) {
    const fpState = document.getElementById('fpState');
    const fpDot   = document.getElementById('fpDot');

    if (fpState) fpState.textContent = isLive ? 'Live' : 'Latest VOD';
    if (fpDot && !isLive) fpDot.style.background = '#7a7a9a';

    // Sync header live badge if header.js loaded it
    if (window.kythikUpdateLiveBadge) window.kythikUpdateLiveBadge(isLive);
  }

  // ── Unmute toggle ─────────────────────────
  window.kythikUnmutePlayer = function () {
    const btn    = document.getElementById('fpUnmuteBtn');
    const iframe = window.twitchIframe;
    if (!iframe) return;
    const muted = iframe.src.includes('muted=true');
    iframe.src  = muted
      ? iframe.src.replace('muted=true',  'muted=false')
      : iframe.src.replace('muted=false', 'muted=true');
    if (btn) btn.textContent = muted ? '🔊' : '🔇';
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
