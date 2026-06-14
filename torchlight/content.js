/* ═══════════════════════════════════════════
   content.js — Torchlight landing page
   Loads content.json and drives:
     · Featured carousel (via KythikCarousel)
     · Season card pre-processing (progress bar,
       next season row) before carousel init
     · Official YouTube grid (#ytOfficialSection)
     · Kythik YouTube grid (#ytKythikSection)
   ═══════════════════════════════════════════ */

(function () {

  /* ── Helpers ──────────────────────────────── */

  function parseYouTubeId(url) {
    if (!url) return null;
    try {
      return new URL(url).searchParams.get('v') || null;
    } catch {
      return null;
    }
  }

  /* ── YouTube card HTML ────────────────────── */

  function buildVideoCard(v) {
    const videoId = parseYouTubeId(v.link);
    const thumb = videoId
      ? `<img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt="${v.title}" loading="lazy" style="width:100%;height:100%;object-fit:contain;background:var(--bg-navy);display:block" />`
      : `<div style="height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg-navy)"><span>▶ Video</span></div>`;
    return `
      <a href="${v.link}" target="_blank" rel="noopener" style="text-decoration:none;display:block">
        <div class="card" style="cursor:pointer;overflow:hidden"><div class="card-inner" style="padding:0;position:relative">
          <div style="height:220px;overflow:hidden;border-radius:var(--radius-lg);position:relative;background:var(--bg-navy)">
            ${thumb}
            <div style="position:absolute;bottom:0;left:0;right:0;padding:10px 14px 12px;background:linear-gradient(to top,rgba(8,14,26,0.95) 0%,transparent 100%)">
              <h3 class="card-title" style="margin:0;font-size:13px">${v.title}</h3>
            </div>
          </div>
        </div></div>
      </a>`;
  }

  function buildSectionHeader(title, channelUrl, linkLabel) {
    return `
      <div class="hub-game-title">${title}</div>
      <a href="${channelUrl}" target="_blank" rel="noopener" class="hub-game-link">${linkLabel}</a>`;
  }

  /* ── Pre-process featured items ───────────── */

  function processFeatured(items) {
    return items.map(item => {
      if (item.type === 'season') {
        // Append progress bar + next season HTML directly into blurb
        // since shared-carousel renders item.blurb and nothing else extra
        return { ...item, blurb: (item.blurb || '') + buildSeasonMeta(item) };
      }
      return item;
    });
  }

  /* ── Main ─────────────────────────────────── */

  async function init() {
    const data = await fetch('/torchlight/content.json').then(r => r.json()).catch(() => ({}));

    // Featured carousel — season card rendering handled by shared-carousel.js
    if (data.featured && data.featured.length) {
      KythikCarousel.init({ mountId: 'tliCarousel', items: data.featured, autoRotateMs: 6000 });
    }

    // Resources grid
    if (data.resources && data.resources.length) {
      const section = document.getElementById('resourcesSection');
      const grid    = document.getElementById('resourcesGrid');
      grid.innerHTML = data.resources.map(r => `
        <div class="card"><div class="card-inner">
          <div class="card-top">
            <h3 class="card-title">${r.title}</h3>
          </div>
          <p class="subtext" style="margin:8px 0 14px">${r.blurb}</p>
          <a href="${r.link}" class="header-pill">${r.linkLabel}</a>
        </div></div>`).join('');
      section.style.display = 'block';
    }

    // Official (XD developer) YouTube videos
    if (data.officialYoutube && data.officialYoutube.length) {
      const section = document.getElementById('ytOfficialSection');
      const header  = document.getElementById('ytOfficialHeader');
      const grid    = document.getElementById('ytOfficialGrid');
      header.innerHTML = buildSectionHeader(
        'Developer Videos',
        'https://www.youtube.com/@TorchlightInfinite',
        'XD YouTube →'
      );
      grid.innerHTML = data.officialYoutube.map(buildVideoCard).join('');
      section.style.display = 'block';
    }

    // Kythik YouTube videos
    if (data.youtube && data.youtube.length) {
      const section = document.getElementById('ytKythikSection');
      const header  = document.getElementById('ytKythikHeader');
      const grid    = document.getElementById('ytKythikGrid');
      header.innerHTML = buildSectionHeader(
        'Latest from Kythik',
        'https://www.youtube.com/@kythikx',
        'More on YouTube →'
      );
      grid.innerHTML = data.youtube.map(buildVideoCard).join('');
      section.style.display = 'block';
    }
  }

  init();

})();
