/* ═══════════════════════════════════════════
   content.js — Game landing page content loader
   Universal pattern — used by all game pages.

   Drives three optional sections from content.json:
     featured        → rotating carousel (always game-scoped)
     youtube_official → "From the Developer" video grid
     youtube_kythik   → "Videos" (Kythik's own content) grid

   Each section only renders if its array exists
   and has at least one item. Empty or missing =
   section not shown. No code changes needed to
   add/remove sections — just edit content.json.

   Config at top of file:
     OFFICIAL_CHANNEL  → developer's YouTube channel URL
     KYTHIK_CHANNEL    → your YouTube channel URL
     CAROUSEL_MOUNT_ID → must match the id on the
                         featured-section element in the HTML
   ═══════════════════════════════════════════ */

(function () {
  const OFFICIAL_CHANNEL  = 'https://www.youtube.com/@TorchlightInfinite';
  const KYTHIK_CHANNEL    = 'https://www.youtube.com/@kythikx';
  const CAROUSEL_MOUNT_ID = 'tliCarousel';
  const CONTENT_JSON_PATH = '/torchlight/content.json';

  function parseYouTubeId(url) {
    if (!url) return null;
    try { return new URL(url).searchParams.get('v') || null; } catch { return null; }
  }

  function renderVideoGrid(videos) {
    return videos.map(v => {
      const videoId = parseYouTubeId(v.link);
      const thumb = videoId
        ? `<img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt="${v.title}" loading="lazy"
             style="width:100%;height:100%;object-fit:contain;background:#000;" />`
        : `<div style="height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg-navy)"><span>▶ Video</span></div>`;
      return `
        <div class="card"><div class="card-inner">
          <div style="height:160px;overflow:hidden;border-radius:6px;margin-bottom:10px">
            ${thumb}
          </div>
          <div class="card-top">
            <h3 class="card-title">${v.title}</h3>
          </div>
          <a href="${v.link}" target="_blank" rel="noopener" class="header-pill" style="margin-top:10px;display:inline-block">Watch ↗</a>
        </div></div>`;
    }).join('');
  }

  function renderSection(sectionId, headerId, gridId, videos, label, channelUrl, channelLabel) {
    if (!videos || !videos.length) return;
    const section = document.getElementById(sectionId);
    const header  = document.getElementById(headerId);
    const grid    = document.getElementById(gridId);
    if (!section || !grid) return;

    if (header) {
      header.innerHTML = `
        <div class="hub-game-title">${label}</div>
        <a href="${channelUrl}" target="_blank" rel="noopener" class="hub-game-link">${channelLabel} ↗</a>`;
    }

    grid.innerHTML = renderVideoGrid(videos);
    section.style.display = 'block';
  }

  async function init() {
    const data = await fetch(CONTENT_JSON_PATH).then(r => r.json()).catch(() => ({}));

    if (data.featured && data.featured.length) {
      KythikCarousel.init({ mountId: CAROUSEL_MOUNT_ID, items: data.featured, autoRotateMs: 6000 });
    }

    renderSection(
      'ytOfficialSection', 'ytOfficialHeader', 'ytOfficialGrid',
      data.youtube_official,
      'From the Developer', OFFICIAL_CHANNEL, 'Official YouTube'
    );

    renderSection(
      'ytKythikSection', 'ytKythikHeader', 'ytKythikGrid',
      data.youtube_kythik,
      'Videos', KYTHIK_CHANNEL, 'My YouTube'
    );
  }

  init();
})();
