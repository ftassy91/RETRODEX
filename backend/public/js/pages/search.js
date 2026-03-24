'use strict';
/**
 * backend/public/js/pages/search.js
 * Remplace le routeur de redirection par un vrai moteur (via RetroDexSearch).
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

  function renderEmpty(message) {
    resultsEl.innerHTML = `<div style="color:#333;font-family:monospace;font-size:11px;padding:12px 0">${message}</div>`;
  }

  function renderResults(results, context) {
    if (!results.length) {
      renderEmpty('Aucun résultat.');
      if (countEl) countEl.textContent = '0 résultat';
      return;
    }

    const contextLabel = window.RetroDexSearch?.CTX?.[context]?.label || context.toUpperCase();
    if (countEl) {
      countEl.textContent = `${results.length} résultat(s) — ${contextLabel}`;
    }

    resultsEl.innerHTML = '';
    results.forEach((item) => {
      const row = document.createElement('a');
      row.className = 'sc-row';
      row.href = item.href;

      if (window.RetroDexAssets && item.meta?.console) {
        row.appendChild(window.RetroDexAssets.createSupportImg(item.meta.console, 16));
      }

      const title = document.createElement('span');
      title.className = 'sc-title';
      title.textContent = item.title;

      const subtitle = document.createElement('span');
      subtitle.className = 'sc-sub';
      subtitle.textContent = item.subtitle || '';

      const type = document.createElement('span');
      type.className = 'sc-type';
      type.textContent = String(item.type || '').toUpperCase();

      row.appendChild(title);
      row.appendChild(subtitle);
      row.appendChild(type);

      if (context === 'retromarket' || context === 'all') {
        const price = document.createElement('span');
        price.className = 'sc-price';
        price.textContent = fmtPrice(item.meta?.loosePrice);
        row.appendChild(price);
      }

      const metascoreBadge = createMetascoreBadge(item.meta?.metascore);
      if (metascoreBadge) {
        row.appendChild(metascoreBadge);
      }

      resultsEl.appendChild(row);
    });
  }

  async function doSearch(query, context) {
    if (!window.RetroDexSearch) {
      renderEmpty('Chargement du moteur...');
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
      resultsEl.innerHTML = `<div style="color:#cc0000;font-family:monospace;font-size:11px">Erreur : ${error.message}</div>`;
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
        : `Contexte actif — ${contextLabel}`;
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
