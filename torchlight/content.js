/* ═══════════════════════════════════════════
   content.js — Torchlight landing page
   Loads content.json: drives the featured
   carousel and the YouTube video grid.
   ═══════════════════════════════════════════ */

(function () {
  async function init() {
    const data = await fetch('/torchlight/content.json').then(r => r.json()).catch(() => ({}));

    if (data.featured && data.featured.length) {
      KythikCarousel.init({ mountId: 'tliCarousel', items: data.featured, autoRotateMs: 6000 });
    }

    if (data.youtube && data.youtube.length) {
      const section = document.getElementById('ytSection');
      const grid = document.getElementById('ytGrid');
      grid.innerHTML = data.youtube.map(v => `
        <div class="card"><div class="card-inner">
          <div class="card-thumb" style="height:160px">
            ${v.videoId
              ? `<img src="https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg" alt="${v.title}" loading="lazy" />`
              : `<div class="feat-screenshot-empty" style="height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg-navy)"><span>▶ Video</span></div>`
            }
          </div>
          <div class="card-top" style="margin-top:10px">
            <h3 class="card-title">${v.title}</h3>
          </div>
          <a href="${v.link}" target="_blank" rel="noopener" class="header-pill" style="margin-top:10px;display:inline-block">Watch</a>
        </div></div>`).join('');
      section.style.display = 'block';
    }
  }

  init();
})();
