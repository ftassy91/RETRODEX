const DATA_LAYER = (() => {
  const state = {
    games: [],
    consoles: [],
    prices: [],
    entries: {},
    pricesByGame: new Map(),
    gamesById: new Map(),
    enrichedGames: [],
    consolesWithCounts: [],
    loaded: false
  };

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function getPriceEntry(gameId) {
    return state.pricesByGame.get(gameId) || null;
  }

  function enrichGame(game) {
    return { ...game, price: getPriceEntry(game.id) };
  }

  function clonePrice(price) {
    return price ? { ...price } : null;
  }

  function cloneGame(game) {
    return { ...game, price: clonePrice(game.price) };
  }

  return {
    async init() {
      if (state.loaded) return;

      // Use inline JS data (works with file://) — loaded via <script> tags in index.html
      // Fallback: try fetch (works with http://)
      const load = async (varName, path) => {
        if (window[varName]) return window[varName];
        const r = await fetch(path);
        if (!r.ok) throw new Error(`Failed to load ${path}`);
        return r.json();
      };

      const [games, consoles, prices, entries] = await Promise.all([
        load('CATALOG_DATA',  'data/catalog.json'),
        load('CONSOLES_DATA', 'data/consoles.json'),
        load('PRICES_DATA',   'data/prices.json'),
        load('ENTRIES_DATA',  'data/entries.json')
      ]);

      state.games    = Array.isArray(games)    ? games    : [];
      state.consoles = Array.isArray(consoles) ? consoles : [];
      state.prices   = Array.isArray(prices)   ? prices   : [];
      state.entries  = entries && typeof entries === 'object' ? entries : {};
      state.pricesByGame = new Map(state.prices.map(entry => [entry.game, entry]));
      state.gamesById = new Map(state.games.map(game => [game.id, game]));
      state.enrichedGames = state.games.map(enrichGame);
      state.consolesWithCounts = state.consoles.map(con => {
        const gamesOnConsole = state.games.filter(game => game.console === con.name).length;
        return { ...con, games: gamesOnConsole };
      });
      state.loaded   = true;
    },

    getGames()          { return state.enrichedGames.map(cloneGame); },
    getGameBySlug(slug) {
      const game = state.gamesById.get(slug);
      return game ? cloneGame(enrichGame(game)) : null;
    },
    getGameEntry(id) {
      if (state.entries[id]) return state.entries[id];
      const game = state.gamesById.get(id);
      if (!game) return null;
      return {
        genre: getGenre(game),
        summary: game.title + ' est un jeu ' + getGenre(game).toLowerCase()
          + ' sorti en ' + game.year + ' sur ' + game.console
          + ', développé par ' + (game.developer || 'un studio inconnu')
          + '. Metascore : ' + (game.metascore || 'N/A') + '.',
        story: null,
        codes: [],
        guides: []
      };
    },
    getPrices()         { return state.prices.map(e => ({ ...e })); },

    getConsoles() { return state.consolesWithCounts.map(con => ({ ...con })); },

    getConsoleGen(consoleName) {
      const con = state.consoles.find(c => c.name === consoleName);
      return con ? (con.gen || con.generation || null) : null;
    },

    getGenerations() {
      const gens = new Set(state.consoles.map(c => c.gen || c.generation).filter(Boolean));
      return [...gens].sort((a, b) => a - b);
    },

    getFeaturedGame() {
      const games = this.getGames();
      return games.sort((a, b) => (b.metascore || 0) - (a.metascore || 0))[0] || null;
    },

    searchGames(query, filters = {}) {
      const term = normalizeText(query);
      let results = this.getGames();
      if (filters.console) results = results.filter(g => g.console === filters.console);
      if (filters.rarity)  results = results.filter(g => g.rarity  === filters.rarity);
      if (!term) return results;
      return results.filter(g => {
        const haystack = [g.title, g.console, g.developer, g.rarity, g.year]
          .map(normalizeText).join(' ');
        return haystack.includes(term);
      });
    },

    getMarketOverview() {
      const games  = this.getGames();
      const priced = games.filter(g => g.price);
      const sum = (key) => priced.reduce((s, g) => s + (g.price[key] || 0), 0);
      const avg = (key) => priced.length ? sum(key) / priced.length : 0;
      const sorted = [...priced].sort((a, b) => (b.price?.mint || 0) - (a.price?.mint || 0));
      return {
        trackedGames: priced.length,
        averageLoose: avg('loose'),
        averageCib:   avg('cib'),
        averageMint:  avg('mint'),
        mostValuable: sorted[0] || null,
        topTen:       sorted.slice(0, 10)
      };
    },

    getRarityStats() {
      const counts = {};
      this.getGames().forEach(g => {
        const r = g.rarity || 'UNKNOWN';
        counts[r] = (counts[r] || 0) + 1;
      });
      return counts;
    }
  };
})();
