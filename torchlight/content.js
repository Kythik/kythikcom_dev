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

  function buildSeasonMeta(item) {
    const now   = new Date();
    const start = item.seasonStartISO ? new Date(item.seasonStartISO) : null;
    const end   = item.seasonEndISO   ? new Date(item.seasonEndISO)   : null;
    const next  = item.nextSeasonISO  ? new Date(item.nextSeasonISO)  : null;

    let html = '';

    if (start && end) {
      const total         = end - start;
      const elapsed       = Math.max(0, now - start);
      const pct           = Math.min(100, Math.round((elapsed / total) * 100));
      const elapsedDays   = Math.floor(elapsed / 86400000);
      const remainingDays = Math.max(0, Math.ceil((end - now) / 86400000));

      html += `
        <div style="margin-top:12px">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:5px">
            <span>${elapsedDays}d elapsed</span>
            <span>${remainingDays}d remaining</span>
          </div>
          <div style="height:6px;border-radius:4px;background:rgba(255,255,255,0.08);overflow:hidden">
            <div style="height:100%;width:${pct}%;background:var(--gold-primary);border-radius:4px"></div>
          </div>
        </div>`;
    }

    if (next) {
      const label = next.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      html += `
        <div style="margin-top:10px;font-size:11px;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase">
          Next Season · <span style="color:var(--gold-primary)">${label}</span>
        </div>`;
    }

    return html;
  }

  /* ── YouTube card HTML ────────────────────── */

  function buildVideoCard(v) {
    const videoId = parseYouTubeId(v.link);
    const thumb = videoId
      ? `<img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt="${v.title}" loading="lazy" style="width:100%;height:100%;object-fit:cover;object-position:center top" />`
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

    // Featured carousel
    if (data.featured && data.featured.length) {
      const items = processFeatured(data.featured);
      KythikCarousel.init({ mountId: 'tliCarousel', items, autoRotateMs: 6000 });
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
