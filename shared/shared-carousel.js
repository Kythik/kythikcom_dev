/* ═══════════════════════════════════════════
   shared-carousel.js — Generic rotating card carousel
   Reuses .feat-card / .featured-* styles from styles.css.

   Structure: LEFT = text content, RIGHT = background image

   Usage:
     KythikCarousel.init({
       mountId: 'tliCarousel',
       items: [ ... ],
       autoRotateMs: 6000,
       fallbackImage: '/images/fallbacks/torchlight.png',
     });

   Card item shape (by "type"):
     { type:"link",      eyebrow, title, blurb, link, linkLabel, image }
     { type:"youtube",   eyebrow, title, blurb, link, image }
     { type:"season",    eyebrow, title, blurb, seasonStartISO, seasonEndISO, nextSeasonISO, link }
     { type:"countdown", eyebrow, title, blurb, targetISO, link }
   ═══════════════════════════════════════════ */

(function () {
  const instances = {};

  function parseYouTubeId(url) {
    if (!url) return null;
    try { return new URL(url).searchParams.get('v') || null; } catch(e) { return null; }
  }

  function fmtDuration(ms) {
    if (ms <= 0) return '0d';
    const days = Math.floor(ms / 86400000);
    const hrs  = Math.floor((ms % 86400000) / 3600000);
    if (days > 0) return `${days}d ${hrs}h`;
    const mins = Math.floor((ms % 3600000) / 60000);
    return `${hrs}h ${mins}m`;
  }

  function renderCard(item, fallbackImage) {
    const eyebrow  = item.eyebrow  || '';
    const title    = item.title    || '';
    const blurb    = item.blurb    || '';
    const ctaLabel = item.linkLabel || (item.link ? 'View' : '');

    // ── Extra content per type ──
    let extra = '';
    if (item.type === 'season') {
      const now   = new Date();
      const start = item.seasonStartISO ? new Date(item.seasonStartISO) : null;
      const end   = item.seasonEndISO   ? new Date(item.seasonEndISO)   : null;
      const next  = item.nextSeasonISO  ? new Date(item.nextSeasonISO)  : null;

      if (start && end) {
        const total      = end - start;
        const elapsed    = Math.max(0, now - start);
        const elapsedD   = Math.floor(elapsed / 86400000);
        const remainD    = Math.max(0, Math.ceil((end - now) / 86400000));
        const pct        = Math.min(100, Math.round((elapsed / total) * 100));
        extra += `
          <div style="margin-top:14px">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:6px;">
              <span>${elapsedD}d elapsed</span><span>${remainD}d remaining</span>
            </div>
            <div style="height:4px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:var(--gold-primary);border-radius:2px;"></div>
            </div>
          </div>`;
      } else if (start) {
        extra += `<div style="margin-top:10px;font-size:11px;color:var(--text-muted);">${fmtDuration(now - start)} elapsed</div>`;
      }
      if (next) {
        const dateStr = next.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        extra += `<div style="margin-top:12px;font-size:10px;color:var(--text-faint);letter-spacing:.08em;text-transform:uppercase;">Next Season · ${dateStr}</div>`;
      }
    }

    if (item.type === 'countdown') {
      const target = item.targetISO ? new Date(item.targetISO) : null;
      if (target) {
        extra += `<div style="margin-top:10px;font-size:11px;color:var(--text-muted);">Launches in: ${fmtDuration(target - new Date())}</div>`;
      }
    }

    // ── Right panel image ──
    const videoId = item.type === 'youtube' ? parseYouTubeId(item.link) : null;
    const rightBg = videoId
      ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      : (item.image || fallbackImage || null);

    const rightStyle = rightBg
      ? `background-image:url('${rightBg}');background-size:cover;background-position:center;`
      : '';

    return `
      <div class="feat-art-content">
        <div>
          ${eyebrow ? `<div class="feat-eyebrow">${eyebrow}</div>` : ''}
          ${title   ? `<h2 class="feat-title">${title}</h2>` : ''}
          ${blurb   ? `<p class="subtext" style="margin-top:6px">${blurb}</p>` : ''}
          ${extra}
        </div>
        <div class="feat-foot">
          <div></div>
          ${ctaLabel ? `<div class="feat-author-name">${ctaLabel} →</div>` : ''}
        </div>
      </div>
      <div class="feat-art-panel" style="${rightStyle}">
        <div class="feat-art-overlay"></div>
        <div style="position:absolute;inset:0;background:linear-gradient(to right, rgba(4,8,15,.95) 0%, rgba(4,8,15,.4) 30%, transparent 60%);z-index:2;pointer-events:none;"></div>
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
    const card = document.createElement('div');
    card.className = 'feat-card';
    card.innerHTML = renderCard(item, inst.fallbackImage);

    if (clickable) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        if (item.link.startsWith('http')) {
          window.open(item.link, '_blank', 'noopener');
        } else {
          window.location.href = item.link;
        }
      });
    }

    track.innerHTML = '';
    track.appendChild(card);
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
