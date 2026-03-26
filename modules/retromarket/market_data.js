const RETROMARKET_DATA = (() => {
  const HISTORY_YEARS = 10;
  let historyByGame = new Map();
  let salesByGame = new Map();
  let sourceByGame = new Map();

  function safeNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  function formatCurrency(value) {
    return typeof value === 'number' && Number.isFinite(value)
      ? '$' + Math.round(value).toLocaleString('en-US')
      : 'data unavailable';
  }

  function publisherFor(game) {
    return game.publisher || game.editor || game.publisherName || game.developer || 'data unavailable';
  }

  function genreFor(game) {
    const entry = window.ENTRIES_DATA && window.ENTRIES_DATA[game.id];
    return game.genre || (entry && entry.genre) || 'data unavailable';
  }

  function estimateRangeLabel() {
    return 'data unavailable';
  }

  function conditionBucket(condition) {
    const normalized = String(condition || '').trim().toLowerCase();
    if (normalized === 'loose') return 'Loose';
    if (normalized === 'cib' || normalized === 'complete in box') return 'CIB';
    if (normalized === 'sealed') return 'Sealed';
    if (normalized === 'incomplete') return 'Incomplete';
    return 'Unknown';
  }

  function buildSalesSummary(items) {
    const summary = new Map();
    (items || []).forEach((entry) => {
      const bucket = conditionBucket(entry.condition);
      if (bucket === 'Unknown') return;
      const current = summary.get(bucket) || { prices: [], latestDate: '' };
      current.prices.push(entry.price);
      if (!current.latestDate || entry.date > current.latestDate) current.latestDate = entry.date;
      summary.set(bucket, current);
    });
    return summary;
  }

  function rangeLabel(prices) {
    if (!prices || !prices.length) return estimateRangeLabel();
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return `${formatCurrency(min)} - ${formatCurrency(max)}`;
  }

  function averagePrice(prices, fallback) {
    if (!prices || !prices.length) return fallback;
    return prices.reduce((sum, value) => sum + value, 0) / prices.length;
  }

  function buildConditionRow(label, average, range, status, note) {
    return { label, average, range, status, note };
  }

  function compareAgainstSnapshot(summary, snapshotValue) {
    if (!summary || !summary.prices || !summary.prices.length || !snapshotValue) return null;
    const average = averagePrice(summary.prices, snapshotValue);
    if (!average || !snapshotValue) return null;
    return ((average - snapshotValue) / snapshotValue) * 100;
  }

  function signalForGame(game, importedHistory, looseSales, cibSales, sealedSales) {
    const historyTrend = trendFromHistory(importedHistory);
    if (historyTrend !== null) return historyTrend;

    const price = game.price || {};
    const snapshots = [
      compareAgainstSnapshot(looseSales, safeNumber(price.loose)),
      compareAgainstSnapshot(cibSales, safeNumber(price.cib)),
      compareAgainstSnapshot(sealedSales, safeNumber(price.mint))
    ].filter((value) => value !== null);

    if (!snapshots.length) return null;
    return snapshots.reduce((sum, value) => sum + value, 0) / snapshots.length;
  }

  function totalSalesIndexed() {
    return [...salesByGame.values()].reduce((sum, items) => sum + items.length, 0);
  }

  function normalizeHistoryEntry(entry) {
    const year = Number(entry && entry.year);
    const value = safeNumber(entry && entry.value);
    if (!year || value === null) return null;
    return { year, value };
  }

  function normalizeSaleEntry(entry) {
    const price = safeNumber(entry && entry.price);
    if (price === null) return null;
    return {
      date: String((entry && entry.date) || 'unknown'),
      price,
      condition: String((entry && entry.condition) || 'unknown')
    };
  }

  function normalizeSourceEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const normalized = {
      sourceType: String(entry.sourceType || '').trim(),
      sourceName: String(entry.sourceName || '').trim(),
      sourceUrl: String(entry.sourceUrl || '').trim(),
      verifiedAt: String(entry.verifiedAt || '').trim(),
      notes: String(entry.notes || '').trim()
    };
    return Object.values(normalized).some(Boolean) ? normalized : null;
  }

  function buildMap(source, normalizer) {
    const map = new Map();
    const records = source && typeof source === 'object' ? source : {};
    Object.entries(records).forEach(([gameId, items]) => {
      if (Array.isArray(items)) {
        const normalized = items.map(normalizer).filter(Boolean);
        if (normalized.length) map.set(gameId, normalized);
        return;
      }

      const normalized = normalizer(items);
      if (normalized) map.set(gameId, normalized);
    });
    return map;
  }

  function loadImportedMaps() {
    historyByGame = buildMap(window.MARKET_HISTORY_DATA, normalizeHistoryEntry);
    salesByGame = buildMap(window.MARKET_SALES_DATA, normalizeSaleEntry);
    sourceByGame = buildMap(window.MARKET_SOURCE_DATA, normalizeSourceEntry);
  }

  function snapshotStableClassic(game) {
    const price = game.price || {};
    const loose = safeNumber(price.loose);
    const cib = safeNumber(price.cib);
    if (!loose || !cib) return false;
    const premium = cib / loose;
    return (game.metascore || 0) >= 85 && premium <= 2.2;
  }

  function trendFromHistory(points) {
    if (!points || points.length < 2) return null;
    const first = points[0].value;
    const last = points[points.length - 1].value;
    if (!first || !last) return null;
    return ((last - first) / first) * 100;
  }

  function latestYears(points) {
    if (!points || !points.length) return HISTORY_YEARS;
    const years = points.map(point => point.year);
    return Math.max(...years) - Math.min(...years) + 1;
  }

  function getGames() {
    return typeof DATA_LAYER !== 'undefined' && typeof DATA_LAYER.getGames === 'function'
      ? DATA_LAYER.getGames()
      : [];
  }

  function importedGameIds() {
    return new Set([...historyByGame.keys(), ...salesByGame.keys(), ...sourceByGame.keys()]);
  }

  function getTopMintGame(games) {
    return [...games]
      .filter(game => safeNumber(game?.price?.mint))
      .sort((left, right) => (right.price.mint || 0) - (left.price.mint || 0))[0] || null;
  }

  function getTopStableGame(games) {
    return [...games]
      .filter(snapshotStableClassic)
      .sort((left, right) => (right.metascore || 0) - (left.metascore || 0))[0] || null;
  }

  function getHistoryReadyGame(games) {
    return games.find(game => historyByGame.has(game.id)) || null;
  }

  function getSalesReadyGame(games) {
    return games.find(game => salesByGame.has(game.id)) || null;
  }

  function buildInsightItem(game, value, valueLabel) {
    return {
      gameId: game.id,
      title: game.title,
      console: game.console,
      value,
      valueLabel
    };
  }

  return {
    async init() {
      if (typeof DATA_LAYER !== 'undefined' && typeof DATA_LAYER.init === 'function') {
        await DATA_LAYER.init();
      }
      loadImportedMaps();
    },

    searchGames(query) {
      if (typeof DATA_LAYER === 'undefined' || typeof DATA_LAYER.searchGames !== 'function') return [];
      return DATA_LAYER.searchGames(query || '').slice(0, 12);
    },

    getGameById(gameId) {
      if (typeof DATA_LAYER === 'undefined' || typeof DATA_LAYER.getGameBySlug !== 'function') return null;
      return DATA_LAYER.getGameBySlug(gameId);
    },

    getOverview() {
      const games = getGames();
      const pricedGames = games.filter(game => game && game.price).length;
      const importedGames = importedGameIds().size;
      const consoles = typeof DATA_LAYER !== 'undefined' && typeof DATA_LAYER.getConsoles === 'function'
        ? DATA_LAYER.getConsoles()
        : [];
      const trendSamples = games.map((game) => {
        const importedHistory = historyByGame.get(game.id) || [];
        const importedSales = salesByGame.get(game.id) || [];
        const salesSummary = buildSalesSummary(importedSales);
        return signalForGame(
          game,
          importedHistory,
          salesSummary.get('Loose'),
          salesSummary.get('CIB'),
          salesSummary.get('Sealed')
        );
      }).filter((value) => value !== null);

      return {
        trackedGames: games.length,
        trackedConsoles: consoles.length,
        pricedGames,
        historyGames: historyByGame.size,
        salesGames: salesByGame.size,
        sourceGames: sourceByGame.size,
        importedGames,
        marketTrend: trendSamples.length ? trendSamples.reduce((sum, value) => sum + value, 0) / trendSamples.length : null,
        salesIndexed: totalSalesIndexed()
      };
    },

    getImportStatus() {
      return {
        historyGames: historyByGame.size,
        salesGames: salesByGame.size,
        sourceGames: sourceByGame.size,
        importedGames: importedGameIds().size,
        historyFile: 'data/market_history.js',
        salesFile: 'data/market_sales.js',
        sourceFile: 'data/market_sources.js',
        readmeFile: 'modules/retromarket/README.md',
        curationJsonFile: 'data/market_curation_batch_001.json',
        curationMdFile: 'data/market_curation_batch_001.md'
      };
    },

    getAvailableCoverageConsoles() {
      const consoles = new Set();
      this.getCoverageGames('all', 'title', 'ALL').forEach((game) => consoles.add(game.console));
      return ['ALL', ...Array.from(consoles).sort((left, right) => left.localeCompare(right))];
    },

    getConsoleCoverage() {
      const games = getGames();
      const buckets = new Map();

      games.forEach((game) => {
        const current = buckets.get(game.console) || { console: game.console, total: 0, history: 0, sales: 0, source: 0 };
        current.total += 1;
        if (historyByGame.has(game.id)) current.history += 1;
        if (salesByGame.has(game.id)) current.sales += 1;
        if (sourceByGame.has(game.id)) current.source += 1;
        buckets.set(game.console, current);
      });

      return Array.from(buckets.values()).sort((left, right) => {
        const leftScore = left.history + left.sales + left.source;
        const rightScore = right.history + right.sales + right.source;
        if (rightScore !== leftScore) return rightScore - leftScore;
        return left.console.localeCompare(right.console);
      });
    },

    getCoverageGames(filter = 'all', sortBy = 'coverage', consoleFilter = 'ALL') {
      const games = getGames();
      const filtered = games.filter((game) => {
        const hasHistory = historyByGame.has(game.id);
        const hasSales = salesByGame.has(game.id);
        const hasSource = sourceByGame.has(game.id);
        if (consoleFilter !== 'ALL' && game.console !== consoleFilter) return false;
        if (filter === 'history') return hasHistory;
        if (filter === 'sales') return hasSales;
        if (filter === 'sources') return hasSource;
        if (filter === 'verified') return hasHistory || hasSales || hasSource;
        return true;
      });

      return filtered
        .map((game) => ({
          id: game.id,
          title: game.title,
          console: game.console,
          hasHistory: historyByGame.has(game.id),
          hasSales: salesByGame.has(game.id),
          hasSource: sourceByGame.has(game.id),
          quality: (historyByGame.has(game.id) ? 2 : 0) + (salesByGame.has(game.id) ? 1 : 0) + (sourceByGame.has(game.id) ? 1 : 0),
          mint: safeNumber(game?.price?.mint)
        }))
        .sort((left, right) => {
          if (sortBy === 'mint') {
            return (right.mint || 0) - (left.mint || 0) || left.title.localeCompare(right.title);
          }
          if (sortBy === 'title') {
            return left.title.localeCompare(right.title);
          }
          const leftWeight = left.quality;
          const rightWeight = right.quality;
          if (rightWeight !== leftWeight) return rightWeight - leftWeight;
          return (right.mint || 0) - (left.mint || 0) || left.title.localeCompare(right.title);
        });
    },

    getQuickActions() {
      const games = getGames();
      const actions = [];
      const randomSeed = games.length ? games[Math.floor(Math.random() * games.length)] : null;
      const mintLeader = getTopMintGame(games);
      const stableLeader = getTopStableGame(games);
      const historyReady = getHistoryReadyGame(games);
      const salesReady = getSalesReadyGame(games);

      if (randomSeed) actions.push({ action: 'random', label: 'Random Game', description: randomSeed.title, gameId: randomSeed.id });
      if (mintLeader) actions.push({ action: 'mint', label: 'Highest Mint', description: formatCurrency(mintLeader.price.mint), gameId: mintLeader.id });
      if (stableLeader) actions.push({ action: 'stable', label: 'Stable Classic', description: stableLeader.title, gameId: stableLeader.id });
      if (historyReady) actions.push({ action: 'history', label: 'With History', description: historyReady.title, gameId: historyReady.id });
      if (salesReady) actions.push({ action: 'sales', label: 'With Sales', description: salesReady.title, gameId: salesReady.id });

      return actions.slice(0, 5);
    },

    getMarketRecord(gameId) {
      const game = this.getGameById(gameId);
      if (!game) return null;

      const price = game.price || {};
      const loose = safeNumber(price.loose);
      const cib = safeNumber(price.cib);
      const mint = safeNumber(price.mint);
      const importedHistory = historyByGame.get(game.id) || [];
      const importedSales = salesByGame.get(game.id) || [];
      const sourceMeta = sourceByGame.get(game.id) || null;
      const salesSummary = buildSalesSummary(importedSales);
      const looseSales = salesSummary.get('Loose');
      const cibSales = salesSummary.get('CIB');
      const sealedSales = salesSummary.get('Sealed');
      const incompleteSales = salesSummary.get('Incomplete');
      const trend = signalForGame(game, importedHistory, looseSales, cibSales, sealedSales);
      const lastSaleDate = importedSales.length ? importedSales.map(item => item.date).sort().slice(-1)[0] : '';

      return {
        id: game.id,
        title: game.title,
        console: game.console,
        year: game.year || 'data unavailable',
        publisher: publisherFor(game),
        genre: genreFor(game),
        rarity: game.rarity || 'UNKNOWN',
        score: game.metascore || 'data unavailable',
        sourceLabel: importedHistory.length || importedSales.length || sourceMeta ? 'verified local import' : 'local price snapshot',
        marketMode: importedHistory.length || importedSales.length || sourceMeta ? 'verified import available' : 'snapshot only',
        verificationStatus: sourceMeta ? 'attributed' : (importedHistory.length || importedSales.length ? 'imported' : 'snapshot'),
        sourceMeta,
        conditions: [
          buildConditionRow(
            'Loose',
            averagePrice(looseSales && looseSales.prices, loose),
            rangeLabel(looseSales && looseSales.prices),
            looseSales ? 'verified' : (loose ? 'snapshot' : 'unavailable'),
            looseSales ? `Verified sales through ${looseSales.latestDate}` : (loose ? 'Local snapshot price' : 'No local price')
          ),
          buildConditionRow(
            'CIB',
            averagePrice(cibSales && cibSales.prices, cib),
            rangeLabel(cibSales && cibSales.prices),
            cibSales ? 'verified' : (cib ? 'snapshot' : 'unavailable'),
            cibSales ? `Verified sales through ${cibSales.latestDate}` : (cib ? 'Local snapshot price' : 'No local price')
          ),
          buildConditionRow(
            'Sealed',
            averagePrice(sealedSales && sealedSales.prices, null),
            rangeLabel(sealedSales && sealedSales.prices),
            sealedSales ? 'verified' : 'unavailable',
            sealedSales ? `Verified sales through ${sealedSales.latestDate}` : 'Needs verified source'
          ),
          buildConditionRow(
            'Incomplete',
            averagePrice(incompleteSales && incompleteSales.prices, null),
            rangeLabel(incompleteSales && incompleteSales.prices),
            incompleteSales ? 'verified' : 'unavailable',
            incompleteSales ? `Verified sales through ${incompleteSales.latestDate}` : 'Needs verified source'
          )
        ],
        latestSnapshot: { loose, cib, mint },
        marketSignals: {
          trendLabel: trend === null ? 'data unavailable' : `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
          trendValue: trend,
          lastSaleDate: lastSaleDate || 'data unavailable'
        },
        history: importedHistory.length ? {
          years: latestYears(importedHistory),
          points: importedHistory,
          status: 'ready',
          message: ''
        } : {
          years: HISTORY_YEARS,
          points: [],
          status: 'unavailable',
          message: 'No verified year-by-year price history is available in the local dataset.'
        },
        recentSales: importedSales.length ? {
          items: importedSales,
          status: 'ready',
          message: ''
        } : {
          items: [],
          status: 'unavailable',
          message: 'Verified recent sales are unavailable in local mode.'
        }
      };
    },

    getInsights() {
      const games = getGames();
      const priced = games.filter(game => game && game.price);

      const expensive = [...priced]
        .filter(game => safeNumber(game.price.mint))
        .sort((left, right) => (right.price.mint || 0) - (left.price.mint || 0))
        .slice(0, 5);

      const stable = [...priced]
        .filter(snapshotStableClassic)
        .sort((left, right) => (right.metascore || 0) - (left.metascore || 0))
        .slice(0, 5);

      const trendSignals = games
        .map((game) => {
          const importedHistory = historyByGame.get(game.id) || [];
          const importedSales = salesByGame.get(game.id) || [];
          const salesSummary = buildSalesSummary(importedSales);
          return {
            game,
            trend: signalForGame(
              game,
              importedHistory,
              salesSummary.get('Loose'),
              salesSummary.get('CIB'),
              salesSummary.get('Sealed')
            )
          };
        })
        .filter((item) => item.trend !== null);

      const rising = trendSignals
        .filter(item => item.trend !== null && item.trend > 0)
        .sort((left, right) => right.trend - left.trend)
        .slice(0, 5);

      const falling = trendSignals
        .filter((item) => item.trend < 0)
        .sort((left, right) => left.trend - right.trend)
        .slice(0, 5);

      const recentSalesVolume = [...salesByGame.entries()]
        .map(([gameId, items]) => {
          const game = this.getGameById(gameId);
          return game ? { game, count: items.length } : null;
        })
        .filter(Boolean)
        .sort((left, right) => right.count - left.count)
        .slice(0, 5);

      const recentSalesFeed = [...salesByGame.entries()]
        .flatMap(([gameId, items]) => {
          const game = this.getGameById(gameId);
          if (!game) return [];
          return items.map((sale) => ({
            gameId,
            title: game.title,
            date: sale.date,
            valueLabel: `${sale.condition} ${formatCurrency(sale.price)}`
          }));
        })
        .sort((left, right) => String(right.date).localeCompare(String(left.date)))
        .slice(0, 5);

      return {
        topRisingGames: {
          status: rising.length ? 'ready' : 'unavailable',
          items: rising.map(item => buildInsightItem(item.game, item.trend, `${item.trend >= 0 ? '+' : ''}${item.trend.toFixed(1)}%`)),
          message: rising.length ? '' : 'Trend analysis needs imported historical price data or verified sales deltas.'
        },
        topFallingGames: {
          status: falling.length ? 'ready' : 'unavailable',
          items: falling.map(item => buildInsightItem(item.game, item.trend, `${item.trend.toFixed(1)}%`)),
          message: falling.length ? '' : 'Top falling games require imported historical price data or verified sales deltas.'
        },
        mostExpensiveGames: {
          status: expensive.length ? 'ready' : 'unavailable',
          items: expensive.map(game => buildInsightItem(game, game.price.mint, formatCurrency(game.price.mint))),
          message: expensive.length ? '' : 'No mint pricing is available.'
        },
        recentSales: {
          status: recentSalesFeed.length ? 'ready' : 'unavailable',
          items: recentSalesFeed.map((item) => ({
            gameId: item.gameId,
            title: item.title,
            valueLabel: `${item.date} | ${item.valueLabel}`
          })),
          message: recentSalesFeed.length ? '' : 'Recent sales require verified sales imports.'
        },
        recentMarketTrends: {
          status: recentSalesVolume.length ? 'ready' : 'unavailable',
          items: recentSalesVolume.map(item => buildInsightItem(item.game, item.count, `${item.count} sales`)),
          message: recentSalesVolume.length ? '' : 'Recent market trends require verified recent sales imports.'
        },
        stableClassics: {
          status: stable.length ? 'ready' : 'unavailable',
          items: stable.map(game => buildInsightItem(game, game.price.cib, formatCurrency(game.price.cib))),
          message: stable.length ? 'Snapshot heuristic based on price spread and metascore.' : 'Not enough data.'
        }
      };
    }
  };
})();
