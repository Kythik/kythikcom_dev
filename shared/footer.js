/* ═══════════════════════════════════════════
   footer.js — Shared site footer
   Injects the footer into any page with
   a <div id="site-footer"></div> placeholder.

   Single source of truth — update footer here,
   all pages reflect it.
   ═══════════════════════════════════════════ */

(function () {
  const mount = document.getElementById('site-footer');
  if (!mount) return;

  const year = new Date().getFullYear();

  mount.outerHTML = `
    <footer class="footer">
      <div class="footer-links">
        &copy; ${year} Kythik &nbsp;·&nbsp;
        <a href="/about/">About</a> &nbsp;·&nbsp;
        <a href="mailto:kythik@kythik.com">Contact</a> &nbsp;·&nbsp;
        <a href="https://discord.gg/qDRWUM83zY" target="_blank" rel="noopener">Discord</a> &nbsp;·&nbsp;
        <a href="https://twitch.tv/kythikx" target="_blank" rel="noopener">Twitch</a>
      </div>
    </footer>`;
})();
