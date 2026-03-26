const RETRODEX_COLLECTION = (() => {
  const STORAGE_KEY = 'retrodex_owned_v1';

  const state = {
    catalog: [],
    pricesByGame: new Map(),
    owned: loadOwnedMap()
  };

  function loadOwnedMap() {
    try {
      const raw = window.localStorage ? window.localStorage.getItem(STORAGE_KEY) : '';
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return Object.keys(parsed).reduce((next, gameId) => {
        if (parsed[gameId]) next[gameId] = true;
        return next;
      }, {});
    } catch (_error) {
      return {};
    }
  }

  function persistOwnedMap() {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.owned));
      }
    } catch (_error) {
      // Ignore storage failures and keep the current in-memory state.
    }
  }

  function emitChange(gameId) {
    window.dispatchEvent(new CustomEvent('retrodex:collection-changed', {
      detail: {
        gameId: gameId || '',
        totalOwned: getOwnedIds().length
      }
    }));
  }

  function buildPriceMap(prices) {
    return new Map((Array.isArray(prices) ? prices : []).map((entry) => [entry.game, entry]));
  }

  function getCatalog() {
    return state.catalog.length
      ? state.catalog
      : (Array.isArray(window.CATALOG_DATA) ? window.CATALOG_DATA : []);
  }

  function getPriceEntry(gameId) {
    if (state.pricesByGame.has(gameId)) return state.pricesByGame.get(gameId);
    const fallback = Array.isArray(window.PRICES_DATA) ? window.PRICES_DATA : [];
    return fallback.find((entry) => entry.game === gameId) || null;
  }

  function getOwnedIds() {
    return Object.keys(state.owned).filter((gameId) => state.owned[gameId]);
  }

  function getOwnedGames() {
    const catalog = getCatalog();
    return catalog.filter((game) => state.owned[game.id]);
  }

  function getLoosePrice(gameId) {
    const entry = getPriceEntry(gameId);
    return entry ? (entry.loose || 0) : 0;
  }

  function getConsoleSummary(consoleOrder, shortLabels) {
    const catalog = getCatalog();
    return (Array.isArray(consoleOrder) ? consoleOrder : []).reduce((rows, consoleName) => {
      const total = catalog.filter((game) => game.console === consoleName).length;
      if (!total) return rows;
      const ownedCount = catalog.filter((game) => game.console === consoleName && state.owned[game.id]).length;
      rows.push({
        console: consoleName,
        label: shortLabels && shortLabels[consoleName] ? shortLabels[consoleName] : consoleName,
        ownedCount,
        total,
        percent: Math.round((ownedCount / total) * 100),
        complete: ownedCount === total && total > 0
      });
      return rows;
    }, []);
  }

  function buildCsvRows() {
    return [
      ['ID', 'Titre', 'Console', 'Annee', 'Prix Loose'],
      ...getOwnedGames().map((game) => [
        game.id,
        `"${String(game.title || '').replace(/"/g, '""')}"`,
        `"${String(game.console || '').replace(/"/g, '""')}"`,
        game.year || '',
        getLoosePrice(game.id) || ''
      ])
    ];
  }

  const api = {
    syncCatalog(games, prices) {
      state.catalog = Array.isArray(games) ? games.slice() : [];
      state.pricesByGame = buildPriceMap(prices);
      return api;
    },

    isOwned(gameId) {
      return !!state.owned[gameId];
    },

    setOwned(gameId, nextValue) {
      if (!gameId) return false;
      if (nextValue) state.owned[gameId] = true;
      else delete state.owned[gameId];
      persistOwnedMap();
      emitChange(gameId);
      return !!state.owned[gameId];
    },

    toggleOwned(gameId) {
      return api.setOwned(gameId, !api.isOwned(gameId));
    },

    getOwnedIds,

    getSnapshot(gameId, consoleName) {
      const catalog = getCatalog();
      let consoleTotal = 0;
      let consoleOwned = 0;
      if (consoleName) {
        consoleTotal = catalog.filter((game) => game.console === consoleName).length;
        consoleOwned = catalog.filter((game) => game.console === consoleName && state.owned[game.id]).length;
      }
      return {
        owned: api.isOwned(gameId),
        totalOwned: getOwnedIds().length,
        consoleOwned,
        consoleTotal
      };
    },

    getSummary(consoleOrder, shortLabels) {
      const ownedIds = getOwnedIds();
      return {
        count: ownedIds.length,
        totalLooseValue: ownedIds.reduce((sum, gameId) => sum + getLoosePrice(gameId), 0),
        consoles: getConsoleSummary(consoleOrder, shortLabels)
      };
    },

    downloadCsv() {
      const rows = buildCsvRows();
      if (rows.length === 1) {
        window.alert('Collection vide.');
        return false;
      }
      const csv = rows.map((row) => row.join(',')).join('\r\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'collection-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      return true;
    }
  };

  window.RETRODEX_COLLECTION_STATE = {
    isOwned: api.isOwned,
    getSnapshot: api.getSnapshot
  };

  return api;
})();
