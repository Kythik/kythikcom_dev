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
     { type:"youtube",  eyebrow, title, blurb, videoId, link }
     { type:"season",   eyebrow, title, blurb, seasonStartISO, nextSeasonISO, link }
     { type:"countdown",eyebrow, title, blurb, targetISO, link }
     { type:"strategy", ...same shape as existing feat-card strategy object }
   ═══════════════════════════════════════════ */

(function () {
  const instances = {};

  function fmtDuration(ms) {
    if (ms <= 0) return 'Live now';
    const days = Math.floor(ms / 86400000);
    const hrs  = Math.floor((ms % 86400000) / 3600000);
    if (days > 0) return `${days}d ${hrs}h`;
    const mins = Math.floor((ms % 3600000) / 60000);
    return `${hrs}h ${mins}m`;
  }

  function renderCardInner(item) {
    const eyebrow = item.eyebrow || '';
    const title   = item.title || '';
    const blurb   = item.blurb || '';

    let mediaHtml = '';
    let metaHtml  = '';

    switch (item.type) {
      case 'youtube': {
        const thumb = item.videoId
          ? `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`
          : null;
        mediaHtml = thumb
          ? `<img src="${thumb}" alt="${title}" loading="lazy" />`
          : `<div class="feat-screenshot-empty"><span>▶ Video</span></div>`;
        break;
      }
      case 'season': {
        const start = item.seasonStartISO ? new Date(item.seasonStartISO) : null;
        const now   = new Date();
        if (start) {
          const elapsed = fmtDuration(now - start).replace('Live now', '0h 0m');
          metaHtml = `<div class="feat-eyebrow" style="margin-top:8px">Season age: ${elapsed}</div>`;
        }
        mediaHtml = `<div class="feat-screenshot-empty"><span>⏳</span></div>`;
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

    return `
      <div class="feat-screenshot">
        ${mediaHtml}
        <div class="feat-screenshot-fade"></div>
      </div>
      <div class="feat-art-panel" style="background-image:url('/images/featured-panel.png')">
        <div class="feat-art-overlay"></div>
        <div class="feat-art-content">
          <div>
            <div class="feat-eyebrow">${eyebrow}</div>
            <h2 class="feat-title">${title}</h2>
            <p class="subtext" style="margin-top:6px">${blurb}</p>
            ${metaHtml}
            ${tagsRow}
          </div>
          <div class="feat-foot">
            <div></div>
            ${ctaLabel ? `<div class="feat-author-name">${ctaLabel} →</div>` : ''}
          </div>
        </div>
      </div>`;
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
        ${renderCardInner(item)}
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

  function init({ mountId, items, autoRotateMs = 6000 }) {
    const section = document.getElementById(mountId);
    if (!section) return;
    if (!items || !items.length) {
      section.style.display = 'none';
      return;
    }
    section.style.display = 'block';

    const inst = { mountId, items, index: 0, autoRotateMs, timer: null };
    instances[mountId] = inst;

    render(inst);
    startTimer(inst);
  }

  window.KythikCarousel = { init, nav };
})();
