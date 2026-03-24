'use strict'

const queryEl = document.getElementById('query')
const consoleEl = document.getElementById('console')
const rarityEl = document.getElementById('rarity')
const limitEl = document.getElementById('limit')
const genreEl = document.getElementById('genre')
const trendEl = document.getElementById('filter-trend')
const yearMinEl = document.getElementById('year-min')
const yearMaxEl = document.getElementById('year-max')
const sortEl = document.getElementById('sort-by')
const searchButtonEl = document.getElementById('search-button')
const resetFiltersEl = document.getElementById('reset-filters')
const resultsSummaryEl = document.getElementById('results-summary')
const loadingIndicatorEl = document.getElementById('loading-indicator')
const resultsEl = document.getElementById('results')
const pageNumbersEl = document.getElementById('page-numbers')
const pageIndicatorEl = document.getElementById('page-indicator')
const prevButtonEl = document.getElementById('prev-button')
const nextButtonEl = document.getElementById('next-button')
const subtitleEl = document.getElementById('catalog-subtitle')
const advancedFiltersEl = document.getElementById('advanced-filters')
const toggleAdvancedEl = document.getElementById('toggle-advanced')
const filtersMobileToggleEl = document.getElementById('filters-mobile-toggle')
const filtersSidebarContentEl = document.getElementById('filters-sidebar-content')
const quickDetailEl = document.getElementById('quick-detail')
const metascoreSortButtonEl = document.getElementById('sort-metascore-desc')
const CoreApi = window.RetroDexApi || {}

let debounceTimer
let currentOffset = 0
let totalGames = 507
let masterGames = []
let fetchedGames = []
let filteredGames = []
let selectedGameId = ''
let collectionIndex = null

const RARITY_DESC_ORDER = {
  LEGENDARY: 0,
  EPIC: 1,
  RARE: 2,
  UNCOMMON: 3,
  COMMON: 4,
}

const RARITY_ASC_ORDER = {
  COMMON: 0,
  UNCOMMON: 1,
  RARE: 2,
  EPIC: 3,
  LEGENDARY: 4,
}

const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const num = (value) => Number(value) || 0
const textCmp = (left, right) => String(left || '').localeCompare(String(right || ''), 'fr', { sensitivity: 'base' })

function normalizeSortKey(value) {
  const sortKey = String(value || '').trim()
  if (sortKey === 'meta_asc') return 'metascore_asc'
  if (sortKey === 'meta_desc') return 'metascore_desc'
  return sortKey || 'rarity_desc'
}

function yearVal(value) {
  const year = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(year) ? Math.max(1970, Math.min(2012, year)) : ''
}

function toggleAdvanced(forceOpen) {
  const open = typeof forceOpen === 'boolean'
    ? forceOpen
    : advancedFiltersEl.hidden

  advancedFiltersEl.hidden = !open
  toggleAdvancedEl.textContent = open ? '- Filtres avances' : '+ Filtres avances'
}

function toggleFiltersPanel(forceOpen) {
  const open = typeof forceOpen === 'boolean'
    ? forceOpen
    : !filtersSidebarContentEl.classList.contains('is-open')

  filtersSidebarContentEl.classList.toggle('is-open', open)
  filtersMobileToggleEl.setAttribute('aria-expanded', String(open))
  filtersMobileToggleEl.textContent = open ? '- FILTRES' : '+ FILTRES'
}

function goToPage(page) {
  const limit = Number.parseInt(limitEl?.value || '20', 10) || 20
  currentOffset = Math.max(0, (page - 1) * limit)
  loadGames()
  window.scrollTo(0, 0)
}

function renderPageNumbers(currentPage, totalPages) {
  if (!pageNumbersEl) return

  if (totalPages <= 1) {
    pageNumbersEl.innerHTML = ''
    return
  }

  pageNumbersEl.innerHTML = ''
  let pages = []

  if (totalPages <= 7) {
    pages = Array.from({ length: totalPages }, (_, index) => index + 1)
  } else {
    pages = [1, 2]
    if (currentPage > 4) pages.push('...')
    for (let page = Math.max(3, currentPage - 1); page <= Math.min(totalPages - 2, currentPage + 1); page += 1) {
      pages.push(page)
    }
    if (currentPage < totalPages - 3) pages.push('...')
    pages.push(totalPages - 1, totalPages)
  }

  pages.forEach((page) => {
    if (page === '...') {
      const span = document.createElement('span')
      span.className = 'catalog-page-ellipsis'
      span.textContent = '...'
      pageNumbersEl.appendChild(span)
      return
    }

    const button = document.createElement('button')
    button.type = 'button'
    button.className = `catalog-page-btn${page === currentPage ? ' is-active' : ''}`
    button.textContent = String(page)
    button.addEventListener('click', () => goToPage(page))
    pageNumbersEl.appendChild(button)
  })
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }
  return response.json()
}

function readStateFromUrl() {
  const params = new URLSearchParams(location.search)
  queryEl.value = params.get('q') || ''
  consoleEl.dataset.pending = params.get('console') || ''
  rarityEl.value = params.get('rarity') || ''
  genreEl.dataset.pending = params.get('genre') || ''
  trendEl.value = params.get('trend') || ''
  limitEl.value = ['20', '50', '100'].includes(params.get('limit')) ? params.get('limit') : '20'
  sortEl.value = normalizeSortKey(params.get('sort') || 'rarity_desc')
  yearMinEl.value = yearVal(params.get('yearMin'))
  yearMaxEl.value = yearVal(params.get('yearMax'))
  selectedGameId = params.get('selected') || ''
  currentOffset = Math.max(0, Number.parseInt(params.get('offset') || '0', 10) || 0)
}

function state() {
  let yearMin = yearVal(yearMinEl.value)
  let yearMax = yearVal(yearMaxEl.value)

  if (yearMin && yearMax && yearMin > yearMax) {
    const swap = yearMin
    yearMin = yearMax
    yearMax = swap
  }

  return {
    q: queryEl.value.trim(),
    console: consoleEl.value,
    rarity: rarityEl.value,
    genre: genreEl.value,
    trend: trendEl.value,
    yearMin,
    yearMax,
    limit: Number.parseInt(limitEl.value, 10) || 20,
    sort: normalizeSortKey(sortEl.value || 'rarity_desc'),
    offset: currentOffset,
  }
}

function updateUrl(currentState) {
  const url = new URL(location.href)
  const entries = [
    ['q', currentState.q],
    ['console', currentState.console],
    ['rarity', currentState.rarity],
    ['genre', currentState.genre],
    ['trend', currentState.trend],
    ['yearMin', currentState.yearMin ? String(currentState.yearMin) : ''],
    ['yearMax', currentState.yearMax ? String(currentState.yearMax) : ''],
    ['limit', String(currentState.limit)],
    ['sort', currentState.sort],
    ['offset', String(currentState.offset)],
    ['selected', selectedGameId],
  ]

  entries.forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value)
    else url.searchParams.delete(key)
  })

  history.replaceState({}, '', url)
}

function sortGames(items, sortKey) {
  const normalizedSort = normalizeSortKey(sortKey)
  return [...items].sort((left, right) => {
    switch (normalizedSort) {
      case 'rarity_desc':
        return (RARITY_DESC_ORDER[String(left.rarity || '').toUpperCase()] ?? 5)
          - (RARITY_DESC_ORDER[String(right.rarity || '').toUpperCase()] ?? 5)
          || num(right.loosePrice) - num(left.loosePrice)
          || textCmp(left.title, right.title)
      case 'rarity_asc':
        return (RARITY_ASC_ORDER[String(left.rarity || '').toUpperCase()] ?? 5)
          - (RARITY_ASC_ORDER[String(right.rarity || '').toUpperCase()] ?? 5)
          || textCmp(left.title, right.title)
      case 'title_desc':
        return textCmp(right.title, left.title)
      case 'loose_asc':
        return num(left.loosePrice) - num(right.loosePrice) || textCmp(left.title, right.title)
      case 'loose_desc':
        return num(right.loosePrice) - num(left.loosePrice) || textCmp(left.title, right.title)
      case 'mint_asc':
        return num(left.mintPrice) - num(right.mintPrice) || textCmp(left.title, right.title)
      case 'mint_desc':
        return num(right.mintPrice) - num(left.mintPrice) || textCmp(left.title, right.title)
      case 'meta_asc':
      case 'metascore_asc':
        return num(left.metascore) - num(right.metascore) || textCmp(left.title, right.title)
      case 'meta_desc':
      case 'metascore_desc':
        return num(right.metascore) - num(left.metascore) || textCmp(left.title, right.title)
      case 'year_asc':
        return num(left.year) - num(right.year) || textCmp(left.title, right.title)
      case 'year_desc':
        return num(right.year) - num(left.year) || textCmp(left.title, right.title)
      default:
        return textCmp(left.title, right.title)
    }
  })
}

function detailUrl(gameId, currentState) {
  const params = new URLSearchParams()
  ;[
    ['q', currentState.q],
    ['console', currentState.console],
    ['rarity', currentState.rarity],
    ['genre', currentState.genre],
    ['trend', currentState.trend],
  ].forEach(([key, value]) => value && params.set(key, value))

  if (currentState.yearMin) params.set('yearMin', String(currentState.yearMin))
  if (currentState.yearMax) params.set('yearMax', String(currentState.yearMax))

  params.set('limit', String(currentState.limit))
  params.set('sort', currentState.sort)
  params.set('offset', String(currentState.offset))
  params.set('id', gameId)
  params.set('source', 'catalog')

  return `/game-detail.html?${params.toString()}`
}

function getCollectionState(gameId) {
  if (!collectionIndex || !gameId) {
    return null
  }

  if (collectionIndex.ownedIds?.has(gameId)) return 'owned'
  if (collectionIndex.wantedIds?.has(gameId)) return 'wanted'
  if (collectionIndex.forSaleIds?.has(gameId)) return 'for_sale'
  return null
}

function navigateTo(gameId) {
  window.location.href = detailUrl(gameId, state())
}

function quickDetailStateMarkup(title, copy) {
  return `
    <div class="terminal-empty-title">${esc(title)}</div>
    <div class="terminal-empty-copy">${esc(copy)}</div>
  `
}

function renderQuickDetailEmpty(message = 'Survoler ou selectionner un jeu') {
  quickDetailEl.className = 'quick-detail-placeholder terminal-empty-state'
  quickDetailEl.innerHTML = quickDetailStateMarkup('Preview catalogue', message)
}

function detailPrice(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) {
    return '<div class="price-value empty">$--</div>'
  }
  return `<div class="price-value">$${Math.round(amount)}</div>`
}

function shortSummary(game) {
  const text = String(game.summary || game.description || '').trim()
  if (!text) return ''
  return text.length > 220 ? `${esc(text.slice(0, 217))}...` : esc(text)
}

function quickDetailMarkup(game, currentState) {
  const description = shortSummary(game)
  const collectionState = getCollectionState(game.id)
  const detailHref = detailUrl(game.id, currentState)
  const visibleGenre = game.genre && game.genre !== 'Other' ? game.genre : ''
  return `
    <div class="detail-content">
      <div class="detail-title">${esc(game.title || 'Sans titre')}</div>
      <div class="detail-badges">
        <span class="badge-platform">${esc(game.console || 'Console inconnue')}</span>
        <span class="badge-year">${esc(game.year || 'n/a')}</span>
        <span class="result-badge rarity-badge rarity-${esc(String(game.rarity || 'common').toLowerCase())}">${esc(game.rarity || 'COMMON')}</span>
        ${collectionState === 'owned' ? '<span class="result-owned-badge">OWNED</span>' : ''}
      </div>
      <div class="surface-signal-grid">
        <div class="surface-signal-card">
          <span class="surface-signal-label">Loose</span>
          <span class="surface-signal-value is-alert">${esc(Number(game.loosePrice) > 0 ? `$${Math.round(Number(game.loosePrice))}` : 'n/a')}</span>
        </div>
        <div class="surface-signal-card">
          <span class="surface-signal-label">CIB</span>
          <span class="surface-signal-value">${esc(Number(game.cibPrice) > 0 ? `$${Math.round(Number(game.cibPrice))}` : 'n/a')}</span>
        </div>
        <div class="surface-signal-card">
          <span class="surface-signal-label">Mint</span>
          <span class="surface-signal-value">${esc(Number(game.mintPrice) > 0 ? `$${Math.round(Number(game.mintPrice))}` : 'n/a')}</span>
        </div>
      </div>
      <div class="surface-chip-row">
        ${visibleGenre ? `<span class="surface-chip is-primary">${esc(visibleGenre)}</span>` : ''}
        <span class="surface-chip">${esc(game.rarity || 'ARCHIVE')}</span>
        ${game.metascore ? `<span class="surface-chip is-hot">MS ${esc(game.metascore)}</span>` : '<span class="surface-chip">NO SCORE</span>'}
      </div>
      <div id="preview-metascore" class="preview-metascore"></div>
      ${description ? `<div class="detail-description surface-summary-copy">${description}</div>` : ''}
      <div class="detail-link-group surface-action-row">
        <a class="detail-link terminal-action-link" href="${detailHref}">Voir fiche complete -></a>
        <a class="detail-link terminal-action-link" href="${detailHref}#price-history-section">Ouvrir price trace -></a>
        <a class="detail-link terminal-action-link" href="/encyclopedia.html?game=${encodeURIComponent(game.id)}">Ouvrir RetroDex -></a>
      </div>
    </div>
  `
}

function renderPreviewMetascore(game) {
  if (!quickDetailEl || !window.RetroDexMetascore) return
  const previewMeta = quickDetailEl.querySelector('#preview-metascore')
  if (!previewMeta) return
  previewMeta.innerHTML = ''
  if (game?.metascore) {
    previewMeta.appendChild(window.RetroDexMetascore.renderBlock(game.metascore))
  }
}

function syncSortShortcutState() {
  if (!metascoreSortButtonEl) return
  metascoreSortButtonEl.classList.toggle('active', normalizeSortKey(sortEl?.value) === 'metascore_desc')
}

function markSelectedRow() {
  resultsEl.querySelectorAll('.result-row').forEach((rowEl) => {
    rowEl.classList.toggle('is-selected', rowEl.dataset.gameId === selectedGameId)
  })
}

async function loadQuickDetail(gameId) {
  selectedGameId = gameId
  markSelectedRow()
  updateUrl(state())
  quickDetailEl.className = 'quick-detail-loading terminal-empty-state'
  quickDetailEl.innerHTML = quickDetailStateMarkup('Chargement', 'Lecture du signal marche et des actions disponibles.')

  try {
    const game = await fetchJson(`/api/games/${encodeURIComponent(gameId)}`)
    quickDetailEl.className = ''
    quickDetailEl.innerHTML = quickDetailMarkup(game, state())
    renderPreviewMetascore(game)
  } catch (error) {
    quickDetailEl.className = 'quick-detail-placeholder terminal-empty-state'
    quickDetailEl.innerHTML = quickDetailStateMarkup('Detail indisponible', `Impossible de charger le detail (${error.message})`)
  }
}

function previewQuickDetail(game, currentState) {
  if (!quickDetailEl || !game) return
  if (selectedGameId === game.id) return
  quickDetailEl.className = ''
  quickDetailEl.innerHTML = quickDetailMarkup(game, currentState)
  renderPreviewMetascore(game)
}

function renderSummary(currentState, total) {
  const pills = [
    `<span class="summary-pill active">${total} jeux</span>`,
    `<span class="summary-pill ${currentState.console ? 'active' : ''}">console: ${esc(currentState.console || 'Toutes')}</span>`,
    `<span class="summary-pill ${currentState.rarity ? 'active' : ''}">rarete: ${esc(currentState.rarity || 'Toutes')}</span>`,
    `<span class="summary-pill ${currentState.genre ? 'active' : ''}">genre: ${esc(currentState.genre || 'Tous')}</span>`,
  ]

  if (currentState.trend) {
    pills.push(`<span class="summary-pill active">tendance: ${esc(currentState.trend)}</span>`)
  }

  if (currentState.yearMin || currentState.yearMax) {
    pills.push(`<span class="summary-pill active">annee: ${esc(currentState.yearMin || 1970)}-${esc(currentState.yearMax || 2012)}</span>`)
  }

  resultsSummaryEl.innerHTML = pills.join('')
}

function suggestions() {
  const fallback = [
    { title: 'Panzer Dragoon Saga', metascore: 98 },
    { title: 'Chrono Trigger', metascore: 95 },
    { title: 'Super Mario World', metascore: 94 },
    { title: 'The Legend of Zelda: A Link to the Past', metascore: 95 },
    { title: 'Final Fantasy VII', metascore: 92 },
    { title: 'Radiant Silvergun', metascore: 94 },
  ]
  const pool = [...(masterGames.length ? masterGames : fallback)]
    .sort((left, right) => num(right.metascore) - num(left.metascore) || textCmp(left.title, right.title))
    .slice(0, 24)
  const picks = []

  while (pool.length && picks.length < 3) {
    picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
  }

  return picks
}

function renderEmpty(currentState) {
  const picks = suggestions()
  const suffix = currentState.q ? ` pour "${esc(currentState.q)}".` : '.'
  renderPageNumbers(1, 1)

  resultsEl.innerHTML = `
    <div class="empty-state">
      <div><strong>Aucun jeu trouve${suffix}</strong></div>
      <div style="margin-top:8px;">Essayez : ${picks.map((game) => esc(game.title)).join(' | ') || 'un autre filtre'}.</div>
      ${picks.length ? `<div class="suggestions">${picks.map((game) => `<button type="button" class="suggestion-btn" data-suggestion="${esc(game.title)}">${esc(game.title)}</button>`).join('')}</div>` : ''}
    </div>
  `

  renderQuickDetailEmpty('Aucun signal dans cette fenetre de recherche.')

  resultsEl.querySelectorAll('[data-suggestion]').forEach((button) => {
    button.addEventListener('click', () => {
      queryEl.value = button.dataset.suggestion || ''
      currentOffset = 0
      loadGames()
    })
  })
}

function applyFilters(currentState) {
  filteredGames = fetchedGames.filter((game) => {
    const rarity = String(game.rarity || '').toUpperCase()
    const genre = String(game.genre || '')
    const year = num(game.year)
    const trend = String(game.trend?.mint || '')

    if (currentState.rarity && rarity !== currentState.rarity) return false
    if (currentState.genre && genre !== currentState.genre) return false
    if (currentState.trend && trend !== currentState.trend) return false
    if (currentState.yearMin && (!year || year < currentState.yearMin)) return false
    if (currentState.yearMax && (!year || year > currentState.yearMax)) return false

    return true
  })
}

function render(currentState) {
  filteredGames = sortGames(filteredGames, currentState.sort)
  const total = filteredGames.length
  const start = currentState.offset
  const end = Math.min(start + currentState.limit, total)
  const pageItems = filteredGames.slice(start, end)
  const page = total ? Math.floor(start / currentState.limit) + 1 : 1
  const totalPages = Math.max(1, Math.ceil(total / currentState.limit))

  renderSummary(currentState, total)
  pageIndicatorEl.textContent = total
    ? `Page ${page}/${totalPages} - ${start + 1}-${end} sur ${total}`
    : 'Page 1/1 - 0 resultat'
  prevButtonEl.disabled = start <= 0
  nextButtonEl.disabled = end >= total
  renderPageNumbers(page, totalPages)

  if (!pageItems.length) {
    renderEmpty(currentState)
    return
  }

  resultsEl.innerHTML = ''
  pageItems.forEach((game) => {
    const rowEl = renderGameRow(game, {
      collectionState: getCollectionState(game.id),
      onClick: () => navigateTo(game.id),
    })
    rowEl.addEventListener('mouseenter', () => previewQuickDetail(game, currentState))
    rowEl.addEventListener('focus', () => previewQuickDetail(game, currentState))
    rowEl.setAttribute('role', 'link')
    rowEl.setAttribute('tabindex', '0')
    resultsEl.appendChild(rowEl)
  })

  resultsEl.querySelectorAll('.result-row').forEach((rowEl) => {
    rowEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        navigateTo(rowEl.dataset.gameId)
      }
    })
  })

  if (selectedGameId) {
    markSelectedRow()
  } else if (pageItems[0]) {
    previewQuickDetail(pageItems[0], currentState)
  }
}

function renderLoadingSkeletons() {
  resultsEl.innerHTML = `
    <div class="skeleton skeleton-title"></div>
    <div class="skeleton skeleton-line-full"></div>
    <div class="skeleton skeleton-line-full"></div>
    <div class="skeleton skeleton-line-medium"></div>
    <div class="skeleton skeleton-line-full"></div>
    <div class="skeleton skeleton-line-short"></div>
  `
}

async function loadConsoles() {
  const payload = await fetchJson('/api/consoles')
  const consoles = Array.isArray(payload.consoles)
    ? payload.consoles
    : Array.isArray(payload.items)
      ? payload.items
      : []

  consoles.forEach((item) => {
    const consoleName = item.platform || item.name || item.title || ''
    if (!consoleName) return

    const option = document.createElement('option')
    option.value = consoleName
    option.textContent = `${consoleName} (${Number(item.gamesCount) || 0})`
    if (consoleEl.dataset.pending === consoleName) option.selected = true
    consoleEl.appendChild(option)
  })
}

function populateGenres(source) {
  const genres = [...new Set((source || masterGames)
    .map((game) => String(game.genre || '').trim())
    .filter((genre) => genre && genre !== 'Other'))].sort(textCmp)
  if (genreEl.options.length > 1 || !genres.length) return

  genres.forEach((genre) => {
    const option = document.createElement('option')
    option.value = genre
    option.textContent = genre
    if (genreEl.dataset.pending === genre) option.selected = true
    genreEl.appendChild(option)
  })
}

async function loadMeta() {
  try {
    const [statsPayload, gamesPayload] = await Promise.all([
      fetchJson('/api/stats'),
      fetchJson('/games?type=game'),
    ])
    totalGames = statsPayload.total_games || statsPayload.totals?.games || (Array.isArray(gamesPayload) ? gamesPayload.length : totalGames)
    masterGames = Array.isArray(gamesPayload) ? gamesPayload : []
  } catch (_) {
    masterGames = masterGames || []
  }

  subtitleEl.textContent = `${totalGames} jeux retro`
  populateGenres()
}

async function loadGames() {
  const currentState = state()
  updateUrl(currentState)
  loadingIndicatorEl.textContent = 'Chargement...'
  renderLoadingSkeletons()

  const params = new URLSearchParams()
  if (currentState.q) params.set('q', currentState.q)
  if (currentState.console) params.set('console', currentState.console)
  params.set('type', 'game')
  params.set('limit', String(Math.max(totalGames || 507, 507)))
  params.set('include_trend', '1')

  try {
    const payload = await fetchJson(`/api/games?${params.toString()}`)
    fetchedGames = Array.isArray(payload.items) ? payload.items : []
    populateGenres(fetchedGames)
    applyFilters(currentState)

    if (currentState.offset >= filteredGames.length && filteredGames.length > 0) {
      currentOffset = Math.max(0, Math.floor((filteredGames.length - 1) / currentState.limit) * currentState.limit)
      return loadGames()
    }

    render(currentState)
    loadingIndicatorEl.textContent = ''
  } catch (error) {
    loadingIndicatorEl.textContent = `Erreur: ${error.message}`
    resultsEl.innerHTML = '<div class="empty-state">Impossible de charger le catalogue.</div>'
  }
}

async function loadCollectionSignals() {
  if (typeof CoreApi.fetchCollectionIndex !== 'function') {
    return
  }

  try {
    collectionIndex = await CoreApi.fetchCollectionIndex()
  } catch (_error) {
    collectionIndex = null
  }
}

function searchNow() {
  clearTimeout(debounceTimer)
  currentOffset = 0
  loadGames()
}

function resetFilters() {
  queryEl.value = ''
  consoleEl.value = ''
  rarityEl.value = ''
  genreEl.value = ''
  trendEl.value = ''
  yearMinEl.value = ''
  yearMaxEl.value = ''
  sortEl.value = 'rarity_desc'
  limitEl.value = '20'
  currentOffset = 0
  selectedGameId = ''
  renderQuickDetailEmpty()
  toggleAdvanced(false)
  loadGames()
}

searchButtonEl.addEventListener('click', searchNow)
toggleAdvancedEl.addEventListener('click', () => toggleAdvanced())
filtersMobileToggleEl.addEventListener('click', () => toggleFiltersPanel())
resetFiltersEl.addEventListener('click', (event) => {
  event.preventDefault()
  resetFilters()
})

queryEl.addEventListener('input', () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    currentOffset = 0
    loadGames()
  }, 300)
})

queryEl.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    searchNow()
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    queryEl.value = ''
    searchNow()
  }
})

;
[consoleEl, rarityEl, genreEl, trendEl, limitEl, sortEl].forEach((element) => {
  element.addEventListener('change', () => {
    currentOffset = 0
    syncSortShortcutState()
    loadGames()
  })
})

;
[yearMinEl, yearMaxEl].forEach((element) => {
  element.addEventListener('input', () => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      currentOffset = 0
      loadGames()
    }, 300)
  })
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      searchNow()
    }
  })
})

prevButtonEl.addEventListener('click', () => {
  const currentState = state()
  currentOffset = Math.max(0, currentState.offset - currentState.limit)
  loadGames()
})

nextButtonEl.addEventListener('click', () => {
  const currentState = state()
  if (currentState.offset + currentState.limit < filteredGames.length) {
    currentOffset = currentState.offset + currentState.limit
    loadGames()
  }
})

metascoreSortButtonEl?.addEventListener('click', () => {
  sortEl.value = 'metascore_desc'
  currentOffset = 0
  syncSortShortcutState()
  loadGames()
})

document.addEventListener('keydown', (event) => {
  const tag = event.target?.tagName
  const inField = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || event.target?.isContentEditable

  if (event.key === 'Escape' && queryEl.value) {
    queryEl.value = ''
    currentOffset = 0
    loadGames()
    return
  }

  if (inField) return

  const currentState = state()
  if (event.key === 'ArrowLeft' && currentState.offset > 0) {
    event.preventDefault()
    currentOffset = Math.max(0, currentState.offset - currentState.limit)
    loadGames()
  }
  if (event.key === 'ArrowRight' && currentState.offset + currentState.limit < filteredGames.length) {
    event.preventDefault()
    currentOffset = currentState.offset + currentState.limit
    loadGames()
  }
})

readStateFromUrl()
syncSortShortcutState()
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search)
  const hasAdv = params.get('genre')
    || params.get('yearMin')
    || params.get('yearMax')
    || params.get('trend')
    || (params.get('sort') && params.get('sort') !== 'rarity_desc')
  if (hasAdv) toggleAdvanced(true)

  const hasFilters = !!(
    queryEl.value.trim()
    || consoleEl.dataset.pending
    || rarityEl.value
    || genreEl.dataset.pending
    || trendEl.value
    || yearMinEl.value
    || yearMaxEl.value
  )
  toggleFiltersPanel(window.innerWidth >= 768 || hasFilters || hasAdv)
})

Promise.all([loadConsoles(), loadMeta(), loadCollectionSignals()])
  .then(() => loadGames())
  .then(() => {
    if (selectedGameId) loadQuickDetail(selectedGameId)
  })
  .catch((error) => {
    loadingIndicatorEl.textContent = `Erreur initiale: ${error.message}`
    resultsEl.innerHTML = '<div class="empty-state">Chargement impossible.</div>'
  })

