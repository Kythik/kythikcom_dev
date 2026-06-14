/* ═══════════════════════════════════════════
   shared-carousel.js — Generic rotating card carousel
   Reuses .feat-card / .featured-* styles from styles.css.

   Usage:
     KythikCarousel.init({
       mountId: 'tliCarousel',     // container with featured-section structure
       items: [ ... ],             // array of card data objects (see types below)
       autoRotateMs: 6000,         // 0 to disable
     });

   Card item shape (by "type"):
     { type:"link",     eyebrow, title, blurb, link, linkLabel }
     { type:"youtube",  eyebrow, title, blurb, link }
     { type:"season",   eyebrow, title, blurb, seasonStartISO, seasonEndISO, nextSeasonISO, link }
     { type:"countdown",eyebrow, title, blurb, targetISO, link }
     { type:"strategy", ...same shape as existing feat-card strategy object }
   ═══════════════════════════════════════════ */

(function () {
  const instances = {};

  function parseYouTubeId(url) {
    if (!url) return null;
    try { return new URL(url).searchParams.get('v') || null; } catch(e) { return null; }
  }

  function fmtDuration(ms) {
    if (ms <= 0) return 'Live now';
    const days = Math.floor(ms / 86400000);
    const hrs  = Math.floor((ms % 86400000) / 3600000);
    if (days > 0) return `${days}d ${hrs}h`;
    const mins = Math.floor((ms % 3600000) / 60000);
    return `${hrs}h ${mins}m`;
  }

  function renderCardInner(item, fallbackImage) {
    const eyebrow = item.eyebrow || '';
    const title   = item.title || '';
    const blurb   = item.blurb || '';

    let mediaHtml = '';
    let metaHtml  = '';

    switch (item.type) {
      case 'youtube': {
        const videoId = parseYouTubeId(item.link);
        const thumb = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
        mediaHtml = thumb
          ? `<img src="${thumb}" alt="${title}" loading="lazy" />`
          : `<div class="feat-screenshot-empty"><span>▶ Video</span></div>`;
        break;
      }
      case 'season': {
        const now   = new Date();
        const start = item.seasonStartISO ? new Date(item.seasonStartISO) : null;
        const end   = item.seasonEndISO   ? new Date(item.seasonEndISO)   : null;
        const next  = item.nextSeasonISO  ? new Date(item.nextSeasonISO)  : null;

        let elapsedDays = 0, remainDays = 0, pct = 0;
        if (start && end) {
          const total   = end - start;
          const elapsed = Math.max(0, now - start);
          elapsedDays   = Math.floor(elapsed / 86400000);
          remainDays    = Math.max(0, Math.ceil((end - now) / 86400000));
          pct           = Math.min(100, Math.round((elapsed / total) * 100));
        } else if (start) {
          elapsedDays = Math.floor((now - start) / 86400000);
        }

        const nextLabel = next
          ? next.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : null;

        const progressBar = (start && end) ? `
          <div style="margin:12px 0 6px;font-size:11px;color:var(--text-muted);display:flex;justify-content:space-between;letter-spacing:.04em;">
            <span>${elapsedDays}d elapsed</span>
            <span>${remainDays}d remaining</span>
          </div>
          <div style="height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:var(--gold-primary);border-radius:2px;transition:width .4s;"></div>
          </div>` : `
          <div style="margin:12px 0 6px;font-size:11px;color:var(--text-muted);letter-spacing:.04em;">
            ${elapsedDays}d elapsed
          </div>`;

        const nextRow = nextLabel ? `
          <div style="margin-top:16px;font-size:11px;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase;">
            Next Season &middot; ${nextLabel}
          </div>` : '';

        metaHtml = `
          <div style="margin-top:14px;">
            ${progressBar}
            ${nextRow}
          </div>`;

        mediaHtml = '';
        break;
      }
      case 'countdown': {
        const target = item.targetISO ? new Date(item.targetISO) : null;
        if (target) {
          const remain = fmtDuration(target - new Date());
          metaHtml = `<div class="feat-eyebrow" style="margin-top:8px">Launches in: ${remain}</div>`;
        }
        mediaHtml = `<div class="feat-screenshot-empty"><span>🗺️</span></div>`;
        break;
      }
      case 'link':
      default: {
        mediaHtml = `<div class="feat-screenshot-empty"><span>${item.linkLabel || 'Open'}</span></div>`;
        break;
      }
    }

    const tagsRow = item.tags
      ? `<div class="feat-tags-row">${item.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>`
      : '';

    const ctaLabel = item.linkLabel || (item.link ? 'View' : '');

    // Left panel: all text content + any type-specific mediaHtml (progress bar, etc.)
    // Right panel: background image only (feat-art-panel), no text overlay
    const hasTextContent = eyebrow || title || blurb || metaHtml || tagsRow || ctaLabel;
    const leftPanel = hasTextContent ? `
      <div class="feat-art-content">
        <div>
          ${eyebrow ? `<div class="feat-eyebrow">${eyebrow}</div>` : ''}
          ${title   ? `<h2 class="feat-title">${title}</h2>` : ''}
          ${blurb   ? `<p class="subtext" style="margin-top:6px">${blurb}</p>` : ''}
          ${metaHtml}
          ${tagsRow}
        </div>
        <div class="feat-foot">
          <div></div>
          ${ctaLabel ? `<div class="feat-author-name">${ctaLabel} →</div>` : ''}
        </div>
      </div>` : mediaHtml;

    // Right panel image priority:
    // youtube with real thumbnail → thumbnail
    // item.image → per-card override
    // fallbackImage → per-game fallback
    // /images/featured-panel.png → last resort
    const hasRealThumb = item.type === 'youtube' && mediaHtml && mediaHtml.includes('<img');
    const rightBg = item.image || fallbackImage || null;
    const rightPanel = hasRealThumb
      ? `<div class="feat-screenshot" style="flex:1;">
           ${mediaHtml}
           <div class="feat-screenshot-fade"></div>
         </div>`
      : rightBg
        ? `<div class="feat-art-panel" style="flex:1;background-image:url('${rightBg}');background-size:cover;background-position:center;position:relative;">
             <div class="feat-art-overlay"></div>
           </div>`
        : `<div class="feat-art-panel" style="flex:1;background-image:url('/images/featured-panel.png');position:relative;">
             <div class="feat-art-overlay"></div>
           </div>`;

    return `${leftPanel}${rightPanel}`;
  }

  function render(inst) {
    const item = inst.items[inst.index];
    if (!item) return;

    const counter = document.getElementById(inst.mountId + 'Counter');
    if (counter) counter.textContent = (inst.index + 1) + ' / ' + inst.items.length;

    const track = document.getElementById(inst.mountId + 'Track');
    if (!track) return;

    const clickable = !!item.link;
    track.innerHTML = `
      <div class="feat-card" ${clickable ? `style="cursor:pointer"` : ''}>
        ${renderCardInner(item, inst.fallbackImage)}
      </div>`;

    if (clickable) {
      const card = track.querySelector('.feat-card');
      card.addEventListener('click', () => {
        if (item.link.startsWith('http')) {
          window.open(item.link, '_blank', 'noopener');
        } else {
          window.location.href = item.link;
        }
      });
    }
  }

  function nav(mountId, dir) {
    const inst = instances[mountId];
    if (!inst) return;
    inst.index = (inst.index + dir + inst.items.length) % inst.items.length;
    render(inst);
    resetTimer(inst);
  }

  function startTimer(inst) {
    clearInterval(inst.timer);
    if (inst.items.length < 2 || !inst.autoRotateMs) return;
    inst.timer = setInterval(() => {
      inst.index = (inst.index + 1) % inst.items.length;
      render(inst);
    }, inst.autoRotateMs);
  }

  function resetTimer(inst) {
    clearInterval(inst.timer);
    startTimer(inst);
  }

  function init({ mountId, items, autoRotateMs = 6000, fallbackImage = null }) {
    const section = document.getElementById(mountId);
    if (!section) return;
    if (!items || !items.length) {
      section.style.display = 'none';
      return;
    }
    section.style.display = 'block';

    const inst = { mountId, items, index: 0, autoRotateMs, fallbackImage, timer: null };
    instances[mountId] = inst;

    render(inst);
    startTimer(inst);
  }

  window.KythikCarousel = { init, nav };
})();
