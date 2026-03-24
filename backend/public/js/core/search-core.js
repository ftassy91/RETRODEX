'use strict';
/**
 * backend/public/js/core/search-core.js
 * JavaScript navigateur uniquement — aucun import Node.js.
 * Expose : window.RetroDexSearch
 *
 * Principe :
 *   - Index en mémoire chargé UNE fois depuis /api/games?limit=1500
 *   - search(query, filters, context, limit) = seul point d'entrée
 *   - Contextes : all | retrodex | retromarket | collection | neoretro
 */
;(() => {
  let _idx = [];
  let _loaded = false;
  let _loading = null;

  function tok(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  function score(item, queryTokens) {
    if (!queryTokens.length) return 50;

    let total = 0;
    const titleTokens = tok(item.title);
    const allTokens = [
      ...titleTokens,
      ...tok(item.subtitle),
      ...tok(item.meta?.console),
      ...tok(item.meta?.genre),
      ...tok(item.meta?.developer),
      ...tok(item.meta?.manufacturer),
    ];

    queryTokens.forEach((queryToken) => {
      if (titleTokens.some((token) => token === queryToken)) total += 40;
      else if (titleTokens.some((token) => token.startsWith(queryToken))) total += 25;
      else if (titleTokens.some((token) => token.includes(queryToken))) total += 15;
      else if (allTokens.some((token) => token.includes(queryToken))) total += 8;
    });

    total += ({ LEGENDARY: 6, EPIC: 4, RARE: 2, UNCOMMON: 1, COMMON: 0 }[item.meta?.rarity] || 0);
    if (item.meta?.synopsis) total += 3;
    if (item.meta?.metascore) total += 2;
    if (item.type !== 'game' && total < 20) total -= 5;

    return Math.max(0, Math.min(100, total));
  }

  async function safeJson(url, fallback) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (_error) {
      return fallback;
    }
  }

  async function loadIndex() {
    if (_loaded) return _idx;
    if (_loading) return _loading;

    _loading = (async () => {
      try {
        const [gamesPayload, franchisesPayload, consolesPayload] = await Promise.all([
          safeJson('/api/games?limit=1500&sort=rarity_desc', { items: [] }),
          safeJson('/api/franchises', { items: [] }),
          safeJson('/api/consoles', { consoles: [] }),
        ]);

        const games = (gamesPayload.items || []).map((game) => ({
          id: game.id,
          type: 'game',
          title: game.title || '',
          subtitle: `${game.console || ''} · ${game.year || ''}`.trim(),
          href: `/game-detail.html?id=${encodeURIComponent(game.id)}`,
          meta: {
            console: game.console || null,
            year: game.year ?? null,
            genre: game.genre || null,
            rarity: game.rarity || null,
            metascore: game.metascore ?? null,
            cover_url: game.cover_url || null,
            developer: game.developer || null,
            loosePrice: game.loosePrice ?? null,
            cibPrice: game.cibPrice ?? null,
            mintPrice: game.mintPrice ?? null,
            synopsis: game.synopsis || null,
            tagline: game.tagline || null,
            summary: game.summary || null,
            source_confidence: game.source_confidence ?? null,
          },
        }));

        const franchises = (franchisesPayload.items || franchisesPayload.franchises || []).map((franchise) => ({
          id: `franchise-${franchise.slug || franchise.id}`,
          type: 'franchise',
          title: franchise.name || '',
          subtitle: `${franchise.developer || ''} · ${franchise.first_game || ''}–${franchise.last_game || ''}`.trim(),
          href: `/franchises.html?slug=${encodeURIComponent(franchise.slug || '')}`,
          meta: {
            developer: franchise.developer || null,
            rarity: null,
          },
        }));

        const consoles = (consolesPayload.consoles || []).map((consoleItem) => ({
          id: `console-${consoleItem.id || consoleItem.platform}`,
          type: 'console',
          title: consoleItem.title || consoleItem.platform || '',
          subtitle: `${consoleItem.manufacturer || ''} · ${consoleItem.year || ''} · ${consoleItem.gamesCount || 0} jeux`.trim(),
          href: `/encyclopedia.html?console=${encodeURIComponent(consoleItem.id || consoleItem.platform || '')}`,
          meta: {
            manufacturer: consoleItem.manufacturer || null,
            year: consoleItem.year ?? null,
            rarity: null,
          },
        }));

        _idx = [...games, ...franchises, ...consoles];
        _loaded = true;
        return _idx;
      } catch (error) {
        console.warn('[SearchCore] index load error:', error.message);
        _idx = [];
        _loaded = false;
        return [];
      } finally {
        _loading = null;
      }
    })();

    return _loading;
  }

  const CTX = {
    all: {
      label: 'TOUS',
      pre: () => true,
      post: (results) => results,
    },
    retrodex: {
      label: 'RETRODEX',
      pre: (item) => ['game', 'franchise', 'console'].includes(item.type),
      post: (results) => results.map((item) => ({
        ...item,
        score: item.score + (item.meta?.synopsis ? 12 : 0) + (item.meta?.summary ? 4 : 0) + (item.type === 'franchise' ? 6 : 0),
      })),
    },
    retromarket: {
      label: 'RETROMARKET',
      pre: (item) => item.type === 'game' && item.meta?.loosePrice != null,
      post: (results) => results.map((item) => ({
        ...item,
        score: item.score
          + (item.meta?.metascore ? 5 : 0)
          + (['LEGENDARY', 'EPIC', 'RARE'].includes(item.meta?.rarity) ? 8 : 0)
          + ((item.meta?.source_confidence || 0) >= 0.7 ? 4 : 0),
      })),
    },
    collection: {
      label: 'COLLECTION',
      pre: (item) => item.type === 'game',
      post: (results) => results,
    },
    neoretro: {
      label: 'NEORETRO',
      pre: (item) => item.type === 'game' && (item.meta?.year || 0) >= 1995,
      post: (results) => results,
    },
  };

  async function search(query = '', filters = {}, context = 'all', limit = 20) {
    const idx = await loadIndex();
    const layer = CTX[context] || CTX.all;
    const queryTokens = tok(query);

    let results = idx.filter(layer.pre);

    if (filters.console) {
      results = results.filter((item) => item.meta?.console === filters.console);
    }
    if (filters.genre) {
      results = results.filter((item) => item.meta?.genre === filters.genre);
    }
    if (filters.rarity) {
      results = results.filter((item) => item.meta?.rarity === filters.rarity);
    }
    if (filters.minPrice != null) {
      results = results.filter((item) => (item.meta?.loosePrice || 0) >= filters.minPrice);
    }
    if (filters.maxPrice != null) {
      results = results.filter((item) => (item.meta?.loosePrice || Number.POSITIVE_INFINITY) <= filters.maxPrice);
    }
    if (filters.hasMetascore) {
      results = results.filter((item) => item.meta?.metascore != null);
    }

    results = results
      .map((item) => ({ ...item, score: score(item, queryTokens) }))
      .filter((item) => !queryTokens.length || item.score > 0);

    results = layer.post(results)
      .sort((left, right) => (right.score - left.score) || String(left.title || '').localeCompare(String(right.title || ''), 'fr', { sensitivity: 'base' }));

    return results.slice(0, limit);
  }

  function invalidate() {
    _idx = [];
    _loaded = false;
    _loading = null;
  }

  function preload() {
    if (!_loaded && !_loading) {
      loadIndex();
    }
  }

  function status() {
    return {
      size: _idx.length,
      loaded: _loaded,
    };
  }

  window.RetroDexSearch = {
    search,
    invalidate,
    preload,
    status,
    CTX,
  };
})();
