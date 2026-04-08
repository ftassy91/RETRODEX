'use strict'

const queryEl = document.getElementById('query')
const consoleEl = document.getElementById('console')
const rarityEl = document.getElementById('rarity')
const limitEl = document.getElementById('limit')
const genreEl = document.getElementById('genre')
const completenessEl = document.getElementById('completeness')
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
const curationBannerEl = document.getElementById('catalog-curation-banner')
const ownedCountEl = document.getElementById('catalog-owned-count')
const wantedCountEl = document.getElementById('catalog-wanted-count')
const saleCountEl = document.getElementById('catalog-sale-count')
const publishedCountEl = document.getElementById('catalog-published-count')
const advancedFiltersEl = document.getElementById('advanced-filters')
const toggleAdvancedEl = document.getElementById('toggle-advanced')
const filtersMobileToggleEl = document.getElementById('filters-mobile-toggle')
const filtersSidebarContentEl = document.getElementById('filters-sidebar-content')
const metascoreSortButtonEl = document.getElementById('sort-metascore-desc')
const CoreApi = window.RetroDexApi || {}

let debounceTimer
let currentOffset = 0
let totalGames = 0
let fetchedGames = []
let filteredGames = []
let collectionIndex = null
let publicationSummary = null
let renderMode = 'client'
let advancedSnapshotPromise = null
let advancedSnapshotKey = ''

const RARITY_DESC_ORDER = { LEGENDARY: 0, EPIC: 1, RARE: 2, UNCOMMON: 3, COMMON: 4 }
const RARITY_ASC_ORDER = { COMMON: 0, UNCOMMON: 1, RARE: 2, EPIC: 3, LEGENDARY: 4 }

const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const num = (value) => Number(value) || 0
const textCmp = (left, right) => String(left || '').localeCompare(String(right || ''), 'fr', { sensitivity: 'base' })

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }
  return response.json()
}

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
  const open = typeof forceOpen === 'boolean' ? forceOpen : advancedFiltersEl.hidden
  advancedFiltersEl.hidden = !open
  toggleAdvancedEl.textContent = open ? '- Filtres avances' : '+ Filtres avances'

  if (open) {
    ensureAdvancedSnapshot(state())
      .then((payload) => populateGenres(payload?.items || []))
      .catch(() => {})
  }
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
  if (renderMode === 'server') {
    loadGames()
  } else {
    render(state())
  }
  window.scrollTo(0, 0)
}

function renderPageNumbers(currentPage, totalPages) {
  if (!pageNumbersEl) return
  if (totalPages <= 1) {
    pageNumbersEl.innerHTML = ''
    return
  }

  pageNumbersEl.innerHTML = ''
  const pages = []

  if (totalPages <= 7) {
    for (let page = 1; page <= totalPages; page += 1) pages.push(page)
  } else {
    pages.push(1)
    if (currentPage > 3) pages.push('...')
    for (let page = Math.max(2, currentPage - 1); page <= Math.min(totalPages - 1, currentPage + 1); page += 1) {
      pages.push(page)
    }
    if (currentPage < totalPages - 2) pages.push('...')
    pages.push(totalPages)
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

function readStateFromUrl() {
  const params = new URLSearchParams(location.search)
  queryEl.value = params.get('q') || ''
  consoleEl.dataset.pending = params.get('console') || ''
  rarityEl.value = params.get('rarity') || ''
  genreEl.dataset.pending = params.get('genre') || ''
  completenessEl.value = params.get('completeness') || ''
  trendEl.value = params.get('trend') || ''
  limitEl.value = ['20', '50', '100'].includes(params.get('limit')) ? params.get('limit') : '20'
  sortEl.value = normalizeSortKey(params.get('sort') || 'rarity_desc')
  yearMinEl.value = yearVal(params.get('yearMin'))
  yearMaxEl.value = yearVal(params.get('yearMax'))
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
    completeness: completenessEl?.value || '',
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
    ['completeness', currentState.completeness],
    ['trend', currentState.trend],
    ['yearMin', currentState.yearMin ? String(currentState.yearMin) : ''],
    ['yearMax', currentState.yearMax ? String(currentState.yearMax) : ''],
    ['limit', String(currentState.limit)],
    ['sort', currentState.sort],
    ['offset', String(currentState.offset)],
  ]

  entries.forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value)
    else url.searchParams.delete(key)
  })

  history.replaceState({}, '', url)
}

function requiresAdvancedSnapshot(currentState) {
  return Boolean(
    currentState.genre
    || currentState.completeness
    || currentState.trend
    || currentState.yearMin
    || currentState.yearMax
  )
}

function advancedSnapshotSignature(currentState) {
  return JSON.stringify({
    q: currentState.q,
    console: currentState.console,
    rarity: currentState.rarity,
    genre: currentState.genre,
    completeness: currentState.completeness,
    trend: currentState.trend,
    yearMin: currentState.yearMin,
    yearMax: currentState.yearMax,
    sort: currentState.sort,
  })
}

function buildItemsQuery(currentState, limitOverride = currentState.limit, offsetOverride = currentState.offset) {
  const params = new URLSearchParams()
  if (currentState.q) params.set('q', currentState.q)
  if (currentState.console) params.set('console', currentState.console)
  if (currentState.rarity) params.set('rarity', currentState.rarity)
  if (currentState.genre) params.set('genre', currentState.genre)
  if (currentState.yearMin) params.set('yearMin', String(currentState.yearMin))
  if (currentState.yearMax) params.set('yearMax', String(currentState.yearMax))
  params.set('limit', String(limitOverride))
  params.set('offset', String(offsetOverride))
  params.set('sort', currentState.sort)
  return params
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

function getCollectionState(gameId) {
  if (!collectionIndex || !gameId) return null
  if (collectionIndex.ownedIds?.has(gameId)) return 'owned'
  if (collectionIndex.wantedIds?.has(gameId)) return 'wanted'
  if (collectionIndex.forSaleIds?.has(gameId)) return 'for_sale'
  return null
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

function navigateTo(gameId) {
  window.location.href = detailUrl(gameId, state())
}

function setCatalogPublicationCopy(summary = null) {
  if (!summary) {
    if (subtitleEl) subtitleEl.textContent = `${totalGames} jeux visibles dans l'index`
    if (curationBannerEl) curationBannerEl.textContent = 'Lecture de publication en cours.'
    updateOperatingCounts()
    return
  }

  publicationSummary = summary
  const published = Number(summary.publishedGamesCount || 0)
  const consoles = Number(summary.consoleCount || 0)
  const total = Number(summary.catalogGamesCount || totalGames || 0)
  const label = summary.label || 'Pass 1'

  if (subtitleEl) subtitleEl.textContent = `${published} fiches visibles | ${consoles} supports`
  if (curationBannerEl) curationBannerEl.textContent = `${label} | ${published} fiches sur ${total} jeux`
  updateOperatingCounts()
}

function updateOperatingCounts() {
  if (ownedCountEl) {
    ownedCountEl.textContent = String(collectionIndex?.ownedIds?.size || 0)
  }
  if (wantedCountEl) {
    wantedCountEl.textContent = String(collectionIndex?.wantedIds?.size || 0)
  }
  if (saleCountEl) {
    saleCountEl.textContent = String(collectionIndex?.forSaleIds?.size || 0)
  }
  if (publishedCountEl) {
    const published = Number(publicationSummary?.publishedGamesCount || 0)
    publishedCountEl.textContent = published > 0 ? String(published) : '--'
  }
}

function populateGenres(source) {
  const genres = [...new Set((source || fetchedGames)
    .map((game) => String(game.genre || '').trim())
    .filter((genre) => genre && genre !== 'Other'))].sort(textCmp)

  genreEl.innerHTML = '<option value="">Tous</option>'
  genres.forEach((genre) => {
    const option = document.createElement('option')
    option.value = genre
    option.textContent = genre
    if (genreEl.dataset.pending === genre) option.selected = true
    genreEl.appendChild(option)
  })
}

function renderSummary(currentState, total) {
  const parts = [`${total} jeu${total > 1 ? 'x' : ''}`]
  if (currentState.console) parts.push(esc(currentState.console))
  if (currentState.rarity) parts.push(`rarete ${esc(currentState.rarity)}`)
  if (currentState.genre) parts.push(esc(currentState.genre))
  if (currentState.trend) parts.push(`tendance ${esc(currentState.trend)}`)
  if (currentState.yearMin || currentState.yearMax) {
    parts.push(`${esc(currentState.yearMin || 1970)}-${esc(currentState.yearMax || 2012)}`)
  }
  if (collectionIndex?.ownedIds?.size) {
    parts.push(`${collectionIndex.ownedIds.size} dans votre etagere`)
  }

  resultsSummaryEl.innerHTML = `<span class="results-summary-main">${parts.join(' | ')}</span>`
}

function suggestions() {
  return [...fetchedGames]
    .sort((left, right) => num(right.metascore) - num(left.metascore) || textCmp(left.title, right.title))
    .slice(0, 3)
}

function renderEmpty(currentState) {
  const picks = suggestions()
  const suffix = currentState.q ? ` pour "${esc(currentState.q)}".` : '.'
  renderPageNumbers(1, 1)

  resultsEl.innerHTML = `
    <div class="empty-state">
      <div><strong>Aucune fiche visible${suffix}</strong></div>
      <div style="margin-top:8px;">Essayez : ${picks.map((game) => esc(game.title)).join(' | ') || 'un autre filtre'}.</div>
      ${picks.length ? `<div class="suggestions">${picks.map((game) => `<button type="button" class="suggestion-btn" data-suggestion="${esc(game.title)}">${esc(game.title)}</button>`).join('')}</div>` : ''}
    </div>
  `

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
    const richness = window.RetroDexContentSignals?.buildRichness?.(game) || {}
    const bandKey = richness.band?.key || ''

    if (currentState.rarity && rarity !== currentState.rarity) return false
    if (currentState.genre && genre !== currentState.genre) return false
    if (currentState.completeness && bandKey !== currentState.completeness) return false
    if (currentState.trend && trend !== currentState.trend) return false
    if (currentState.yearMin && (!year || year < currentState.yearMin)) return false
    if (currentState.yearMax && (!year || year > currentState.yearMax)) return false
    return true
  })
}

function render(currentState) {
  renderMode = 'client'
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
    rowEl.setAttribute('role', 'link')
    rowEl.setAttribute('tabindex', '0')
    rowEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        navigateTo(game.id)
      }
    })
    resultsEl.appendChild(rowEl)
  })
}

function renderServerPage(currentState, payload = {}) {
  renderMode = 'server'
  const items = Array.isArray(payload.items) ? payload.items : []
  const total = Number(payload.total) || items.length
  const start = currentState.offset
  const end = Math.min(start + items.length, total)
  const page = total ? Math.floor(start / currentState.limit) + 1 : 1
  const totalPages = Math.max(1, Math.ceil(total / currentState.limit))

  renderSummary(currentState, total)
  pageIndicatorEl.textContent = total
    ? `Page ${page}/${totalPages} - ${start + 1}-${end} sur ${total}`
    : 'Page 1/1 - 0 resultat'
  prevButtonEl.disabled = start <= 0
  nextButtonEl.disabled = end >= total
  renderPageNumbers(page, totalPages)

  if (!items.length) {
    renderEmpty(currentState)
    return
  }

  resultsEl.innerHTML = ''
  items.forEach((game) => {
    const rowEl = renderGameRow(game, {
      collectionState: getCollectionState(game.id),
      onClick: () => navigateTo(game.id),
    })
    rowEl.setAttribute('role', 'link')
    rowEl.setAttribute('tabindex', '0')
    rowEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        navigateTo(game.id)
      }
    })
    resultsEl.appendChild(rowEl)
  })
}

function renderLoadingSkeletons() {
  resultsEl.innerHTML = `
    <div class="skeleton skeleton-title"></div>
    <div class="skeleton skeleton-line-full"></div>
    <div class="skeleton skeleton-line-full"></div>
    <div class="skeleton skeleton-line-medium"></div>
    <div class="skeleton skeleton-line-full"></div>
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

async function loadMeta() {
  try {
    const statsPayload = await fetchJson('/api/stats')
    totalGames = statsPayload.total_games || statsPayload.totals?.games || totalGames
  } catch (_error) {
    totalGames = totalGames || 0
  }

  if (subtitleEl) subtitleEl.textContent = `${totalGames} jeux en base`
  setCatalogPublicationCopy(publicationSummary)
}

async function loadCollectionSignals() {
  if (typeof CoreApi.fetchCollectionIndex !== 'function') return
  try {
    collectionIndex = await CoreApi.fetchCollectionIndex()
    updateOperatingCounts()
    if (resultsEl.childElementCount) {
      if (renderMode === 'server') {
        renderServerPage(state(), {
          items: fetchedGames,
          total: Number(resultsSummaryEl?.dataset.total || fetchedGames.length),
        })
      } else {
        render(state())
      }
    }
  } catch (_error) {
    collectionIndex = null
    updateOperatingCounts()
  }
}

async function fetchAdvancedSnapshot(currentState) {
  const chunkSize = 300
  const firstPayload = await fetchJson(`/api/items?${buildItemsQuery(currentState, chunkSize, 0).toString()}`)
  const total = Number(firstPayload.total) || 0
  const items = Array.isArray(firstPayload.items) ? [...firstPayload.items] : []

  if (total > chunkSize) {
    const offsets = []
    for (let offset = chunkSize; offset < total; offset += chunkSize) {
      offsets.push(offset)
    }

    const pages = await Promise.all(
      offsets.map((offset) => fetchJson(`/api/items?${buildItemsQuery(currentState, chunkSize, offset).toString()}`))
    )

    pages.forEach((payload) => {
      if (Array.isArray(payload.items) && payload.items.length) {
        items.push(...payload.items)
      }
    })
  }

  return {
    items,
    total,
    publication: firstPayload.publication || null,
  }
}

async function ensureAdvancedSnapshot(currentState) {
  const signature = advancedSnapshotSignature(currentState)
  if (requiresAdvancedSnapshot(currentState)) {
    return fetchAdvancedSnapshot(currentState)
  }

  if (!advancedSnapshotPromise || advancedSnapshotKey !== signature) {
    advancedSnapshotKey = signature
    advancedSnapshotPromise = fetchAdvancedSnapshot(currentState)
      .catch((error) => {
        advancedSnapshotPromise = null
        advancedSnapshotKey = ''
        throw error
      })
  }

  return advancedSnapshotPromise
}

async function loadGames() {
  const currentState = state()
  updateUrl(currentState)
  loadingIndicatorEl.textContent = 'Chargement...'
  renderLoadingSkeletons()

  try {
    if (requiresAdvancedSnapshot(currentState)) {
      const payload = await fetchAdvancedSnapshot(currentState)
      fetchedGames = payload.items
      publicationSummary = payload.publication || publicationSummary
      setCatalogPublicationCopy(publicationSummary)
      populateGenres(fetchedGames)
      applyFilters(currentState)

      if (currentState.offset >= filteredGames.length && filteredGames.length > 0) {
        currentOffset = Math.max(0, Math.floor((filteredGames.length - 1) / currentState.limit) * currentState.limit)
        return loadGames()
      }

      render(currentState)
    } else {
      const payload = await fetchJson(`/api/items?${buildItemsQuery(currentState).toString()}`)
      fetchedGames = Array.isArray(payload.items) ? payload.items : []
      publicationSummary = payload.publication || publicationSummary
      setCatalogPublicationCopy(publicationSummary)
      resultsSummaryEl.dataset.total = String(Number(payload.total) || fetchedGames.length)
      renderServerPage(currentState, payload)
    }

    loadingIndicatorEl.textContent = ''
  } catch (error) {
    loadingIndicatorEl.textContent = 'Catalogue indisponible.'
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
  completenessEl.value = ''
  trendEl.value = ''
  yearMinEl.value = ''
  yearMaxEl.value = ''
  sortEl.value = 'rarity_desc'
  limitEl.value = '20'
  currentOffset = 0
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

completenessEl.addEventListener('change', () => {
  currentOffset = 0
  loadGames()
})

const richnessQuickEl = document.getElementById('richness-quick')
if (richnessQuickEl) {
  richnessQuickEl.addEventListener('change', () => {
    if (completenessEl) completenessEl.value = richnessQuickEl.value
    currentOffset = 0
    loadGames()
  })
}

queryEl.addEventListener('input', () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    currentOffset = 0
    loadGames()
  }, 250)
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

;[consoleEl, rarityEl, genreEl, trendEl, limitEl, sortEl].forEach((element) => {
  element.addEventListener('change', () => {
    currentOffset = 0
    loadGames()
  })
})

;[yearMinEl, yearMaxEl].forEach((element) => {
  element.addEventListener('input', () => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      currentOffset = 0
      loadGames()
    }, 250)
  })
})

prevButtonEl.addEventListener('click', () => {
  const currentState = state()
  currentOffset = Math.max(0, currentState.offset - currentState.limit)
  if (renderMode === 'server') loadGames()
  else render(state())
})

nextButtonEl.addEventListener('click', () => {
  const currentState = state()
  if (renderMode === 'server') {
    currentOffset = currentState.offset + currentState.limit
    loadGames()
    return
  }
  if (currentState.offset + currentState.limit < filteredGames.length) {
    currentOffset = currentState.offset + currentState.limit
    render(state())
  }
})

metascoreSortButtonEl?.addEventListener('click', () => {
  sortEl.value = 'metascore_desc'
  currentOffset = 0
  loadGames()
})

document.addEventListener('keydown', (event) => {
  const tag = event.target?.tagName
  const inField = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || event.target?.isContentEditable
  if (inField) return

  const currentState = state()
  const serverTotal = Number(resultsSummaryEl?.dataset.total || 0)
  if (event.key === 'ArrowLeft' && currentState.offset > 0) {
    event.preventDefault()
    currentOffset = Math.max(0, currentState.offset - currentState.limit)
    if (renderMode === 'server') loadGames()
    else render(state())
  }
  if (event.key === 'ArrowRight' && (
    (renderMode === 'server' && currentState.offset + currentState.limit < serverTotal)
    || (renderMode !== 'server' && currentState.offset + currentState.limit < filteredGames.length)
  )) {
    event.preventDefault()
    currentOffset = currentState.offset + currentState.limit
    if (renderMode === 'server') loadGames()
    else render(state())
  }
})

readStateFromUrl()

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

loadGames().catch((error) => {
  loadingIndicatorEl.textContent = `Erreur initiale: ${error.message}`
  resultsEl.innerHTML = '<div class="empty-state">Chargement impossible.</div>'
})

Promise.allSettled([loadConsoles(), loadMeta(), loadCollectionSignals()]).then((results) => {
  const consolesFailed = results[0]?.status === 'rejected'
  const metaFailed = results[1]?.status === 'rejected'
  const collectionFailed = results[2]?.status === 'rejected'
  if (consolesFailed || metaFailed || collectionFailed) {
    console.warn('[RetroDex] Secondary catalog hydration degraded', {
      consolesFailed,
      metaFailed,
      collectionFailed,
    })
  }
})
