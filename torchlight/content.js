/* ═══════════════════════════════════════════
   content.js — Torchlight landing page
   Loads content.json: drives the featured
   carousel and the YouTube video grid.
   Parses videoId from the YouTube link URL.
   ═══════════════════════════════════════════ */

(function () {
  function parseYouTubeId(url) {
    if (!url) return null;
    try {
      const u = new URL(url);
      return u.searchParams.get('v') || null;
    } catch {
      return null;
    }
  }

  async function init() {
    const data = await fetch('/torchlight/content.json').then(r => r.json()).catch(() => ({}));

    if (data.featured && data.featured.length) {
      KythikCarousel.init({ mountId: 'tliCarousel', items: data.featured, autoRotateMs: 6000 });
    }

    if (data.youtube && data.youtube.length) {
      const section = document.getElementById('ytSection');
      const grid = document.getElementById('ytGrid');
      grid.innerHTML = data.youtube.map(v => {
        const videoId = parseYouTubeId(v.link);
        const thumb = videoId
          ? `<img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt="${v.title}" loading="lazy" style="width:100%;height:100%;object-fit:cover" />`
          : `<div style="height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg-navy)"><span>▶ Video</span></div>`;
        return `
          <div class="card"><div class="card-inner">
            <div class="card-thumb" style="height:160px;overflow:hidden;border-radius:6px;margin-bottom:10px">
              ${thumb}
            </div>
            <div class="card-top">
              <h3 class="card-title">${v.title}</h3>
            </div>
            <a href="${v.link}" target="_blank" rel="noopener" class="header-pill" style="margin-top:10px;display:inline-block">Watch</a>
          </div></div>`;
      }).join('');
      section.style.display = 'block';
    }
  }

  init();
})();
