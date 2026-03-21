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

let debounceTimer
let currentOffset = 0
let totalGames = 507
let masterGames = []
let fetchedGames = []
let filteredGames = []
let selectedGameId = ''

const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const num = (value) => Number(value) || 0
const textCmp = (left, right) => String(left || '').localeCompare(String(right || ''), 'fr', { sensitivity: 'base' })

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
  sortEl.value = params.get('sort') || 'title_asc'
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
    sort: sortEl.value || 'title_asc',
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
  return [...items].sort((left, right) => {
    switch (sortKey) {
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
        return num(left.metascore) - num(right.metascore) || textCmp(left.title, right.title)
      case 'meta_desc':
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

  return `/game-detail.html?${params.toString()}`
}

function navigateTo(gameId) {
  window.location.href = detailUrl(gameId, state())
}

function renderQuickDetailEmpty(message = '&larr; Survoler ou selectionner un jeu') {
  quickDetailEl.className = 'quick-detail-placeholder'
  quickDetailEl.innerHTML = message
}

function detailPrice(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) {
    return '<div class="price-value empty">$—</div>'
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
  return `
    <div class="detail-content">
      <div class="detail-title">${esc(game.title || 'Sans titre')}</div>
      <div class="detail-badges">
        <span class="badge-platform">${esc(game.console || 'Console inconnue')}</span>
        <span class="badge-year">${esc(game.year || 'n/a')}</span>
        <span class="result-badge rarity-badge rarity-${esc(String(game.rarity || 'common').toLowerCase())}">${esc(game.rarity || 'COMMON')}</span>
      </div>
      <div class="detail-prices">
        <div class="detail-price-col">
          <div class="price-label">LOOSE</div>
          ${detailPrice(game.loosePrice)}
        </div>
        <div class="detail-price-col">
          <div class="price-label">CIB</div>
          ${detailPrice(game.cibPrice)}
        </div>
        <div class="detail-price-col">
          <div class="price-label">MINT</div>
          ${detailPrice(game.mintPrice)}
        </div>
      </div>
      ${description ? `<div class="detail-description">${description}</div>` : ''}
      <a class="detail-link terminal-action-link" href="${detailUrl(game.id, currentState)}">Voir fiche complete &rarr;</a>
    </div>
  `
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
  quickDetailEl.className = 'quick-detail-loading'
  quickDetailEl.innerHTML = 'Chargement...'

  try {
    const game = await fetchJson(`/api/games/${encodeURIComponent(gameId)}`)
    quickDetailEl.className = ''
    quickDetailEl.innerHTML = quickDetailMarkup(game, state())
  } catch (error) {
    quickDetailEl.className = 'quick-detail-placeholder'
    quickDetailEl.innerHTML = `Impossible de charger le detail (${esc(error.message)})`
  }
}

function previewQuickDetail(game, currentState) {
  if (!quickDetailEl || !game) return
  if (selectedGameId === game.id) return
  quickDetailEl.className = ''
  quickDetailEl.innerHTML = quickDetailMarkup(game, currentState)
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
  const suffix = currentState.q ? ` pour &laquo;${esc(currentState.q)}&raquo;.` : '.'
  renderPageNumbers(1, 1)

  resultsEl.innerHTML = `
    <div class="empty-state">
      <div><strong>Aucun jeu trouve${suffix}</strong></div>
      <div style="margin-top:8px;">Essayez : ${picks.map((game) => esc(game.title)).join(' · ') || 'un autre filtre'}.</div>
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
  pageIndicatorEl.textContent = `Page ${page} of ${totalPages}`
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
  const genres = [...new Set((source || masterGames).map((game) => String(game.genre || '').trim()).filter(Boolean))].sort(textCmp)
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
  sortEl.value = 'title_asc'
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
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search)
  const hasAdv = params.get('genre')
    || params.get('yearMin')
    || params.get('yearMax')
    || params.get('trend')
    || (params.get('sort') && params.get('sort') !== 'title_asc')
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

Promise.all([loadConsoles(), loadMeta()])
  .then(() => loadGames())
  .then(() => {
    if (selectedGameId) loadQuickDetail(selectedGameId)
  })
  .catch((error) => {
    loadingIndicatorEl.textContent = `Erreur initiale: ${error.message}`
    resultsEl.innerHTML = '<div class="empty-state">Chargement impossible.</div>'
  })
