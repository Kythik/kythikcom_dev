/* ═══════════════════════════════════════════
   app-hub.js — Root hub page logic
   Renders one carousel per live game using
   games.json (registry) + homepage-content.json
   (editable card content per game).
   No game titles on the page — game name appears
   only inside the carousel label bar.
   ═══════════════════════════════════════════ */

(function () {
  async function init() {
    const [gamesRes, contentRes] = await Promise.all([
      fetch('/games.json').then(r => r.json()).catch(() => ({ games: [] })),
      fetch('/homepage-content.json').then(r => r.json()).catch(() => ({})),
    ]);

    const games = gamesRes.games || [];
    const content = contentRes || {};
    const container = document.getElementById('gameSections');
    if (!container) return;

    games.forEach(game => {
      if (game.status === 'upcoming') return;

      const items = (content[game.id] || []).map(item => ({ ...item, _gameName: game.name }));
      if (!items.length) return;

      const mountId = 'carousel-' + game.id;

      const section = document.createElement('section');
      section.className = 'hub-game-section';
      section.innerHTML = `
        <div class="featured-section" id="${mountId}" style="display:none">
          <div class="featured-header">
            <a href="${game.path}" class="featured-label" style="text-decoration:none;">${game.name} ↗</a>
            <div class="featured-nav">
              <button class="featured-btn" onclick="KythikCarousel.nav('${mountId}', -1)" aria-label="Previous">‹</button>
              <span class="featured-counter" id="${mountId}Counter"></span>
              <button class="featured-btn" onclick="KythikCarousel.nav('${mountId}', 1)" aria-label="Next">›</button>
            </div>
          </div>
          <div class="featured-track" id="${mountId}Track"></div>
        </div>`;

      container.appendChild(section);
      KythikCarousel.init({ mountId, items, autoRotateMs: 6000, fallbackImage: game.fallbackImage || null });
    });
  }

  init();
})();
