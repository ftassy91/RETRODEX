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

  function getMetascoreValue(record) {
    return record && typeof record.score === 'number' && Number.isFinite(record.score)
      ? record.score
      : null;
  }

  function getCoverageLevel(record) {
    return typeof RETROMARKET_PRESENTATION !== 'undefined' && typeof RETROMARKET_PRESENTATION.getCoverageLevel === 'function'
      ? RETROMARKET_PRESENTATION.getCoverageLevel(record)
      : 'SNAPSHOT';
  }

  function getRecentSalesCount(record) {
    return record && record.recentSales && record.recentSales.status === 'ready' && Array.isArray(record.recentSales.items)
      ? record.recentSales.items.length
      : 0;
  }

  function renderMetricRow(label, value, note) {
    return `
      <div class="rm-focus-metric-row">
        <span>${esc(label)}</span>
        <div class="rm-focus-metric-copy">
          <strong>${esc(value)}</strong>
          ${note ? `<small>${esc(note)}</small>` : ''}
        </div>
      </div>
    `;
  }

  function bindScreenLinks(scope) {
    if (!scope) return;
    scope.querySelectorAll('[data-screen-target]').forEach((button) => {
      button.addEventListener('click', () => {
        setScreen(button.getAttribute('data-screen-target'));
      });
    });
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
    if (selectedGameId) {
      renderFooter(RETROMARKET_DATA.getMarketRecord(selectedGameId));
    }
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
    if (!games.length) {
      results.innerHTML = '<div class="rm-unavailable">No matching game in local dataset.</div>';
      return;
    }

    results.innerHTML = '';
    games.forEach((game) => {
      const button = document.createElement('button');
      button.className = 'rm-result-item';
      button.setAttribute('data-game-id', game.id);

      const main = document.createElement('span');
      main.className = 'rm-result-main';

      const title = document.createElement('span');
      title.className = 'rm-result-title';
      title.textContent = game.title;

      const meta = document.createElement('span');
      meta.className = 'rm-result-meta';
      meta.textContent = `${game.console} | ${game.year || '-'} | ${game.rarity || 'UNKNOWN'}`;

      const side = document.createElement('span');
      side.className = 'rm-result-side';

      const price = document.createElement('small');
      price.textContent = formatCurrency(game.price && game.price.loose);
      side.appendChild(price);

      if (window.RetroDexMetascore) {
        const badge = window.RetroDexMetascore.renderBadge(game.metascore, 'micro');
        badge.title = game.metascore
          ? `Metascore ${game.metascore}/100 · ${window.RetroDexMetascore.getLabel(game.metascore)}`
          : 'Metascore unavailable';
        side.appendChild(badge);
      }

      main.appendChild(title);
      main.appendChild(meta);
      button.appendChild(main);
      button.appendChild(side);
      results.appendChild(button);
    });

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
    if (typeof RETROMARKET_PRESENTATION !== 'undefined' && typeof RETROMARKET_PRESENTATION.getHistoryStatusLabel === 'function') {
      return RETROMARKET_PRESENTATION.getHistoryStatusLabel(record);
    }
    if (!record || !record.history) return 'data unavailable';
    return record.history.status === 'ready'
      ? 'verified 10-year history'
      : 'yearly history unavailable';
  }

  function renderChartNote(record) {
    if (typeof RETROMARKET_PRESENTATION !== 'undefined' && typeof RETROMARKET_PRESENTATION.getChartNote === 'function') {
      return RETROMARKET_PRESENTATION.getChartNote(record);
    }
    if (!record || !record.history) return '';
    if (record.history.status === 'ready') {
      return `<div class="rm-chart-note"><strong>Verified history active.</strong> 10-year chart is rendered from imported yearly market data.</div>`;
    }
    return `<div class="rm-chart-note"><strong>Snapshot mode.</strong> Condition pricing is available, but the 10-year chart is waiting for a verified yearly source.</div>`;
  }

  function renderGameInformation(record) {
    const target = document.getElementById('rm-gameinfo');
    if (!target || !record) return;
    const metascore = getMetascoreValue(record);
    const coverageLevel = getCoverageLevel(record);

    const trendValue = record.marketSignals ? record.marketSignals.trendValue : null;
    const trendLabel = record.marketSignals ? record.marketSignals.trendLabel : 'data unavailable';
    const trendSignal = trendSignalLabel(trendValue);
    const sourceLabel = typeof RETROMARKET_PRESENTATION !== 'undefined' && typeof RETROMARKET_PRESENTATION.getSourceLabel === 'function'
      ? RETROMARKET_PRESENTATION.getSourceLabel(record)
      : (record.sourceMeta ? (record.sourceMeta.sourceName || record.sourceMeta.sourceType || 'verified import') : 'local price snapshot');
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
            <div class="rm-focus-pill-row">
              <span class="rm-focus-pill">${esc(record.genre)}</span>
              <span class="rm-focus-pill">${esc(record.rarity)}</span>
              <span class="rm-focus-pill">${esc(coverageLevel)}</span>
              <span id="rm-focus-metascore-badge"></span>
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
          <div class="rm-quick-nav">
            <button type="button" data-screen-target="chart">OPEN FULL HISTORY</button>
            <button type="button" data-screen-target="insights">OPEN MARKET SIGNALS</button>
          </div>
        </section>
      </div>
    `;

    const badgeHost = document.getElementById('rm-focus-metascore-badge');
    if (badgeHost && window.RetroDexMetascore) {
      const badge = window.RetroDexMetascore.renderBadge(metascore, 'normal');
      badge.title = metascore
        ? `Metascore ${metascore}/100 · ${window.RetroDexMetascore.getLabel(metascore)}`
        : 'Metascore unavailable';
      badgeHost.appendChild(badge);
    }

    bindScreenLinks(target);
    RETROMARKET_CHARTS.drawPriceHistory(document.getElementById('rm-history-chart-focus'), record.history);
  }

  function renderPriceMarket(record) {
    const target = document.getElementById('rm-pricecards');
    if (!target || !record) return;
    const metascore = getMetascoreValue(record);
    const coverageLevel = getCoverageLevel(record);
    const salesCount = getRecentSalesCount(record);
    const sourceLabel = typeof RETROMARKET_PRESENTATION !== 'undefined' && typeof RETROMARKET_PRESENTATION.getSourceLabel === 'function'
      ? RETROMARKET_PRESENTATION.getSourceLabel(record)
      : (record.sourceMeta ? (record.sourceMeta.sourceName || record.sourceMeta.sourceType || 'verified import') : 'local snapshot');
    const sourceVerifiedAt = record.sourceMeta && record.sourceMeta.verifiedAt ? record.sourceMeta.verifiedAt : 'source date unavailable';

    target.innerHTML = `
      <div class="rm-pricecards-shell">
        <div class="rm-panel-head">
          <span>Game Stats</span>
          <small>${esc(record.console)} · ${esc(String(record.year || 'N/A'))}</small>
        </div>

        <section class="rm-pricecards-section" id="rm-pricecards-metascore"></section>

        <section class="rm-pricecards-section">
          <div class="rm-focus-kicker">Price Matrix</div>
          <div class="rm-pricecards-grid">
            ${record.conditions.map(renderConditionCard).join('')}
          </div>
          <div class="rm-pricecards-note">Average values stay visible here, while the history screen isolates time-series data.</div>
        </section>

        <section class="rm-pricecards-section">
          <div class="rm-focus-kicker">Record Profile</div>
          <div class="rm-focus-summary">
            ${renderMetricRow('Publisher', record.publisher, 'studio or label')}
            ${renderMetricRow('Genre', record.genre, 'editorial classification')}
            ${renderMetricRow('Rarity', record.rarity, 'collector tier')}
            ${renderMetricRow('Coverage', coverageLevel, formatHistoryStatus(record))}
            ${renderMetricRow('Sales Indexed', String(salesCount), record.marketSignals.lastSaleDate || 'no recent verified sale')}
            ${renderMetricRow('Source', sourceLabel, sourceVerifiedAt)}
          </div>
        </section>

        <section class="rm-pricecards-section">
          <div class="rm-focus-kicker">Navigation</div>
          <div class="rm-quick-nav">
            <button type="button" data-screen-target="game">GAME FOCUS</button>
            <button type="button" data-screen-target="chart">PRICE HISTORY</button>
            <button type="button" data-screen-target="insights">MARKET SIGNALS</button>
            <button type="button" data-screen-target="search">NEW SEARCH</button>
          </div>
        </section>
      </div>
    `;

    const metascoreTarget = document.getElementById('rm-pricecards-metascore');
    if (metascoreTarget) {
      if (window.RetroDexMetascore) {
        const block = window.RetroDexMetascore.renderBlock(metascore);
        const note = block.querySelector('.metascore-block__note');
        if (note && metascore !== null) {
          note.textContent = `Note presse · ${coverageLevel.toLowerCase()} market profile`;
        }
        metascoreTarget.appendChild(block);
      } else {
        metascoreTarget.innerHTML = renderMetricRow('Metascore', metascore === null ? 'N/A' : String(metascore), metascore === null ? 'press score unavailable' : 'press score');
      }
    }

    bindScreenLinks(target);
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
      <span>SEARCH : /</span>
      <span>ENTER : OPEN GAME</span>
      <span>VIEW : ${esc(activeScreen.toUpperCase())} · 2 GAME · 3 HISTORY · 4 SIGNALS</span>
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
