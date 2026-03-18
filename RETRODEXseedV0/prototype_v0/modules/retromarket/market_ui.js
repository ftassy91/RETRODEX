const RETROMARKET_UI = (() => {
  let selectedGameId = '';
  let activeScreen = 'game';
  let resizeTimer = null;
  const SCREEN_ORDER = ['search', 'game', 'chart', 'insights'];
  const DEFAULT_OPENING_GAMES = [
    'the-legend-of-zelda-ocarina-of-time-nintendo-64',
    'super-mario-64-nintendo-64',
    'tekken-3-playstation'
  ];

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatCurrency(value) {
    return typeof value === 'number' && Number.isFinite(value)
      ? '$' + Math.round(value).toLocaleString('en-US')
      : 'data unavailable';
  }

  function formatCount(value) {
    return typeof value === 'number' && Number.isFinite(value)
      ? value.toLocaleString('en-US')
      : '0';
  }

  function formatTrend(value) {
    return typeof value === 'number' && Number.isFinite(value)
      ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
      : 'data unavailable';
  }

  function renderSharedStatus() {
    const status = window.RETRODEX_DEMO_STATUS || null;
    if (!status) return;
    const subtitle = document.getElementById('rm-subtitle');
    const showcase = document.getElementById('rm-showcase-pill');
    const cards = document.getElementById('rm-cards-pill');
    const verified = document.getElementById('rm-verified-pill');
    if (subtitle) {
      subtitle.textContent = `${status.showcaseGames || 0} showcase games, ${status.showcaseConsoles || 0} consoles, ${status.verifiedHistoryGames || 0} verified charts.`;
    }
    if (showcase) showcase.textContent = String(status.showcaseGames || 0);
    if (cards) cards.textContent = `${status.topCardsReady || 0}/${status.bottomCardsReady || 0}`;
    if (verified) verified.textContent = String(status.verifiedSalesGames || 0);
  }

  function setScreen(screenId) {
    if (!SCREEN_ORDER.includes(screenId)) return;
    activeScreen = screenId;
    document.querySelectorAll('.rm-screen-tab').forEach((button) => {
      button.classList.toggle('active', button.getAttribute('data-screen') === screenId);
    });
    document.querySelectorAll('.rm-view').forEach((view) => {
      view.classList.toggle('active', view.id === `rm-screen-${screenId}`);
    });
  }

  function bindScreenTabs() {
    document.querySelectorAll('.rm-screen-tab').forEach((button) => {
      button.addEventListener('click', () => {
        setScreen(button.getAttribute('data-screen'));
      });
    });
  }

  function selectGame(gameId, keepSearch) {
    const input = document.getElementById('rm-search');
    const game = RETROMARKET_DATA.getGameById(gameId);
    if (!game) return;
    if (input && !keepSearch) input.value = game.title;
    updateSelection(gameId);
    if (!keepSearch) setScreen('game');
  }

  function bindGameButtons(scope) {
    if (!scope) return;
    scope.querySelectorAll('[data-game-id]').forEach((button) => {
      button.addEventListener('click', () => {
        selectGame(button.getAttribute('data-game-id'), button.hasAttribute('data-keep-search'));
        const results = document.getElementById('rm-results');
        if (results) results.innerHTML = '';
      });
    });
  }

  function renderOverview() {
    const target = document.getElementById('rm-overview');
    if (!target) return;
    const overview = RETROMARKET_DATA.getOverview();
    const searchHelp = document.getElementById('rm-search-help');
    if (searchHelp) {
      const status = window.RETRODEX_DEMO_STATUS || null;
      const showcaseText = status ? ` | ${formatCount(status.showcaseGames)} showcase games live` : '';
      searchHelp.textContent = `Search Zelda, Mario, Tekken, Tetris - ${formatCount(overview.salesIndexed)} verified sales indexed${showcaseText}`;
    }
    target.innerHTML = `
      <article class="rm-overview-card">
        <span>Tracked Games</span>
        <strong>${esc(formatCount(overview.trackedGames))}</strong>
      </article>
      <article class="rm-overview-card">
        <span>Tracked Consoles</span>
        <strong>${esc(formatCount(overview.trackedConsoles))}</strong>
      </article>
      <article class="rm-overview-card">
        <span>Market Trend</span>
        <strong class="${overview.marketTrend !== null && overview.marketTrend < 0 ? 'is-negative' : 'is-positive'}">${esc(formatTrend(overview.marketTrend))}</strong>
      </article>
      <article class="rm-overview-card">
        <span>Sales Indexed</span>
        <strong>${esc(formatCount(overview.salesIndexed))}</strong>
      </article>
    `;
  }

  function renderSearchResults(query) {
    const results = document.getElementById('rm-results');
    if (!results) return;
    if (!query) {
      results.innerHTML = '';
      return;
    }

    const games = RETROMARKET_DATA.searchGames(query);
    results.innerHTML = games.length
      ? games.map((game) => `
          <button class="rm-result-item" data-game-id="${esc(game.id)}">
            <span>${esc(game.title)}</span>
            <small>${esc(game.console)} | ${esc(game.year || '-')}</small>
          </button>
        `).join('')
      : '<div class="rm-unavailable">No matching game in local dataset.</div>';

    bindGameButtons(results);
  }

  function renderInfoRow(label, value) {
    return `
      <div class="rm-info-row">
        <span>${esc(label)}</span>
        <strong>${esc(value)}</strong>
      </div>
    `;
  }

  function renderConditionCard(condition) {
    return `
      <article class="rm-price-card ${esc(condition.status)}">
        <span>${esc(condition.label)}</span>
        <strong>${esc(formatCurrency(condition.average))}</strong>
        <small>${esc(condition.range)}</small>
      </article>
    `;
  }

  function renderChip(label) {
    return `<span class="rm-chip">${esc(label)}</span>`;
  }

  function trendSignalLabel(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'SNAPSHOT';
    if (value >= 10) return 'RISING';
    if (value <= -10) return 'COOLING';
    return 'STABLE';
  }

  function formatHistoryStatus(record) {
    if (!record || !record.history) return 'data unavailable';
    return record.history.status === 'ready'
      ? 'verified 10-year history'
      : 'chart fallback active';
  }

  function renderChartNote(record) {
    if (!record || !record.history) return '';
    if (record.history.status === 'ready') {
      return `<div class="rm-chart-note"><strong>Verified history active.</strong> 10-year chart is rendered from imported yearly market data.</div>`;
    }
    return `<div class="rm-chart-note"><strong>Snapshot mode.</strong> Condition pricing is available, but the 10-year chart is waiting for a verified yearly source.</div>`;
  }

  function renderGameInformation(record) {
    const target = document.getElementById('rm-gameinfo');
    if (!target || !record) return;

    const trendValue = record.marketSignals ? record.marketSignals.trendValue : null;
    const trendLabel = record.marketSignals ? record.marketSignals.trendLabel : 'data unavailable';
    const trendSignal = trendSignalLabel(trendValue);
    const sourceLabel = record.sourceMeta
      ? (record.sourceMeta.sourceName || record.sourceMeta.sourceType || 'verified import')
      : 'local price snapshot';
    const summaryCards = record.conditions.slice(0, 3).map((condition) => `
      <article class="rm-focus-summary-item">
        <span>${esc(condition.label)}</span>
        <div class="rm-focus-summary-copy">
          <strong>${esc(formatCurrency(condition.average))}</strong>
          <small>${esc(condition.range)}</small>
        </div>
      </article>
    `).join('');

    target.innerHTML = `
      <div class="rm-focus-shell">
        <section class="rm-focus-section is-header">
          <div class="rm-focus-kicker">Selected Game</div>
          <div class="rm-focus-header-copy">
            <div class="rm-selected-title">${esc(record.title)}</div>
            <div class="rm-focus-meta">
              <div class="rm-selected-subtitle">${esc(record.console)}</div>
              <div class="rm-focus-console">Release ${esc(String(record.year || 'N/A'))}</div>
            </div>
          </div>
        </section>

        <section class="rm-focus-section is-summary">
          <div class="rm-focus-kicker">Market Summary</div>
          <div class="rm-focus-summary">
            ${summaryCards}
          </div>
        </section>

        <section class="rm-focus-section is-trend">
          <div class="rm-focus-kicker">Market Trend</div>
          <div class="rm-focus-trend-grid">
            <div class="rm-focus-row">
              <span>Recent Price Change</span>
              <div class="rm-focus-row-copy">
                <strong class="${trendValue !== null && trendValue < 0 ? 'is-negative' : 'is-positive'}">${esc(trendLabel)}</strong>
                <small>${esc(record.marketMode)}</small>
              </div>
            </div>
            <div class="rm-focus-row">
              <span>Trend Indicator</span>
              <div class="rm-focus-row-copy">
                <strong>${esc(trendSignal)}</strong>
                <small>${esc(record.marketSignals.lastSaleDate || 'No verified recent sale')}</small>
              </div>
            </div>
          </div>
          <div class="rm-focus-trend-note">Coverage: ${esc(formatHistoryStatus(record))} | Source: ${esc(sourceLabel)}</div>
        </section>

        <section class="rm-focus-section is-history">
          <div class="rm-focus-kicker">Price History</div>
          <div class="rm-focus-history-note">${record.history && record.history.status === 'ready'
            ? '<strong>Verified history active.</strong> Imported yearly market data drives the chart below.'
            : '<strong>Snapshot mode.</strong> Prices are available, but yearly market history is still missing.'}</div>
          <div class="rm-chart-wrap"><canvas id="rm-history-chart-focus"></canvas></div>
        </section>
      </div>
    `;

    RETROMARKET_CHARTS.drawPriceHistory(document.getElementById('rm-history-chart-focus'), record.history);
  }

  function renderPriceMarket(record) {
    const target = document.getElementById('rm-pricecards');
    if (!target || !record) return;
    target.innerHTML = '';
  }

  function renderChartScreen(record) {
    const target = document.getElementById('rm-pricechart');
    if (!target || !record) return;

    target.innerHTML = `
      <div class="rm-panel-head">
        <span>Price Chart</span>
        <small>${esc(record.marketSignals.trendLabel)}</small>
      </div>
      ${renderChartNote(record)}
      <div class="rm-chart-title">10 YEAR PRICE TREND</div>
      <div class="rm-chart-wrap"><canvas id="rm-history-chart-screen"></canvas></div>
    `;

    RETROMARKET_CHARTS.drawPriceHistory(document.getElementById('rm-history-chart-screen'), record.history);
  }

  function renderInsightBlock(title, block) {
    if (!block || block.status !== 'ready' || !block.items.length) {
      return `
        <section class="rm-insight-block">
          <div class="rm-insight-head">${esc(title)}</div>
          <div class="rm-unavailable">${esc((block && block.message) || 'data unavailable')}</div>
        </section>
      `;
    }

    const visibleItems = block.items.slice(0, 1);
    return `
      <section class="rm-insight-block">
        <div class="rm-insight-head">${esc(title)}</div>
        <div class="rm-insight-list">
          ${visibleItems.map((item) => `
            <button class="rm-insight-row" data-game-id="${esc(item.gameId)}">
              <span>${esc(item.title)}</span>
              <strong>${esc(item.valueLabel || '')}</strong>
            </button>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderInsights() {
    const target = document.getElementById('rm-insights');
    if (!target) return;
    const insights = RETROMARKET_DATA.getInsights();
    target.innerHTML = [
      renderInsightBlock('Top Rising Games', insights.topRisingGames),
      renderInsightBlock('Top Falling Games', insights.topFallingGames),
      renderInsightBlock('Most Expensive Games', insights.mostExpensiveGames),
      renderInsightBlock('Recent Sales', insights.recentSales)
    ].join('');
    bindGameButtons(target);
  }

  function renderFooter(record) {
    const target = document.getElementById('rm-footerline');
    if (!target || !record) return;
    target.innerHTML = `
      <span>SCREENS : 1 SEARCH | 2 MARKET | 3 CHART | 4 INSIGHTS</span>
      <span>SEARCH : /</span>
      <span>ENTER : PICK TOP RESULT</span>
      <span>RAND : R</span>
      <span>MINT LEADER : H</span>
      <span>STATUS : ${esc(record.verificationStatus.toUpperCase())}</span>
    `;
  }

  function updateSelection(gameId) {
    selectedGameId = gameId;
    const record = RETROMARKET_DATA.getMarketRecord(gameId);
    if (!record) return;
    renderGameInformation(record);
    renderPriceMarket(record);
    renderChartScreen(record);
    renderInsights();
    renderFooter(record);
  }

  function bindSearch() {
    const input = document.getElementById('rm-search');
    const results = document.getElementById('rm-results');
    if (!input || !results) return;

    input.addEventListener('input', () => {
      renderSearchResults(input.value.trim());
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        const first = results.querySelector('[data-game-id]');
        if (first) {
          first.click();
          event.preventDefault();
        }
      }
      if (event.key === 'Escape') {
        results.innerHTML = '';
      }
    });

    document.addEventListener('click', (event) => {
      if (!results.contains(event.target) && event.target !== input) {
        results.innerHTML = '';
      }
    });
  }

  function bindResize() {
    window.addEventListener('resize', () => {
      if (!selectedGameId) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => updateSelection(selectedGameId), 120);
    });
  }

  function bindGlobalKeys() {
    document.addEventListener('keydown', (event) => {
      const target = event.target;
      const isTyping = target && /INPUT|TEXTAREA|SELECT/.test(target.tagName);
      const search = document.getElementById('rm-search');

      if (event.key === '/' && search && !isTyping) {
        event.preventDefault();
        setScreen('search');
        search.focus();
        search.select();
      }

      if (isTyping) return;

      if (event.key.toLowerCase() === 'r') {
        const action = RETROMARKET_DATA.getQuickActions().find((item) => item.action === 'random');
        if (action) selectGame(action.gameId);
      }

      if (event.key.toLowerCase() === 'h') {
        const action = RETROMARKET_DATA.getQuickActions().find((item) => item.action === 'mint');
        if (action) selectGame(action.gameId);
      }

      if (event.key === '1') setScreen('search');
      if (event.key === '2') setScreen('game');
      if (event.key === '3') setScreen('chart');
      if (event.key === '4') setScreen('insights');
    });
  }

  return {
    async init() {
      await RETROMARKET_DATA.init();
      renderSharedStatus();
      renderOverview();
      bindScreenTabs();
      bindSearch();
      bindResize();
      bindGlobalKeys();
      renderInsights();
      setScreen(activeScreen);

      const defaultGame = DEFAULT_OPENING_GAMES
        .map((gameId) => RETROMARKET_DATA.getGameById(gameId))
        .find(Boolean)
        || RETROMARKET_DATA.searchGames('zelda')[0]
        || RETROMARKET_DATA.searchGames('mario')[0]
        || (typeof DATA_LAYER !== 'undefined' && DATA_LAYER.getGames ? DATA_LAYER.getGames()[0] : null);

      if (defaultGame) {
        selectGame(defaultGame.id);
      }
    }
  };
})();
