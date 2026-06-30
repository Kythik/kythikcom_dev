/* ═══════════════════════════════════════════
   content.js — EverQuest Legends landing page
   Loads content.json and drives:
     · Featured carousel (via KythikCarousel)
     · Start Here grid (#quickPathsGrid)
     · Legend Archive grid (#archiveGrid)
     · Resources grid (#resourcesGrid)
     · Optional videos grid (#videosGrid)
   ═══════════════════════════════════════════ */

(function () {

  /* ── Helpers ──────────────────────────────── */

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function parseYouTubeId(url) {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('youtu.be')) return parsed.pathname.replace('/', '') || null;
      return parsed.searchParams.get('v') || null;
    } catch {
      return null;
    }
  }

  function safeLink(link) {
    return link && link !== '#' ? link : '#';
  }

  function linkAttrs(link) {
    if (!link || link === '#' || link.startsWith('#')) return '';
    return ' target="_blank" rel="noopener"';
  }

  /* ── Cards ────────────────────────────────── */

  function buildResourceCard(item, fallbackKicker) {
    return `
      <a href="${safeLink(item.link)}"${linkAttrs(item.link)} style="text-decoration:none;display:block">
        <div class="resource-card">
          <div class="resource-card__kicker">${escapeHtml(item.kicker || fallbackKicker || 'Resource')}</div>
          <div class="resource-card__title">${escapeHtml(item.title)}</div>
          <p class="resource-card__body">${escapeHtml(item.blurb)}</p>
          <div class="resource-card__foot">
            <span>${escapeHtml(item.linkLabel || 'Open')}</span>
            <span aria-hidden="true">→</span>
          </div>
        </div>
      </a>`;
  }

  function buildArchiveCard(item) {
    return `
      <a href="${safeLink(item.link)}"${linkAttrs(item.link)} style="text-decoration:none;display:block">
        <div class="resource-card">
          <div class="resource-card__kicker">${escapeHtml(item.kicker || 'Archive')}</div>
          <div class="resource-card__title">${escapeHtml(item.title)}</div>
          <p class="resource-card__body">${escapeHtml(item.blurb)}</p>
          <div style="display:flex;flex-wrap:wrap;gap:6px;padding-top:10px">
            <span class="tag-stat">${escapeHtml(item.status || 'Draft')}</span>
            <span class="tag-stat tag-stat--blue">${escapeHtml(item.tag || 'Story')}</span>
          </div>
        </div>
      </a>`;
  }

  function buildVideoCard(video) {
    const videoId = parseYouTubeId(video.link);
    const thumb = videoId
      ? `<img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt="${escapeHtml(video.title)}" loading="lazy" style="width:100%;height:100%;object-fit:contain;background:var(--bg-navy);display:block" />`
      : `<div style="height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg-navy);color:var(--text-faint)">▶ Video</div>`;

    return `
      <a href="${safeLink(video.link)}"${linkAttrs(video.link)} style="text-decoration:none;display:block">
        <div class="resource-card" style="cursor:pointer;overflow:hidden">
          <div style="height:200px;overflow:hidden;border-radius:var(--radius-lg) var(--radius-lg) 0 0;position:relative;background:var(--bg-navy)">
            ${thumb}
          </div>
          <div style="padding:12px 14px 14px">
            <div class="resource-card__kicker">Video</div>
            <div class="card-title" style="font-size:13px;margin:6px 0 0">${escapeHtml(video.title)}</div>
          </div>
        </div>
      </a>`;
  }

  /* ── Main ─────────────────────────────────── */

  async function init() {
    const data = await fetch('/everquest-legends/content.json').then(r => r.json()).catch(() => ({}));

    if (data.featured && data.featured.length && window.KythikCarousel) {
      KythikCarousel.init({
        mountId: 'eqlCarousel',
        items: data.featured,
        autoRotateMs: 7000,
        fallbackImage: '/images/fallbacks/eql.png'
      });
    }

    const quickPathsGrid = document.getElementById('quickPathsGrid');
    if (quickPathsGrid && data.quickPaths && data.quickPaths.length) {
      quickPathsGrid.innerHTML = data.quickPaths.map(item => buildResourceCard(item, 'Start Here')).join('');
    }

    const archiveGrid = document.getElementById('archiveGrid');
    if (archiveGrid && data.archive && data.archive.length) {
      archiveGrid.innerHTML = data.archive.map(buildArchiveCard).join('');
    }

    if (data.resources && data.resources.length) {
      const section = document.getElementById('resourcesSection');
      const grid = document.getElementById('resourcesGrid');
      if (section && grid) {
        grid.innerHTML = data.resources.map(item => buildResourceCard(item, 'Resource')).join('');
        section.style.display = 'block';
      }
    }

    if (data.videos && data.videos.length) {
      const section = document.getElementById('videosSection');
      const grid = document.getElementById('videosGrid');
      if (section && grid) {
        grid.innerHTML = data.videos.map(buildVideoCard).join('');
        section.style.display = 'block';
      }
    }
  }

  init();

})();