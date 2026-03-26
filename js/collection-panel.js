(() => {
  const CONSOLE_ORDER = [
    'Nintendo Entertainment System', 'Super Nintendo', 'PlayStation', 'Sega Genesis',
    'Nintendo 64', 'Game Boy', 'Game Boy Advance', 'Sega Saturn', 'Dreamcast',
    'Neo Geo', 'TurboGrafx-16', 'Nintendo DS', 'Sega Master System', 'Game Gear',
    'Atari Lynx', 'WonderSwan'
  ];

  const SHORT = {
    'Nintendo Entertainment System': 'NES',
    'Super Nintendo': 'SNES',
    'PlayStation': 'PS1',
    'Game Boy': 'GB',
    'Sega Genesis': 'GEN',
    'Nintendo 64': 'N64',
    'Game Boy Advance': 'GBA',
    'Sega Saturn': 'SAT',
    'Dreamcast': 'DC',
    'Neo Geo': 'NEO',
    'TurboGrafx-16': 'TG-16',
    'Nintendo DS': 'NDS',
    'Sega Master System': 'SMS',
    'Game Gear': 'GG',
    'Atari Lynx': 'LYNX',
    'WonderSwan': 'WS'
  };

  function refreshStats() {
    if (typeof RETRODEX_COLLECTION === 'undefined') return;
    RETRODEX_COLLECTION.syncCatalog(window.CATALOG_DATA, window.PRICES_DATA);
    const summary = RETRODEX_COLLECTION.getSummary(CONSOLE_ORDER, SHORT);
    const countEl = document.getElementById('coll-count');
    const valueEl = document.getElementById('coll-value');
    const grid = document.getElementById('coll-consoles');

    if (countEl) countEl.textContent = String(summary.count);
    if (valueEl) valueEl.textContent = 'Valeur loose : $' + summary.totalLooseValue.toLocaleString();
    if (!grid) return;

    grid.innerHTML = summary.consoles.map((row) => (
      '<div class="coll-console-row">' +
        '<div class="coll-console-name">' + row.label + '</div>' +
        '<div class="coll-bar-wrap">' +
          '<div class="coll-bar"><div class="coll-bar-fill' + (row.complete ? ' full' : '') + '" style="width:' + row.percent + '%"></div></div>' +
          '<div class="coll-frac">' + row.ownedCount + '/' + row.total + '</div>' +
        '</div>' +
      '</div>'
    )).join('');
  }

  function syncButton(button, gameId) {
    if (!button || !gameId || typeof RETRODEX_COLLECTION === 'undefined') return;
    const owned = RETRODEX_COLLECTION.isOwned(gameId);
    button.className = 'coll-btn' + (owned ? ' owned' : '');
    button.title = owned ? 'Retirer de la collection' : 'Ajouter à ma collection';
    button.textContent = owned ? '✓' : '+';
  }

  function injectButton() {
    if (typeof RETRODEX_COLLECTION === 'undefined') return;
    const gameId = window._rdxCurrentId;
    const bot = document.getElementById('rdx-bot');
    if (!gameId || !bot) return;

    const existing = bot.querySelector('.coll-btn');
    if (existing && existing.getAttribute('data-game-id') === gameId) {
      syncButton(existing, gameId);
      return;
    }
    if (existing) existing.remove();

    const button = document.createElement('button');
    button.setAttribute('data-game-id', gameId);
    syncButton(button, gameId);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      RETRODEX_COLLECTION.toggleOwned(gameId);
      syncButton(button, gameId);
      refreshStats();
    });
    bot.appendChild(button);
  }

  function bindToggle() {
    const button = document.getElementById('coll-toggle-btn');
    const body = document.getElementById('coll-body');
    const chevron = document.getElementById('coll-chevron');
    const exportButton = document.getElementById('coll-export-btn');
    if (!button || !body) return;

    if (exportButton) {
      exportButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof RETRODEX_COLLECTION !== 'undefined') RETRODEX_COLLECTION.downloadCsv();
      });
    }

    button.addEventListener('click', () => {
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      if (chevron) chevron.classList.toggle('open', !open);
      if (!open) refreshStats();
    });
  }

  function observeBottomScreen() {
    const bot = document.getElementById('rdx-bot');
    if (!bot) return;
    new MutationObserver(() => {
      window.setTimeout(injectButton, 10);
    }).observe(bot, { childList: true });
    window.setTimeout(injectButton, 30);
  }

  function bindGlobalHooks() {
    window.exportCollection = () => {
      if (typeof RETRODEX_COLLECTION === 'undefined') return false;
      return RETRODEX_COLLECTION.downloadCsv();
    };

    window.addEventListener('retrodex:collection-changed', () => {
      refreshStats();
      const button = document.querySelector('#rdx-bot .coll-btn');
      if (button && window._rdxCurrentId) syncButton(button, window._rdxCurrentId);
      else injectButton();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof RETRODEX_COLLECTION !== 'undefined') {
      RETRODEX_COLLECTION.syncCatalog(window.CATALOG_DATA, window.PRICES_DATA);
    }
    refreshStats();
    bindToggle();
    observeBottomScreen();
    bindGlobalHooks();
  });
})();
