/* ═══════════════════════════════════════════
   header.js — Shared multi-game site header
   Injects the sticky header into any page with
   a <div id="site-header"></div> placeholder.

   Set the active game via:
     <div id="site-header" data-active-game="torchlight"></div>
   Omit or set "none" for the homepage default state.

   Mobile (≤700px) collapses to:
     [brand] ........ [hamburger]
   Tapping hamburger opens a slide-down menu with
   game links + subpages + Twitch/Discord.

   Relies on shared styles.css + header-additions.css
   already loaded, and fetches /games.json.
   ═══════════════════════════════════════════ */

(function () {
  const BRAND_HTML = `
    <a href="/" class="brand-link" aria-label="Kythik home" style="display:flex;align-items:center;gap:0;">
      <img src="/images/favicon/android-chrome-192x192.png" alt="K" class="brand-icon-k" />
      <span class="header-name header-name--no-k">ythik</span>
    </a>
    <div class="live-badge" id="headerLive" style="display:none">
      <div class="live-dot"></div>
      <span>Live</span>
    </div>`;

  const TWITCH_DISCORD_HTML = `
    <a href="/about/" class="header-pill header-pill--about" aria-label="About Kythik">About</a>
    <a href="https://twitch.tv/kythikx" target="_blank" rel="noopener" class="icon-btn icon-btn--twitch" aria-label="Twitch" title="Twitch">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
    </a>
    <a href="https://discord.gg/qDRWUM83zY" target="_blank" rel="noopener" class="icon-btn icon-btn--discord" aria-label="Discord" title="Discord">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.003.022.015.043.032.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
    </a>`;

  const HAMBURGER_HTML = `
    <button class="header-hamburger" id="headerHamburger" aria-label="Open menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>`;

  function gameHref(game) {
    if (game.status === 'upcoming') {
      return `/coming-soon.html?game=${encodeURIComponent(game.id)}`;
    }
    return game.path;
  }

  function renderDefaultCenter(games) {
    return games.map(g => `
      <a href="${gameHref(g)}" class="header-game-icon-default" data-game="${g.id}" aria-label="${g.name}" title="${g.name}">
        <img src="${g.icon}" alt="${g.name}" style="${g.iconScale && g.iconScale !== 1.0 ? 'transform:scale(' + g.iconScale + ');' : ''}" onerror="this.style.display='none'" />
      </a>`).join('');
  }

  function renderActiveCenter(games, activeId) {
    const active = games.find(g => g.id === activeId);

    let activeHtml = '';
    if (active) {
      const subpages = (active.subpages || []).map(sp => `
        <a href="${sp.path}" class="header-pill">${sp.label}</a>`).join('');

      activeHtml = `
        <div class="header-active-game">
          <a href="${gameHref(active)}" class="header-game-icon-default header-game-icon-default--active" data-game="${active.id}" aria-label="${active.name}" title="${active.name}">
            <img src="${active.icon}" alt="${active.name}" style="${active.iconScale && active.iconScale !== 1.0 ? 'transform:scale(' + active.iconScale + ');' : ''}" onerror="this.style.display='none'" />
          </a>
          ${subpages}
        </div>`;
    }

    return activeHtml;
  }

  function renderCollapsedIcons(games, activeId) {
    const others = games.filter(g => g.id !== activeId);
    if (!others.length) return '';

    return `<div class="header-collapsed-row">${others.map(g => `
      <a href="${gameHref(g)}" class="header-game-icon-default header-game-icon-default--collapsed" data-game="${g.id}" aria-label="${g.name}" title="${g.name}">
        <img src="${g.icon}" alt="${g.name}" style="${g.iconScale && g.iconScale !== 1.0 ? 'transform:scale(' + g.iconScale + ');' : ''}" onerror="this.style.display='none'" />
      </a>`).join('')}</div>`;
  }

  function renderMobileMenu(games, activeId) {
    // Build flat list — each game shows inline with its subpages directly underneath if it's the current page
    const items = games.map(g => {
      const isCurrent = g.id === activeId;
      const isUpcoming = g.status === 'upcoming';

      // Game row
      const gameRow = `
        <a href="${gameHref(g)}" class="mobile-menu__game ${isCurrent ? 'is-current' : ''} ${isUpcoming ? 'is-upcoming' : ''}">
          <img src="${g.icon}" alt="" class="mobile-menu__game-icon" style="${g.iconScale && g.iconScale !== 1.0 ? 'transform:scale(' + g.iconScale + ');' : ''}" onerror="this.style.display='none'" />
          <span class="mobile-menu__game-name">${g.name}</span>
          ${isCurrent ? '<span class="mobile-menu__tag mobile-menu__tag--current">current</span>' : ''}
          ${isUpcoming ? '<span class="mobile-menu__tag mobile-menu__tag--soon">soon</span>' : ''}
        </a>`;

      // Subpages — only shown for the current game
      let subRows = '';
      if (isCurrent && g.subpages && g.subpages.length) {
        subRows = g.subpages.map(sp => `
          <a href="${sp.path}" class="mobile-menu__sublink">→ ${sp.label}</a>`).join('');
      }

      return gameRow + subRows;
    }).join('');

    return `
      <div class="mobile-menu" id="mobileMenu" aria-hidden="true">
        <a href="/" class="mobile-menu__game ${activeId === 'none' ? 'is-current' : ''}">
          <span class="mobile-menu__home-icon">⌂</span>
          <span class="mobile-menu__game-name">Home</span>
          ${activeId === 'none' ? '<span class="mobile-menu__tag mobile-menu__tag--current">current</span>' : ''}
        </a>
        ${items}
        <a href="/about/" class="mobile-menu__game">
          <span class="mobile-menu__home-icon">i</span>
          <span class="mobile-menu__game-name">About</span>
        </a>
        <div class="mobile-menu__social-row">
          <a href="https://twitch.tv/kythikx" target="_blank" rel="noopener" class="mobile-menu__social mobile-menu__social--twitch">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
            <span>Twitch</span>
          </a>
          <a href="https://discord.gg/qDRWUM83zY" target="_blank" rel="noopener" class="mobile-menu__social mobile-menu__social--discord">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.003.022.015.043.032.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
            <span>Discord</span>
          </a>
        </div>
      </div>`;
  }

  function buildHeader(games, activeId) {
    const isActiveState = activeId && activeId !== 'none';
    const centerHtml = isActiveState
      ? renderActiveCenter(games, activeId)
      : renderDefaultCenter(games);
    const collapsedIconsHtml = isActiveState
      ? renderCollapsedIcons(games, activeId)
      : '';

    return `
    <header class="site-header">
      <div class="header-inner">
        <div class="header-left">
          ${BRAND_HTML}
        </div>
        <nav class="header-center">
          ${centerHtml}
        </nav>
        <nav class="header-right">
          ${collapsedIconsHtml}
          ${TWITCH_DISCORD_HTML}
        </nav>
        ${HAMBURGER_HTML}
      </div>
      ${renderMobileMenu(games, activeId)}
    </header>`;
  }

  function attachHamburger() {
    const btn  = document.getElementById('headerHamburger');
    const menu = document.getElementById('mobileMenu');
    if (!btn || !menu) return;

    btn.addEventListener('click', () => {
      const isOpen = btn.classList.toggle('is-open');
      menu.classList.toggle('is-open', isOpen);
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      menu.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close menu when a link is tapped (in-page navigation)
    menu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        btn.classList.remove('is-open');
        menu.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        menu.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
      });
    });
  }

  const mount = document.getElementById('site-header');
  if (!mount) return;

  const activeGame = mount.getAttribute('data-active-game') || 'none';

  fetch('/games.json')
    .then(r => r.json())
    .then(data => {
      const games = data.games || [];
      mount.outerHTML = buildHeader(games, activeGame);
      attachHamburger();
    })
    .catch(() => {
      mount.outerHTML = `
      <header class="site-header">
        <div class="header-inner">
          <div class="header-left">${BRAND_HTML}</div>
          <nav class="header-center"></nav>
          <nav class="header-right">${TWITCH_DISCORD_HTML}</nav>
        </div>
      </header>`;
    });

  window.kythikUpdateLiveBadge = function (isLive) {
    const hl = document.getElementById('headerLive');
    if (!hl) return;
    hl.style.display = isLive ? 'flex' : 'none';
  };

  if (!window.kythikSkipDefaultLiveCheck) {
    fetch('/api/twitch')
      .then(r => r.json())
      .then(data => window.kythikUpdateLiveBadge(!!data.isLive))
      .catch(() => {});
  }
})();
