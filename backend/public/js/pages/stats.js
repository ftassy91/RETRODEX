'use strict'

const urlParams = new URLSearchParams(window.location.search)

const breadcrumbNameEl = document.getElementById('market-breadcrumb-name')
const searchInputEl = document.getElementById('market-search-input')
const searchCountEl = document.getElementById('market-search-count')
const heroSummaryEl = document.getElementById('market-hero-summary')
const searchHeaderEl = document.getElementById('market-search-header')
const searchResultsEl = document.getElementById('market-search-results')
const graphShellEl = document.getElementById('market-graph-shell')
const graphContentEl = document.getElementById('market-graph-content')
const compareShellEl = document.getElementById('market-compare-shell')
const compareContentEl = document.getElementById('market-compare-content')
const marketShellEl = document.getElementById('market-market-shell')
const marketContentEl = document.getElementById('market-market-content')
const buyShellEl = document.getElementById('market-buy-shell')
const buyContentEl = document.getElementById('market-buy-content')
const tradeShellEl = document.getElementById('market-trade-shell')
const tradeContentEl = document.getElementById('market-trade-content')

const state = {
  query: urlParams.get('q') || '',
  results: [],
  currentGame: null,
  currentSummary: null,
  currentSales: [],
  currentListings: [],
  compareQuery: '',
  compareResults: [],
  compareGame: null,
  compareSummary: null,
}

let searchTimer = null
let compareTimer = null
let selectionToken = 0
let compareToken = 0

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatCurrency(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) {
    return '&mdash;'
  }
  return `$${number.toFixed(2).replace(/\\.00$/, '')}`
}

function formatDate(value) {
  if (!value) return 'n/a'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return escapeHtml(value)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${date.getFullYear()}`
}

function formatRelease(game) {
  if (game.releaseDate) {
    return formatDate(game.releaseDate)
  }
  return escapeHtml(game.year || 'n/a')
}

function fetchJson(url, options = undefined) {
  return fetch(url, options).then((response) => {
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`)
    }
    return response.json()
  })
}

function metascoreMarkup(score, variant = 'micro') {
  if (window.RetroDexMetascore?.renderBadge && score != null) {
    return window.RetroDexMetascore.renderBadge(score, variant).outerHTML
  }
  const value = Number(score)
  return `<span class="market-meta-fallback">${Number.isFinite(value) ? Math.round(value) : '&mdash;'}</span>`
}

function getConditionSummary(summary, condition) {
  if (!summary || !Array.isArray(summary.byCondition)) return null
  return summary.byCondition.find((item) => item.condition === condition) || null
}

function averagePrice(rows) {
  const values = rows
    .map((row) => Number(row.price))
    .filter((value) => Number.isFinite(value) && value > 0)
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function buildTrendState(sales = []) {
  const ranked = sales
    .filter((row) => Number.isFinite(Number(row.price)))
    .sort((left, right) => new Date(left.sale_date) - new Date(right.sale_date))

  const looseRows = ranked.filter((row) => String(row.condition || '').toLowerCase() === 'loose')
  const sample = looseRows.length >= 4 ? looseRows : ranked

  if (sample.length < 4) {
    return { symbol: '•', label: 'Stable', className: 'is-stable', deltaText: 'signal limite' }
  }

  const segmentSize = Math.max(2, Math.floor(sample.length / 3))
  const firstAvg = averagePrice(sample.slice(0, segmentSize))
  const lastAvg = averagePrice(sample.slice(-segmentSize))

  if (!firstAvg || !lastAvg) {
    return { symbol: '•', label: 'Stable', className: 'is-stable', deltaText: 'signal limite' }
  }

  const delta = (lastAvg - firstAvg) / firstAvg
  if (delta >= 0.12) {
    return { symbol: '↗', label: 'Hausse', className: 'is-up', deltaText: `+${Math.round(delta * 100)}%` }
  }
  if (delta <= -0.08) {
    return { symbol: '↘', label: 'Repli', className: 'is-down', deltaText: `${Math.round(delta * 100)}%` }
  }
  return { symbol: '•', label: 'Stable', className: 'is-stable', deltaText: `${Math.round(delta * 100)}%` }
}

function normalizeGame(game) {
  return {
    ...game,
    loosePrice: game.loosePrice ?? game.loose_price ?? 0,
    cibPrice: game.cibPrice ?? game.cib_price ?? 0,
    mintPrice: game.mintPrice ?? game.mint_price ?? 0,
    coverImage: game.coverImage || game.cover_url || null,
  }
}

function buildMarketContentSignals(game) {
  if (!window.RetroDexContentSignals?.buildRichness || !game) return null

  return window.RetroDexContentSignals.buildRichness(game, {
    archive: {
      avg_duration_main: game.avg_duration_main,
      avg_duration_complete: game.avg_duration_complete,
      manual_url: game.manual_url,
      dev_anecdotes: game.dev_anecdotes,
      cheat_codes: game.cheat_codes,
      versions: game.versions,
      ost: { notable_tracks: game.ost_notable_tracks },
    },
    encyclopedia: {
      dev_team: game.dev_team,
      dev_anecdotes: game.dev_anecdotes,
      cheat_codes: game.cheat_codes,
    },
  })
}

function renderMarketSignalChips(signals) {
  if (!signals) return ''

  return `
    <div class="surface-chip-row market-signal-chip-row">
      <span class="surface-chip is-primary">${escapeHtml(signals.band.shortLabel)}</span>
      <span class="surface-chip">${escapeHtml(signals.completionState.shortLabel)}</span>
      <span class="surface-chip">${escapeHtml(signals.confidence.shortLabel)}</span>
    </div>
  `
}

function updateUrl() {
  const params = new URLSearchParams(window.location.search)
  const query = String(state.query || '').trim()
  if (query) params.set('q', query)
  else params.delete('q')
  const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
  window.history.replaceState({}, '', next)
}

function setSecondaryShellVisibility(visible) {
  ;[graphShellEl, compareShellEl, marketShellEl, buyShellEl, tradeShellEl].forEach((shell) => {
    if (shell) shell.hidden = !visible
  })
}

function renderSearchResults() {
  if (!searchResultsEl || !searchHeaderEl || !searchCountEl) return

  if (state.query.length < 2) {
    searchHeaderEl.hidden = true
    searchCountEl.textContent = ''
    searchResultsEl.innerHTML = ''
    return
  }

  if (!state.results.length) {
    searchHeaderEl.hidden = true
    searchCountEl.textContent = '0 resultat'
    searchResultsEl.innerHTML = `
      <div class="terminal-empty-state search-empty">
        <div class="terminal-empty-title">Recherche</div>
        <div class="terminal-empty-copy">Aucun jeu trouve.</div>
      </div>
    `
    return
  }

  searchHeaderEl.hidden = false
  searchCountEl.textContent = `${state.results.length} resultat(s)`
  searchResultsEl.innerHTML = state.results.map((game) => {
    const isSelected = state.currentGame?.id === game.id
    const contentSignals = buildMarketContentSignals(game)
    return `
      <button type="button" class="market-search-row${isSelected ? ' is-selected' : ''}" data-game-id="${escapeHtml(game.id)}">
        <span class="market-result-main">
          <span class="market-result-title">${escapeHtml(game.title)}</span>
          <span class="market-result-meta">${escapeHtml(game.console || 'n/a')}</span>
          ${renderMarketSignalChips(contentSignals)}
          <a href="/game-detail.html?id=${encodeURIComponent(game.id)}" class="terminal-action-link market-result-link" onclick="event.stopPropagation()">Voir fiche -></a>
        </span>
        <span class="market-result-year">${escapeHtml(game.year || 'n/a')}</span>
        <span class="market-result-price is-alert">${formatCurrency(game.loosePrice || 0)}</span>
        <span class="market-result-price">${formatCurrency(game.cibPrice || 0)}</span>
        <span class="market-result-price">${formatCurrency(game.mintPrice || 0)}</span>
        <span class="market-result-score">${metascoreMarkup(game.metascore, 'micro')}</span>
      </button>
    `
  }).join('')

  searchResultsEl.querySelectorAll('[data-game-id]').forEach((button) => {
    button.addEventListener('click', () => {
      selectGame(button.dataset.gameId)
    })
  })
}

function renderHeroSummary() {
  if (!heroSummaryEl || !breadcrumbNameEl) return

  if (!state.currentGame) {
    breadcrumbNameEl.textContent = 'MARCHE'
    heroSummaryEl.innerHTML = `
      <div class="market-empty-card">
        <div class="market-empty-title">RetroMarket</div>
        <div class="market-empty-copy">Prix, tendance, comparaison.</div>
      </div>
    `
    return
  }

  const game = state.currentGame
  const publisher = game.publisher || game.publisherName || game.developer || 'n/a'
  const developer = game.developer || 'n/a'
  const trend = buildTrendState(state.currentSales)
  const trendSymbol = trend.className === 'is-up' ? 'UP' : trend.className === 'is-down' ? 'DOWN' : 'FLAT'
  const contentSignals = buildMarketContentSignals(game)
  const cover = game.coverImage
    ? `<img src="${escapeHtml(game.coverImage)}" alt="" class="market-cover" width="144" height="144" />`
    : `<span class="market-cover-placeholder">${escapeHtml(String(game.title || '?').slice(0, 2).toUpperCase())}</span>`

  breadcrumbNameEl.textContent = game.title || 'MARCHE'
  heroSummaryEl.innerHTML = `
    <div class="market-hero-layout">
      <div class="detail-cover-slot market-cover-slot">${cover}</div>
      <div class="market-hero-copy">
        <h1 class="detail-title market-hero-title">${escapeHtml(game.title || 'RetroMarket')}</h1>
        <p class="market-panel-copy market-hero-copy-note">
          Couche de qualification : prix, tendance et confiance de surface, en support de la fiche RetroDex.
        </p>
        <div class="detail-hero-chips market-hero-chips" id="market-hero-chips">
          <span class="chip chip--console">${escapeHtml(game.console || 'n/a')}</span>
          <span class="chip">Sortie ${formatRelease(game)}</span>
          <span class="chip">Editeur ${escapeHtml(publisher)}</span>
          <span class="chip">Dev ${escapeHtml(developer)}</span>
        </div>
        ${renderMarketSignalChips(contentSignals)}
        ${contentSignals ? `<div class="market-reading-note">${escapeHtml(contentSignals.band.note)}</div>` : ''}
        <div class="terminal-summary-bar market-price-summary">
          <div class="terminal-summary-cell">
            <div class="terminal-summary-label">Loose</div>
            <div class="terminal-summary-value is-alert">${formatCurrency(game.loosePrice || 0)}</div>
          </div>
          <div class="terminal-summary-cell">
            <div class="terminal-summary-label">CIB</div>
            <div class="terminal-summary-value">${formatCurrency(game.cibPrice || 0)}</div>
          </div>
          <div class="terminal-summary-cell">
            <div class="terminal-summary-label">Mint</div>
            <div class="terminal-summary-value">${formatCurrency(game.mintPrice || 0)}</div>
          </div>
            <div class="terminal-summary-cell">
              <div class="terminal-summary-label">Tendance</div>
              <div class="terminal-summary-value">
                <span class="market-trend-badge ${trend.className}">
                  <span class="market-trend-symbol">${trendSymbol}</span>
                  <span>${escapeHtml(trend.label)}</span>
                  <span class="market-trend-delta">${escapeHtml(trend.deltaText)}</span>
                </span>
            </div>
          </div>
        </div>
        <div class="surface-action-row market-hero-actions">
          <a class="terminal-action-link" href="/game-detail.html?id=${encodeURIComponent(game.id)}">Voir fiche -></a>
        </div>
      </div>
    </div>
  `

  const heroChipsEl = document.getElementById('market-hero-chips')
  if (heroChipsEl) {
    const scoreWrap = document.createElement('span')
    scoreWrap.className = 'chip market-score-chip'
    scoreWrap.innerHTML = metascoreMarkup(game.metascore, 'micro')
    heroChipsEl.appendChild(scoreWrap)
  }
}

function renderGraphContent() {
  if (!graphContentEl || !state.currentGame) return

  const sales = state.currentSales
    .filter((row) => Number.isFinite(Number(row.price)))
    .sort((left, right) => new Date(right.sale_date) - new Date(left.sale_date))
    .slice(0, 12)
  const summary = state.currentSummary || { totalSales: 0, lastSale: null }

  if (!sales.length) {
    graphContentEl.innerHTML = '<div class="market-empty-copy">Aucune observation exploitable.</div>'
    return
  }

  const maxPrice = Math.max(...sales.map((row) => Number(row.price) || 0), 1)
  graphContentEl.innerHTML = `
    <div class="terminal-summary-bar detail-stats-bar">
      <div class="terminal-summary-cell">
        <div class="terminal-summary-label">Ventes 24M</div>
        <div class="terminal-summary-value">${escapeHtml(summary.totalSales || sales.length)}</div>
      </div>
      <div class="terminal-summary-cell">
        <div class="terminal-summary-label">Derniere obs.</div>
        <div class="terminal-summary-value">${formatDate(summary.lastSale)}</div>
      </div>
      <div class="terminal-summary-cell">
        <div class="terminal-summary-label">Plage</div>
        <div class="terminal-summary-value">${formatCurrency(summary.minPrice)} / ${formatCurrency(summary.maxPrice)}</div>
      </div>
    </div>
    <div class="market-graph-list">
      ${sales.map((row) => `
        <div class="market-graph-row">
          <span class="market-graph-date">${formatDate(row.sale_date)}</span>
          <span class="market-graph-condition">${escapeHtml(String(row.condition || 'loose').toUpperCase())}</span>
          <span class="market-graph-bar"><span class="market-graph-fill" style="width:${Math.max(8, Math.round((Number(row.price) / maxPrice) * 100))}%"></span></span>
          <span class="market-graph-price">${formatCurrency(row.price)}</span>
        </div>
      `).join('')}
    </div>
  `
}

function renderMarketContent() {
  if (!marketContentEl || !state.currentGame) return

  const summary = state.currentSummary || { byCondition: [] }
  const confidence = Number(state.currentGame.source_confidence || 0)
  const rows = ['loose', 'cib', 'mint'].map((condition) => {
    const data = getConditionSummary(summary, condition)
    return `
      <div class="market-condition-row">
        <span>${escapeHtml(condition.toUpperCase())}</span>
        <span>${escapeHtml(data?.count || 0)}</span>
        <span>${formatCurrency(data?.median)}</span>
        <span>${formatCurrency(data?.min)}</span>
        <span>${formatCurrency(data?.max)}</span>
      </div>
    `
  }).join('')

  marketContentEl.innerHTML = `
    <div class="terminal-summary-bar detail-stats-bar">
      <div class="terminal-summary-cell">
        <div class="terminal-summary-label">Ventes 24M</div>
        <div class="terminal-summary-value">${escapeHtml(summary.totalSales || 0)}</div>
      </div>
      <div class="terminal-summary-cell">
        <div class="terminal-summary-label">Derniere obs.</div>
        <div class="terminal-summary-value">${formatDate(summary.lastSale)}</div>
      </div>
      <div class="terminal-summary-cell">
        <div class="terminal-summary-label">Min</div>
        <div class="terminal-summary-value">${formatCurrency(summary.minPrice)}</div>
      </div>
      <div class="terminal-summary-cell">
        <div class="terminal-summary-label">Max</div>
        <div class="terminal-summary-value">${formatCurrency(summary.maxPrice)}</div>
      </div>
      <div class="terminal-summary-cell">
        <div class="terminal-summary-label">Confiance</div>
        <div class="terminal-summary-value">${Number.isFinite(confidence) && confidence > 0 ? `${Math.round(confidence * 100)}%` : 'n/a'}</div>
      </div>
    </div>
    <div class="market-condition-table">
      <div class="market-condition-row market-condition-header">
        <span>Etat</span>
        <span>Ventes</span>
        <span>Median</span>
        <span>Min</span>
        <span>Max</span>
      </div>
      ${rows}
    </div>
  `
}

function renderBuyContent() {
  if (!buyContentEl || !state.currentGame) return

  if (!state.currentListings.length) {
    buyContentEl.innerHTML = '<div class="market-empty-copy">Aucune annonce active.</div>'
    return
  }

  buyContentEl.innerHTML = `
    <div class="market-buy-list">
      ${state.currentListings.map((listing) => `
        <div class="market-buy-row">
          <span class="market-buy-condition">${escapeHtml(listing.condition || 'n/a')}</span>
          <span class="market-buy-price">${formatCurrency(listing.price)}</span>
          <span class="market-buy-currency">${escapeHtml(listing.currency || 'USD')}</span>
          <span class="market-buy-status">${escapeHtml(String(listing.status || 'active').toUpperCase())}</span>
        </div>
      `).join('')}
    </div>
  `
}

function renderTradeContent() {
  if (!tradeContentEl || !state.currentGame) return
  tradeContentEl.innerHTML = '<div class="market-empty-copy">Structure prete. Echanges a brancher.</div>'
}

function renderCompareCards() {
  if (!state.currentGame || !state.compareGame || !state.compareSummary) {
    return ''
  }

  const left = state.currentGame
  const right = state.compareGame
  const leftSummary = state.currentSummary || {}
  const rightSummary = state.compareSummary || {}
  const rows = [
    ['Sortie', formatRelease(left), formatRelease(right)],
    ['Metascore', left.metascore || 'n/a', right.metascore || 'n/a'],
    ['Loose', formatCurrency(left.loosePrice), formatCurrency(right.loosePrice)],
    ['CIB', formatCurrency(left.cibPrice), formatCurrency(right.cibPrice)],
    ['Mint', formatCurrency(left.mintPrice), formatCurrency(right.mintPrice)],
    ['Ventes 24M', leftSummary.totalSales || 0, rightSummary.totalSales || 0],
  ]

  return `
    <div class="market-compare-grid">
      <article class="market-compare-card">
        <div class="market-compare-card-title">${escapeHtml(left.title)}</div>
        <div class="market-compare-card-meta">${escapeHtml(left.console || 'n/a')} | ${escapeHtml(left.year || 'n/a')}</div>
      </article>
      <article class="market-compare-card">
        <div class="market-compare-card-title">${escapeHtml(right.title)}</div>
        <div class="market-compare-card-meta">${escapeHtml(right.console || 'n/a')} | ${escapeHtml(right.year || 'n/a')}</div>
      </article>
    </div>
    <div class="market-compare-table">
      <div class="market-compare-row market-compare-header">
        <span>Signal</span>
        <span>${escapeHtml(left.title)}</span>
        <span>${escapeHtml(right.title)}</span>
      </div>
      ${rows.map(([label, leftValue, rightValue]) => `
        <div class="market-compare-row">
          <span>${escapeHtml(label)}</span>
          <span>${escapeHtml(leftValue)}</span>
          <span>${escapeHtml(rightValue)}</span>
        </div>
      `).join('')}
    </div>
  `
}

function renderCompareContent() {
  if (!compareContentEl || !state.currentGame) return

  compareContentEl.innerHTML = `
    <div class="terminal-query-line market-search-shell market-compare-search">
      <span class="terminal-query-label">COMPARE :</span>
      <input
        type="text"
        id="market-compare-input"
        class="terminal-query-input"
        value="${escapeHtml(state.compareQuery)}"
        placeholder="second jeu"
        autocomplete="off"
      />
      <span class="terminal-query-count" id="market-compare-count">${state.compareResults.length ? `${state.compareResults.length} resultat(s)` : ''}</span>
    </div>
    <div id="market-compare-results" class="market-compare-results">
      ${state.compareQuery.length >= 2 && !state.compareResults.length
        ? '<div class="market-empty-copy">Aucun jeu de comparaison.</div>'
        : state.compareResults.map((game) => `
          <button type="button" class="market-compare-result" data-compare-id="${escapeHtml(game.id)}">
            <span>${escapeHtml(game.title)}</span>
            <span>${escapeHtml(game.console || 'n/a')} | ${escapeHtml(game.year || 'n/a')}</span>
          </button>
        `).join('')}
    </div>
    ${renderCompareCards()}
  `

  const compareInputEl = document.getElementById('market-compare-input')
  const compareResultsEl = document.getElementById('market-compare-results')
  if (compareInputEl) {
    compareInputEl.addEventListener('input', () => {
      window.clearTimeout(compareTimer)
      state.compareQuery = compareInputEl.value.trim()
      compareTimer = window.setTimeout(() => searchCompareGames(state.compareQuery), 200)
    })
  }
  if (compareResultsEl) {
    compareResultsEl.querySelectorAll('[data-compare-id]').forEach((button) => {
      button.addEventListener('click', () => {
        selectCompareGame(button.dataset.compareId)
      })
    })
  }
}

function renderAll() {
  renderHeroSummary()
  renderSearchResults()

  const hasGame = Boolean(state.currentGame)
  setSecondaryShellVisibility(hasGame)
  if (!hasGame) {
    if (graphContentEl) graphContentEl.innerHTML = ''
    if (compareContentEl) compareContentEl.innerHTML = ''
    if (marketContentEl) marketContentEl.innerHTML = ''
    if (buyContentEl) buyContentEl.innerHTML = ''
    if (tradeContentEl) tradeContentEl.innerHTML = ''
    return
  }

  renderGraphContent()
  renderCompareContent()
  renderMarketContent()
  renderBuyContent()
  renderTradeContent()
}

function setAccordionExpanded(section, expanded) {
  if (!section) return

  const button = section.querySelector('.detail-accordion-toggle')
  const content = section.querySelector('.detail-accordion-content')
  if (!button || !content) return

  button.setAttribute('aria-expanded', String(expanded))
  const indicator = button.querySelector('.detail-accordion-indicator')
  if (indicator) {
    indicator.textContent = expanded ? '-' : '+'
  }
  content.hidden = !expanded
}

async function searchGames(query, { autoSelectFirst = false } = {}) {
  state.query = String(query || '').trim()
  updateUrl()

  if (state.query.length < 2) {
    state.results = []
    renderAll()
    return
  }

  if (searchCountEl) {
    searchCountEl.textContent = 'Recherche...'
  }

  try {
    const payload = await fetchJson(`/api/games?q=${encodeURIComponent(state.query)}&limit=12`)
    state.results = (payload.items || []).map(normalizeGame)
    renderAll()
    if (autoSelectFirst && state.results.length) {
      await selectGame(state.results[0].id)
    }
  } catch (error) {
    state.results = []
    if (searchHeaderEl) searchHeaderEl.hidden = true
    if (searchCountEl) searchCountEl.textContent = 'Erreur'
    if (searchResultsEl) {
      searchResultsEl.innerHTML = `
        <div class="terminal-empty-state search-empty">
          <div class="terminal-empty-title">Recherche</div>
          <div class="terminal-empty-copy">${escapeHtml(error.message)}</div>
        </div>
      `
    }
  }
}

async function selectGame(gameId) {
  const token = ++selectionToken

  const [gameResult, summaryResult, salesResult] = await Promise.allSettled([
    fetchJson(`/api/games/${encodeURIComponent(gameId)}`),
    fetchJson(`/api/prices/${encodeURIComponent(gameId)}/summary?months=24`),
    fetchJson(`/api/prices/${encodeURIComponent(gameId)}?limit=24`),
  ])

  if (token !== selectionToken) {
    return
  }

  if (gameResult.status !== 'fulfilled') {
    if (heroSummaryEl) {
      heroSummaryEl.innerHTML = '<div class="market-empty-card">Chargement indisponible.</div>'
    }
    return
  }

  state.currentGame = normalizeGame(gameResult.value)
  state.query = state.currentGame.title || state.query
  if (searchInputEl) {
    searchInputEl.value = state.query
  }
  state.currentSummary = summaryResult.status === 'fulfilled'
    ? summaryResult.value
    : { totalSales: 0, lastSale: null, minPrice: null, maxPrice: null, byCondition: [] }
  state.currentSales = salesResult.status === 'fulfilled'
    ? (salesResult.value.sales || [])
    : []
  state.currentListings = []
  state.compareQuery = ''
  state.compareResults = []
  state.compareGame = null
  state.compareSummary = null
  updateUrl()
  renderAll()
  setAccordionExpanded(graphShellEl, true)
  setAccordionExpanded(marketShellEl, true)
  setAccordionExpanded(compareShellEl, false)
  setAccordionExpanded(buyShellEl, false)
  setAccordionExpanded(tradeShellEl, false)
}

async function searchCompareGames(query) {
  state.compareQuery = String(query || '').trim()
  if (state.compareQuery.length < 2) {
    state.compareResults = []
    state.compareGame = null
    state.compareSummary = null
    renderCompareContent()
    return
  }

  try {
    const payload = await fetchJson(`/api/games?q=${encodeURIComponent(state.compareQuery)}&limit=8`)
    state.compareResults = (payload.items || [])
      .map(normalizeGame)
      .filter((game) => game.id !== state.currentGame?.id)
    renderCompareContent()
  } catch (_error) {
    state.compareResults = []
    renderCompareContent()
  }
}

async function selectCompareGame(gameId) {
  const token = ++compareToken
  const [gameResult, summaryResult] = await Promise.allSettled([
    fetchJson(`/api/games/${encodeURIComponent(gameId)}`),
    fetchJson(`/api/prices/${encodeURIComponent(gameId)}/summary?months=24`),
  ])

  if (token !== compareToken || gameResult.status !== 'fulfilled') {
    return
  }

  state.compareGame = normalizeGame(gameResult.value)
  state.compareSummary = summaryResult.status === 'fulfilled'
    ? summaryResult.value
    : { totalSales: 0, byCondition: [] }
  state.compareQuery = state.compareGame.title || state.compareQuery
  state.compareResults = []
  renderCompareContent()
}

function initAccordions() {
  document.querySelectorAll('.detail-accordion').forEach((section) => {
    const button = section.querySelector('.detail-accordion-toggle')
    const content = section.querySelector('.detail-accordion-content')
    if (!button || !content || button.dataset.bound === 'true') {
      return
    }

    button.dataset.bound = 'true'
    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') === 'true'
      button.setAttribute('aria-expanded', String(!expanded))
      const indicator = button.querySelector('.detail-accordion-indicator')
      if (indicator) {
        indicator.textContent = expanded ? '+' : '−'
      }
      content.hidden = expanded
    })
  })
}

function bindSearchInput() {
  if (!searchInputEl) return

  searchInputEl.value = state.query
  searchInputEl.addEventListener('input', () => {
    window.clearTimeout(searchTimer)
    const nextQuery = searchInputEl.value.trim()
    searchTimer = window.setTimeout(() => searchGames(nextQuery), 200)
  })
}

async function boot() {
  initAccordions()
  bindSearchInput()
  renderAll()

  if (state.query.length >= 2) {
    await searchGames(state.query, { autoSelectFirst: true })
  }
}

boot().catch((error) => {
  console.error('[RetroMarket]', error)
  if (heroSummaryEl) {
    heroSummaryEl.innerHTML = `<div class="market-empty-card">${escapeHtml(error.message)}</div>`
  }
})
