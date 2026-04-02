'use strict';
;(() => {
  const cache = new Map();
  let lastPayload = null;

  const CTX = {
    all: { label: 'TOUS' },
    retrodex: { label: 'RETRODEX' },
    retromarket: { label: 'RETROMARKET' },
    collection: { label: 'COLLECTION' },
    neoretro: { label: 'NEORETRO' },
  };

  function normalizeContext(context) {
    return CTX[context] ? context : 'all';
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

  async function search(query = '', filters = {}, context = 'all', limit = 20) {
    const trimmed = String(query || '').trim();
    const nextContext = normalizeContext(context);

    if (trimmed.length < 2) {
      return [];
    }

    const key = JSON.stringify({ trimmed, filters, nextContext, limit });
    if (cache.has(key)) {
      lastPayload = cache.get(key);
      return lastPayload.items || [];
    }

    const url = new URL('/api/search/global', window.location.origin);
    url.searchParams.set('q', trimmed);
    url.searchParams.set('context', nextContext);
    url.searchParams.set('limit', String(limit));

    const payload = await safeJson(url.toString(), { items: [] });
    let items = payload.items || [];

    if (filters.console) {
      items = items.filter((item) => item.meta?.console === filters.console);
    }
    if (filters.genre) {
      items = items.filter((item) => item.meta?.genre === filters.genre);
    }
    if (filters.rarity) {
      items = items.filter((item) => item.meta?.rarity === filters.rarity);
    }
    if (filters.minPrice != null) {
      items = items.filter((item) => (item.meta?.loosePrice || 0) >= filters.minPrice);
    }
    if (filters.maxPrice != null) {
      items = items.filter((item) => (item.meta?.loosePrice || Number.POSITIVE_INFINITY) <= filters.maxPrice);
    }
    if (filters.hasMetascore) {
      items = items.filter((item) => item.meta?.metascore != null);
    }

    const nextPayload = {
      ...payload,
      items,
      count: items.length,
    };

    cache.set(key, nextPayload);
    lastPayload = nextPayload;
    return items;
  }

  function invalidate() {
    cache.clear();
  }

  function preload() {
    return Promise.resolve();
  }

  function status() {
    return {
      size: cache.size,
      loaded: cache.size > 0,
    };
  }

  function getLastPayload() {
    return lastPayload;
  }

  window.RetroDexSearch = {
    search,
    invalidate,
    preload,
    status,
    lastPayload: getLastPayload,
    CTX,
  };
})();
