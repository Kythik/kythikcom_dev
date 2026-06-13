/* ═══════════════════════════════════════════
   app-hub.js — Root hub page logic
   Renders one carousel section per game using
   games.json (registry) + homepage-content.json
   (editable card content per game).
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
      const items = content[game.id] || [];
      const mountId = 'carousel-' + game.id;

      const statusBadge = game.status === 'upcoming'
        ? `<span class="hub-game-status hub-game-status--upcoming">Launching ${formatLaunch(game.launchDate)}</span>`
        : '';

      const section = document.createElement('section');
      section.className = 'hub-game-section';
      section.innerHTML = `
        <div class="hub-game-header">
          <div class="hub-game-title">
            <img src="${game.icon}" alt="" width="22" height="22" onerror="this.style.display='none'" />
            ${game.name}
            ${statusBadge}
          </div>
          ${game.status !== 'upcoming' ? `<a href="${game.path}" class="hub-game-link">View All</a>` : ''}
        </div>

        <div class="featured-section" id="${mountId}" style="display:none">
          <div class="featured-header">
            <div class="featured-label">Featured</div>
            <div class="featured-nav">
              <button class="featured-btn" onclick="KythikCarousel.nav('${mountId}', -1)" aria-label="Previous">‹</button>
              <span class="featured-counter" id="${mountId}Counter"></span>
              <button class="featured-btn" onclick="KythikCarousel.nav('${mountId}', 1)" aria-label="Next">›</button>
            </div>
          </div>
          <div class="featured-track" id="${mountId}Track"></div>
        </div>`;

      container.appendChild(section);

      if (items.length) {
        KythikCarousel.init({ mountId, items, autoRotateMs: 6000 });
      } else {
        document.getElementById(mountId).style.display = 'none';
      }
    });
  }

  function formatLaunch(iso) {
    if (!iso) return 'Soon';
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  }

  init();
})();
