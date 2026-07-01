/* ═══════════════════════════════════════════
   content.js — EverQuest Legends landing page
   Loads content.json and drives:
     · Featured carousel (via KythikCarousel)
     · Resources grid (#resourcesSection)
     · Official / developer YouTube grid (#ytOfficialSection)
     · Kythik YouTube grid (#ytKythikSection)
   ═══════════════════════════════════════════ */

(function () {

  /* ── Helpers ──────────────────────────────── */

  function parseYouTubeId(url) {
    if (!url) return null;

    try {
      const parsed = new URL(url);

      if (parsed.hostname.includes('youtu.be')) {
        return parsed.pathname.replace('/', '') || null;
      }

      return parsed.searchParams.get('v') || null;
    } catch {
      return null;
    }
  }

  /* ── YouTube card ─────────────────────────── */

  function buildVideoCard(v) {
    const videoId = parseYouTubeId(v.link);

    const thumb = videoId
      ? `<img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt="${v.title}" width="480" height="360" loading="lazy" style="width:100%;height:100%;object-fit:contain;background:var(--bg-navy);display:block" />`
      : `<div style="height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg-navy)"><span>▶ Video</span></div>`;

    return `
      <a href="${v.link}" target="_blank" rel="noopener" style="text-decoration:none;display:block">
        <div class="resource-card" style="cursor:pointer;overflow:hidden">
          <div style="height:200px;overflow:hidden;border-radius:var(--radius-lg) var(--radius-lg) 0 0;position:relative;background:var(--bg-navy)">
            ${thumb}
          </div>
          <div style="padding:12px 14px 14px">
            <div class="card-title" style="font-size:13px;margin:0">${v.title}</div>
          </div>
        </div>
      </a>`;
  }

  /* ── Section header ───────────────────────── */

  function buildSectionHeader(title, channelUrl, linkLabel) {
    return `
      <div class="hub-game-title">${title}</div>
      <a href="${channelUrl}" target="_blank" rel="noopener" class="hub-game-link">${linkLabel}</a>`;
  }

  /* ── Resource card ────────────────────────── */

  function buildResourceCard(r) {
    return `
      <a href="${r.link}" target="_blank" rel="noopener" style="text-decoration:none;display:block">
        <div class="resource-card">
          <div class="kicker" style="margin-bottom:6px">Resource</div>
          <div class="card-title">${r.title}</div>
          <p class="subtext" style="margin:6px 0 0;font-size:12px">${r.blurb || ''}</p>
        </div>
      </a>`;
  }

  /* ── Main ─────────────────────────────────── */

  async function init() {
    const data = await fetch('/everquest-legends/content.json')
      .then(r => r.json())
      .catch(() => ({}));

    // Hero subtitle — pulled from first featured entry eyebrow
    const featuredEntry = data.featured && data.featured[0];

    if (featuredEntry && featuredEntry.eyebrow) {
      const hero = document.getElementById('heroSeason');
      if (hero) hero.textContent = featuredEntry.eyebrow;
    }

    // Featured carousel
    if (data.featured && data.featured.length && window.KythikCarousel) {
      KythikCarousel.init({
        mountId: 'eqlCarousel',
        items: data.featured,
        autoRotateMs: 6000,
        fallbackImage: '/images/fallbacks/everquest-legends.png'
      });
    }

    // Resources grid
    if (data.resources && data.resources.length) {
      const section = document.getElementById('resourcesSection');
      const grid = document.getElementById('resourcesGrid');

      if (section && grid) {
        grid.innerHTML = data.resources.map(buildResourceCard).join('');
        section.style.display = 'block';
      }
    }

    // Official / developer YouTube videos
    if (data.officialYoutube && data.officialYoutube.length) {
      const section = document.getElementById('ytOfficialSection');
      const header = document.getElementById('ytOfficialHeader');
      const grid = document.getElementById('ytOfficialGrid');

      if (section && header && grid) {
        header.innerHTML = buildSectionHeader(
          'Developer Videos',
          'https://www.youtube.com/@EverQuestLegends',
          'Official YouTube →'
        );

        grid.innerHTML = data.officialYoutube.map(buildVideoCard).join('');
        section.style.display = 'block';
      }
    }

    // Kythik YouTube videos
    if (data.youtube && data.youtube.length) {
      const section = document.getElementById('ytKythikSection');
      const header = document.getElementById('ytKythikHeader');
      const grid = document.getElementById('ytKythikGrid');

      if (section && header && grid) {
        header.innerHTML = buildSectionHeader(
          'Latest from Kythik',
          'https://www.youtube.com/@kythikx',
          'More on YouTube →'
        );

        grid.innerHTML = data.youtube.map(buildVideoCard).join('');
        section.style.display = 'block';
      }
    }
  }

  init();

})();