'use strict';

let allStrategies  = [];
let activeFilter   = 'all';
let activeTag      = 'all';
let lightboxImages = [];
let lightboxIndex  = 0;

/* ══════════════════════════════════════════
   AIRTABLE
══════════════════════════════════════════ */
async function fetchStrategies() {
  try {
    const res  = await fetch('/api/airtable');
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    allStrategies = data.records || [];
    buildTagFilters();
    applyFilters();
    buildFeatured();
    injectItemListSchema(allStrategies);

    // Update last synced footer
    if (data.lastUpdated) {
      const el = document.getElementById('lastSynced');
      if (el) {
        const ago  = Math.round((Date.now() - new Date(data.lastUpdated)) / 60000);
        const text = ago < 2 ? 'just now' : ago < 60 ? `${ago}m ago` : `${Math.round(ago/60)}h ago`;
        el.textContent = `Strategies last synced from Discord ${text}`;
      }
    }
  } catch(err) {
    console.error('Fetch failed:', err);
    document.getElementById('stratGrid').innerHTML = `
      <div class="state-empty"><div class="state-empty__icon">⚠</div><p>Couldn't load strategies. Try refreshing.</p></div>`;
    document.getElementById('stratCount').textContent = '—';
  }
}

function buildTagFilters() {
  const tagSet = new Set();
  allStrategies.forEach(s => {
    if (s.Tags) s.Tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => tagSet.add(t));
  });
  const container = document.getElementById('tagFilters');
  if (!container || !tagSet.size) return;
  container.innerHTML = [...tagSet].map(tag =>
    `<button class="pill pill--tag" data-tag="${tag}">${tag}</button>`
  ).join('');
  container.querySelectorAll('.pill--tag').forEach(btn => {
    btn.addEventListener('click', function() {
      container.querySelectorAll('.pill--tag').forEach(b => b.classList.remove('active'));
      activeTag = activeTag === this.dataset.tag ? 'all' : this.dataset.tag;
      if (activeTag !== 'all') this.classList.add('active');
      applyFilters();
    });
  });
}

function renderStrategies(list) {
  const grid = document.getElementById('stratGrid');
  document.getElementById('stratCount').textContent = list.length + ' strateg' + (list.length === 1 ? 'y' : 'ies');

  if (!list.length) {
    grid.innerHTML = `<div class="state-empty"><div class="state-empty__icon">📜</div><p>No strategies yet — post one in Discord to get things started.</p></div>`;
    return;
  }

  grid.innerHTML = list.map(s => {
    const initial  = (s.Author || '?')[0].toUpperCase();
    const dateStr  = ( s.PostedAt || s.Created) ? new Date(s.PostedAt || s.Created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const zone     = s.Tags ? s.Tags.split(',')[0].trim() : (s.Channel || '');
    const eyebrow  = [zone, dateStr].filter(Boolean).join(' · ');
    const hasImg   = s.ImageURLs && s.ImageURLs.trim();
    const thumbSrc = hasImg ? s.ImageURLs.split(',')[0].trim() : getPlaceholder(s.id);
    const imgThumb = `<div class="card-thumb${hasImg ? '' : ' card-thumb--placeholder'}"><img src="${thumbSrc}" alt="Strategy screenshot" width="360" height="170" loading="lazy" onerror="this.src='${getPlaceholder(s.id)}';this.onerror=null;" /></div>`;

    return `<article class="card" data-id="${s.id}" onclick="openModal('${s.id}')">
      ${imgThumb}
      <div class="card-inner">
        <div class="card-top">
          ${zone ? `<span class="pill pill--tag">${zone}</span>` : '<span></span>'}
          ${dateStr ? `<span class="card-date">${dateStr}</span>` : ''}
        </div>
        <h2 class="card-title">${s.Title || 'Untitled'}</h2>
        <div class="card-pills">
          <div class="pill pill--author">${s.Author || 'Anonymous'}</div>
          ${s.CommentCount ? `<a class="pill pill--muted card-comments" href="${s.DiscordMessageURL}" target="_blank" rel="noopener" onclick="event.stopPropagation()">💬 ${s.CommentCount}</a>` : ''}
        </div>
      </div>
    </article>`;
  }).join('');
}

function applyFilters() {
  const query  = document.getElementById('searchInput').value.toLowerCase().trim();
  let filtered = allStrategies;
  if (activeFilter !== 'all') filtered = filtered.filter(s => s.Channel === activeFilter);
  if (activeTag !== 'all')    filtered = filtered.filter(s => s.Tags && s.Tags.split(',').map(t => t.trim()).includes(activeTag));
  if (query) filtered = filtered.filter(s => [s.Title, s.Body, s.Author, s.Channel, s.Tags].some(v => (v || '').toLowerCase().includes(query)));
  renderStrategies(filtered);
}

document.getElementById('searchInput').addEventListener('input', applyFilters);
document.querySelectorAll('.pill[data-filter]').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.pill[data-filter]').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    activeFilter = this.dataset.filter;
    applyFilters();
  });
});

/* ══════════════════════════════════════════
   VOTES
══════════════════════════════════════════ */
function getVotes(id) {
  try { return JSON.parse(localStorage.getItem('kh_votes') || '{}')[id] || { up: 0, down: 0, voted: null }; }
  catch { return { up: 0, down: 0, voted: null }; }
}

function saveVote(id, type) {
  try {
    const stored  = JSON.parse(localStorage.getItem('kh_votes') || '{}');
    const current = stored[id] || { up: 0, down: 0, voted: null };
    if (current.voted === type) { current[type] = Math.max(0, current[type] - 1); current.voted = null; }
    else { if (current.voted) current[current.voted] = Math.max(0, current[current.voted] - 1); current[type]++; current.voted = type; }
    stored[id] = current;
    localStorage.setItem('kh_votes', JSON.stringify(stored));
    return current;
  } catch { return { up: 0, down: 0, voted: null }; }
}

function voteHTML(id, inline) {
  const v = getVotes(id);
  return `<div class="${inline ? 'votes votes--inline' : 'votes'}" data-id="${id}">
    <button class="vote-btn vote-btn--up ${v.voted === 'up' ? 'active' : ''}" onclick="handleVote('${id}','up',event)" aria-label="Upvote">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l8 8H4z"/></svg>
      <span class="vote-count" data-type="up">${v.up}</span>
    </button>
    <button class="vote-btn vote-btn--down ${v.voted === 'down' ? 'active' : ''}" onclick="handleVote('${id}','down',event)" aria-label="Downvote">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20l-8-8h16z"/></svg>
      <span class="vote-count" data-type="down">${v.down}</span>
    </button>
  </div>`;
}

function handleVote(id, type, e) {
  e.stopPropagation();
  const v = saveVote(id, type);
  document.querySelectorAll('.votes[data-id="' + id + '"]').forEach(el => {
    el.querySelector('.vote-btn--up').className   = 'vote-btn vote-btn--up '   + (v.voted === 'up'   ? 'active' : '');
    el.querySelector('.vote-btn--down').className = 'vote-btn vote-btn--down ' + (v.voted === 'down' ? 'active' : '');
    el.querySelector('[data-type="up"]').textContent   = v.up;
    el.querySelector('[data-type="down"]').textContent = v.down;
  });
}

/* ══════════════════════════════════════════
   MODAL
══════════════════════════════════════════ */
function openModal(id) {
  const s = allStrategies.find(x => x.id === id);
  if (!s) return;
  const dateStr = ( s.PostedAt || s.Created) ? new Date(s.PostedAt || s.Created).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
  const tags    = s.Tags ? s.Tags.split(',').map(t => t.trim()).filter(Boolean).map(t => `<span class="tag">${t}</span>`).join('') : '';
  lightboxImages = s.ImageURLs ? s.ImageURLs.split(',').map(u => u.trim()).filter(Boolean) : [];
  const images   = lightboxImages.length
    ? `<div class="modal-images">${lightboxImages.map((u,i) => `<img src="${u}" alt="Strategy screenshot" width="400" height="150" onclick="openLightbox(${i})" loading="lazy" />`).join('')}</div>`
    : '';
  const discordBtn = s.DiscordMessageURL
    ? `<a class="modal-btn modal-btn--primary" href="${s.DiscordMessageURL}" target="_blank" rel="noopener">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.003.022.015.043.032.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
        View in Discord
       </a>` : '';

  const joinBtn = `<a class="modal-btn modal-btn--secondary" href="https://discord.gg/qDRWUM83zY" target="_blank" rel="noopener">
        Join Discord
       </a>`;

  document.getElementById('modalContent').innerHTML = `
    <button class="modal-close" onclick="closeModal()" aria-label="Close">✕</button>
    <div class="modal-head">
      <div class="modal-tags">${tags}</div>
      <span class="card-date">${dateStr}</span>
    </div>
    <h2 class="modal-title">${s.Title || 'Untitled'}</h2>
    <div class="modal-meta">
      <div class="author"><div class="avatar">${(s.Author||'?')[0].toUpperCase()}</div>${s.Author||'Anonymous'}</div>
      ${s.CommentCount ? `<a class="comment-count" href="${s.DiscordMessageURL}" target="_blank" rel="noopener">💬 ${s.CommentCount} comments</a>` : ''}
    </div>
    <div class="modal-body">${(s.Body||'').replace(/\n/g,'<br>')}</div>
    ${images}
    <div class="modal-foot">
      ${discordBtn}
      ${joinBtn}
    </div>`;

  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('modalOverlay').addEventListener('click', function(e) { if (e.target === this) closeModal(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape')     { closeModal(); closeLightbox(); }
  if (e.key === 'ArrowLeft')  lightboxNav(-1);
  if (e.key === 'ArrowRight') lightboxNav(1);
});

/* ══════════════════════════════════════════
   LIGHTBOX
══════════════════════════════════════════ */
function openLightbox(index) {
  lightboxIndex = index;
  updateLightbox();
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function updateLightbox() {
  document.getElementById('lightboxImg').src = lightboxImages[lightboxIndex];
  const c = document.getElementById('lightboxCounter');
  c.textContent = lightboxImages.length > 1 ? (lightboxIndex + 1) + ' / ' + lightboxImages.length : '';
  document.getElementById('lightboxPrev').style.display = lightboxImages.length > 1 ? 'flex' : 'none';
  document.getElementById('lightboxNext').style.display = lightboxImages.length > 1 ? 'flex' : 'none';
}

function lightboxNav(dir, e) {
  if (e) e.stopPropagation();
  lightboxIndex = (lightboxIndex + dir + lightboxImages.length) % lightboxImages.length;
  updateLightbox();
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  if (!document.getElementById('modalOverlay').classList.contains('open')) document.body.style.overflow = '';
}

/* ── TOAST ── */
function showToast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + (type || '');
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 4500);
}

/* ══════════════════════════════════════════
   FEATURED SECTION
══════════════════════════════════════════ */
let featuredList  = [];
let featuredIndex = 0;
let featuredTimer = null;

function buildFeatured() {
  // Manual featured first, then top voted auto-fill up to 5
  const manual  = allStrategies.filter(s => s.Featured);
  const voted   = allStrategies
    .filter(s => !s.Featured)
    .sort((a, b) => (getVotes(b.id).up - getVotes(b.id).down) - (getVotes(a.id).up - getVotes(a.id).down))
    .slice(0, Math.max(0, 5 - manual.length));

  featuredList = [...manual, ...voted].slice(0, 5);

  const section = document.getElementById('featuredSection');
  if (!featuredList.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';

  featuredIndex = 0;
  renderFeatured();
  startFeaturedTimer();
}

const PLACEHOLDERS = [
  '/images/placeholder-1.png',
  '/images/placeholder-2.png',
  '/images/placeholder-3.png',
  '/images/placeholder-4.png',
];

function getPlaceholder(id) {
  const idx = id ? id.charCodeAt(id.length - 1) % PLACEHOLDERS.length : 0;
  return PLACEHOLDERS[idx];
}

function renderFeatured() {
  const s = featuredList[featuredIndex];
  if (!s) return;

  const track   = document.getElementById('featuredTrack');
  const counter = document.getElementById('featCounter');
  counter.textContent = (featuredIndex + 1) + ' / ' + featuredList.length;

  const tags    = s.Tags ? s.Tags.split(',').map(t => t.trim()).filter(Boolean).map(t => `<span class="tag">${t}</span>`).join('') : '';
  const hasImg  = s.ImageURLs && s.ImageURLs.trim();
  const screenshot = hasImg ? s.ImageURLs.split(',')[0].trim() : null;
  const dateStr = (s.PostedAt || s.Created)
    ? new Date(s.PostedAt || s.Created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const zone = s.Tags ? s.Tags.split(',')[0].trim() : (s.Channel || '');

  track.innerHTML = `
    <div class="feat-card" onclick="openModal('${s.id}')">
      <div class="feat-screenshot">
        ${screenshot
          ? `<img src="${screenshot}" alt="Strategy screenshot" width="600" height="280" loading="lazy" onerror="this.src='${getPlaceholder(s.id)}';this.onerror=null;" />`
          : `<div class="feat-screenshot-empty"><span>No screenshot</span></div>`
        }
        <div class="feat-screenshot-fade"></div>
      </div>
      <div class="feat-art-panel" style="background-image:url('/images/featured-panel.png')">
        <div class="feat-art-overlay"></div>
        <div class="feat-art-content">
          <div>
            <div class="feat-eyebrow">${zone}${dateStr ? ' · ' + dateStr : ''}</div>
            <h2 class="feat-title">${s.Title || 'Untitled'}</h2>
            <div class="feat-tags-row">${tags}</div>
          </div>
          <div class="feat-foot">
            <div class="author">
              <div class="avatar">${(s.Author || '?')[0].toUpperCase()}</div>
              <div>
                <div class="feat-author-name">${s.Author || 'Anonymous'}</div>
                ${s.CommentCount ? `<div class="feat-author-meta">💬 ${s.CommentCount} comments</div>` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function featNav(dir) {
  featuredIndex = (featuredIndex + dir + featuredList.length) % featuredList.length;
  renderFeatured();
  resetFeaturedTimer();
}

function startFeaturedTimer() {
  clearInterval(featuredTimer);
  if (featuredList.length < 2) return;
  featuredTimer = setInterval(() => {
    featuredIndex = (featuredIndex + 1) % featuredList.length;
    renderFeatured();
  }, 6000);
}

function resetFeaturedTimer() {
  clearInterval(featuredTimer);
  startFeaturedTimer();
}

/* ── ITEMLIST SCHEMA ────────────────────── */
function injectItemListSchema(strategies) {
  if (!strategies || !strategies.length) return;
  const items = strategies.slice(0, 50).map((s, i) => ({
    '@type':    'ListItem',
    'position': i + 1,
    'name':     s.Title || 'Untitled',
    'url':      s.DiscordMessageURL || 'https://www.kythik.com/torchlight/strats/strats.html',
  }));
  const schema = {
    '@context':       'https://schema.org',
    '@type':          'ItemList',
    'name':           'Torchlight Infinite Farm Strategies',
    'description':    'Community-sourced farm strategies for Torchlight Infinite, synced from the Kythik Discord.',
    'numberOfItems':  strategies.length,
    'itemListElement': items,
  };
  const el = document.createElement('script');
  el.type        = 'application/ld+json';
  el.textContent = JSON.stringify(schema);
  document.head.appendChild(el);
}

/* ── INIT ── */
fetchStrategies();
