'use strict';
/**
 * backend/public/js/pages/search.js
 * Search Core inline surface.
 */
;(() => {
  const inputEl = document.getElementById('search-router-input')
    || document.getElementById('search-input')
    || document.querySelector('input[placeholder*="titre"], input[placeholder*="console"], input[type="search"]');
  const resultsEl = document.getElementById('search-core-results');
  const countEl = document.getElementById('search-core-count');
  const tabEls = document.querySelectorAll('.ctx-tab[data-ctx]');

  if (!inputEl || !resultsEl) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const allowedContexts = ['all', 'retrodex', 'retromarket', 'collection', 'neoretro'];

  let currentQuery = params.get('q') || '';
  let currentContext = allowedContexts.includes(params.get('ctx')) ? params.get('ctx') : 'all';
  let searchTimer = null;

  function syncUrl(query, context) {
    const url = new URL(window.location.href);
    if (query) url.searchParams.set('q', query);
    else url.searchParams.delete('q');

    if (context && context !== 'all') url.searchParams.set('ctx', context);
    else url.searchParams.delete('ctx');

    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  }

  function fmtPrice(price) {
    return price != null && Number(price) > 0 ? `$${Number(price).toFixed(0)}` : '';
  }

  function createFallbackMetascoreBadge(score) {
    const badge = document.createElement('span');
    badge.className = 'metascore-badge metascore-badge--micro metascore-badge--good';
    badge.textContent = String(score);
    badge.title = `Metascore : ${score}/100`;
    return badge;
  }

  function createMetascoreBadge(score) {
    if (!score) return null;
    if (window.RetroDexMetascore?.renderBadge) {
      const badge = window.RetroDexMetascore.renderBadge(score, 'micro');
      badge.title = `Metascore : ${score}/100`;
      return badge;
    }
    return createFallbackMetascoreBadge(score);
  }

  function createSignalCard(label, value, modifier = '') {
    const card = document.createElement('div');
    card.className = `surface-signal-card${modifier ? ` ${modifier}` : ''}`;

    const cardLabel = document.createElement('span');
    cardLabel.className = 'surface-signal-label';
    cardLabel.textContent = label;

    const cardValue = document.createElement('span');
    cardValue.className = 'surface-signal-value';
    cardValue.textContent = value;

    card.appendChild(cardLabel);
    card.appendChild(cardValue);
    return card;
  }

  function createChip(label, modifier = '') {
    const chip = document.createElement('span');
    chip.className = `sc-chip${modifier ? ` ${modifier}` : ''}`;
    chip.textContent = label;
    return chip;
  }

  function buildSecondaryCopy(item) {
    const parts = [];
    if (item.type === 'game' && item.meta?.genre) parts.push(item.meta.genre);
    if (item.type === 'game' && item.meta?.developer) parts.push(item.meta.developer);
    if (item.type === 'franchise' && item.meta?.developer) parts.push(item.meta.developer);
    if (item.type === 'console' && item.meta?.manufacturer) parts.push(item.meta.manufacturer);
    if (item.meta?.synopsis) parts.push('editorial');
    if (item.meta?.loosePrice != null) parts.push('market');
    return parts.join(' | ');
  }

  function buildSummaryCopy(item, context) {
    if (context === 'retrodex') {
      return item.meta?.tagline || item.meta?.summary || item.meta?.synopsis || '';
    }

    if (context === 'retromarket') {
      if (item.meta?.loosePrice != null) {
        const rarity = item.meta?.rarity ? `Raret\u00e9 ${item.meta.rarity}` : 'Signal marche';
        return `${rarity} | ${fmtPrice(item.meta.loosePrice) || 'n/a'} loose | lecture immediate du potentiel collector.`;
      }
      return '';
    }

    return item.meta?.tagline || item.meta?.summary || item.meta?.synopsis || '';
  }

  function buildActionLabel(item) {
    if (item.type === 'franchise') return 'Voir franchise ->';
    if (item.type === 'console') return 'Voir console ->';
    return 'Voir fiche ->';
  }

  function renderSignals(item, context) {
    const grid = document.createElement('div');
    grid.className = 'sc-signal-grid';

    if (item.type === 'game' && (context === 'retromarket' || context === 'all') && item.meta?.loosePrice != null) {
      grid.appendChild(createSignalCard('Loose', fmtPrice(item.meta.loosePrice) || 'n/a'));
    }

    if (item.meta?.metascore) {
      const scoreCard = document.createElement('div');
      scoreCard.className = 'surface-signal-card';

      const scoreLabel = document.createElement('span');
      scoreLabel.className = 'surface-signal-label';
      scoreLabel.textContent = 'Metascore';

      const scoreValue = document.createElement('div');
      scoreValue.className = 'surface-signal-value';
      const badge = createMetascoreBadge(item.meta.metascore);
      if (badge) {
        scoreValue.appendChild(badge);
      } else {
        scoreValue.textContent = String(item.meta.metascore);
      }

      scoreCard.appendChild(scoreLabel);
      scoreCard.appendChild(scoreValue);
      grid.appendChild(scoreCard);
    }

    if (item.meta?.rarity) {
      grid.appendChild(createSignalCard('Rarete', item.meta.rarity));
    } else {
      grid.appendChild(createSignalCard('Type', String(item.type || '').toUpperCase()));
    }

    if (!grid.children.length) {
      grid.appendChild(createSignalCard('Type', String(item.type || '').toUpperCase()));
    }

    return grid;
  }

  function renderEmpty(message) {
    resultsEl.innerHTML = `
      <div class="terminal-empty-state search-empty">
        <div class="terminal-empty-title">Recherche inline</div>
        <div class="terminal-empty-copy">${message}</div>
      </div>
    `;
  }

  function renderState(title, copy, tone = '') {
    resultsEl.innerHTML = `
      <div class="terminal-empty-state search-empty${tone ? ` ${tone}` : ''}">
        <div class="terminal-empty-title">${title}</div>
        <div class="terminal-empty-copy">${copy}</div>
      </div>
    `;
  }

  function renderResults(results, context) {
    if (!results.length) {
      renderEmpty('Aucun resultat.');
      if (countEl) countEl.textContent = '0 resultat';
      return;
    }

    const contextLabel = window.RetroDexSearch?.CTX?.[context]?.label || context.toUpperCase();
    if (countEl) {
      countEl.textContent = `${results.length} resultat(s) | ${contextLabel}`;
    }

    resultsEl.innerHTML = '';
    results.forEach((item) => {
      const row = document.createElement('a');
      row.className = 'sc-row';
      row.href = item.href;

      if (window.RetroDexAssets && item.meta?.console) {
        row.appendChild(window.RetroDexAssets.createSupportImg(item.meta.console, 16));
      }

      const main = document.createElement('div');
      main.className = 'sc-main';

      const identity = document.createElement('div');
      identity.className = 'sc-identity';

      const title = document.createElement('span');
      title.className = 'sc-title';
      title.textContent = item.title;

      const subtitle = document.createElement('span');
      subtitle.className = 'sc-sub';
      subtitle.textContent = item.subtitle || '';

      identity.appendChild(title);
      identity.appendChild(subtitle);
      main.appendChild(identity);

      const secondaryCopy = buildSecondaryCopy(item);
      if (secondaryCopy) {
        const secondary = document.createElement('span');
        secondary.className = 'sc-secondary';
        secondary.textContent = secondaryCopy;
        main.appendChild(secondary);
      }

      const summaryCopy = buildSummaryCopy(item, context);
      if (summaryCopy) {
        const summary = document.createElement('span');
        summary.className = 'sc-summary';
        summary.textContent = summaryCopy;
        main.appendChild(summary);
      }

      const chipRow = document.createElement('div');
      chipRow.className = 'sc-chip-row';

      if (item.type === 'game' && item.meta?.console) {
        chipRow.appendChild(createChip(item.meta.console, 'is-primary'));
      } else {
        chipRow.appendChild(createChip(String(item.type || 'entry').toUpperCase(), 'is-primary'));
      }

      if (item.meta?.year) {
        chipRow.appendChild(createChip(String(item.meta.year)));
      }

      if (item.meta?.rarity) {
        chipRow.appendChild(createChip(item.meta.rarity, 'is-hot'));
      }

      if (item.meta?.metascore) {
        chipRow.appendChild(createChip(`MS ${item.meta.metascore}`));
      }

      main.appendChild(chipRow);

      row.appendChild(main);
      row.appendChild(renderSignals(item, context));

      const action = document.createElement('span');
      action.className = 'sc-action';
      action.textContent = buildActionLabel(item);
      row.appendChild(action);

      resultsEl.appendChild(row);
    });
  }

  async function doSearch(query, context) {
    if (!window.RetroDexSearch) {
      renderState('Chargement', 'Le moteur de recherche est en cours d initialisation.');
      window.setTimeout(() => doSearch(query, context), 400);
      return;
    }

    if (countEl) {
      countEl.textContent = 'Recherche...';
    }

    try {
      const results = await window.RetroDexSearch.search(query, {}, context, 30);
      renderResults(results, context);
      syncUrl(query, context);
    } catch (error) {
      renderState('Recherche indisponible', `Erreur : ${error.message}`, 'is-error');
    }
  }

  function setActiveTab(context) {
    tabEls.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.ctx === context);
    });
  }

  function showIdleState() {
    const contextLabel = window.RetroDexSearch?.CTX?.[currentContext]?.label || currentContext.toUpperCase();
    if (countEl) {
      countEl.textContent = contextLabel === 'TOUS'
        ? ''
        : `Contexte actif | ${contextLabel}`;
    }
    renderEmpty('Saisissez un titre, une console ou une franchise.');
    syncUrl('', currentContext);
  }

  tabEls.forEach((tab) => {
    tab.addEventListener('click', () => {
      currentContext = tab.dataset.ctx || 'all';
      setActiveTab(currentContext);

      if (currentQuery) doSearch(currentQuery, currentContext);
      else showIdleState();
    });
  });

  inputEl.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      currentQuery = inputEl.value.trim();
      if (currentQuery.length >= 2) doSearch(currentQuery, currentContext);
      else if (!currentQuery) showIdleState();
    }, 200);
  });

  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      inputEl.value = '';
      currentQuery = '';
      showIdleState();
    }
  });

  const routerResults = document.getElementById('search-router-results');
  if (routerResults) routerResults.hidden = true;

  const legacyFooter = document.querySelector('.terminal-footer');
  if (legacyFooter) legacyFooter.hidden = true;

  inputEl.value = currentQuery;
  setActiveTab(currentContext);
  window.RetroDexSearch?.preload?.();

  if (currentQuery.length >= 2) doSearch(currentQuery, currentContext);
  else showIdleState();
})();
