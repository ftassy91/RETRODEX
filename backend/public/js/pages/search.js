'use strict'

;(() => {
  const { byId, qsa, setHtml, setText } = window.RetroDexDom || {}
  const { escapeHtml } = window.RetroDexFormat || {}
  const { fetchSearch } = window.RetroDexApi || {}
  const { getParams, replaceCurrentPath } = window.RetroDexState || {}

  if (!byId || !qsa || !setHtml || !setText || !escapeHtml || !fetchSearch || !getParams || !replaceCurrentPath) {
    console.warn('[RetroDex] Search bootstrap skipped: core helpers missing')
    return
  }

  const searchInputEl = byId('search-input')
  const searchCountEl = byId('search-count')
  const searchResultsEl = byId('search-results')
  const ctxQueryDisplayEl = byId('ctx-query-display')
  const searchPreviewEl = byId('search-preview')
  const previewTitleEl = byId('preview-title')
  const previewMetaEl = byId('preview-meta')
  const previewPriceEl = byId('preview-price')
  const typeButtons = qsa('[data-type]')
  const sortButtons = qsa('[data-sort]')
  const params = getParams()

  const requestedSort = params.get('sort')
  let activeType = ['all', 'game', 'franchise'].includes(params.get('type')) ? params.get('type') : 'all'
  let activeSort = ['relevance', 'price_asc', 'price_desc', 'year'].includes(requestedSort)
    ? requestedSort
    : requestedSort === 'year_desc'
      ? 'year'
      : 'relevance'
  let debounceTimer
  let lastResults = []
  let orderedResults = []
  let selectedIndex = -1
  let selectedItem = null

  function updateActiveFilter() {
    typeButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.type === activeType)
    })
  }

  function updateActiveSort() {
    sortButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.sort === activeSort)
    })
  }

  function updateContextQuery(query) {
    setText(ctxQueryDisplayEl, query ? ` - "${query}"` : '')
  }

  function renderEmptyState(title, copy, countLabel = '') {
    clearSelection()
    setText(searchCountEl, countLabel)
    setHtml(
      searchResultsEl,
      `
        <div class="terminal-empty-state search-empty">
          <div class="terminal-empty-title">${escapeHtml(title)}</div>
          <div class="terminal-empty-copy">${escapeHtml(copy)}</div>
        </div>
      `
    )
  }

  function updateUrl(query) {
    const nextParams = new URLSearchParams()
    if (query) nextParams.set('q', query)
    if (activeType !== 'all') nextParams.set('type', activeType)
    if (activeSort !== 'relevance') nextParams.set('sort', activeSort)
    replaceCurrentPath('/search.html', nextParams)
  }

  function rarityColor(rarity) {
    const map = {
      LEGENDARY: 'var(--confidence-high)',
      EPIC: 'var(--text-alert)',
      RARE: 'var(--confidence-mid)',
      UNCOMMON: 'var(--text-muted)',
      COMMON: 'var(--text-muted)',
    }
    return map[rarity] || 'var(--text-muted)'
  }

  function trendSign(item) {
    if (!item.loosePrice || Number(item.loosePrice) <= 0) return '-'
    if (item.rarity === 'LEGENDARY' || item.rarity === 'EPIC') return '^'
    if (item.rarity === 'COMMON') return '='
    return '~'
  }

  function trendClass(item) {
    const sign = trendSign(item)
    if (sign === '^') return 'trend-up'
    if (sign === '=') return 'trend-flat'
    return ''
  }

  function sortResults(results) {
    const games = results.filter((item) => item._type === 'game')
    const franchises = results.filter((item) => item._type === 'franchise')

    if (activeSort === 'price_asc') {
      games.sort((left, right) => {
        const a = Number.isFinite(Number(left.loosePrice)) ? Number(left.loosePrice) : Number.POSITIVE_INFINITY
        const b = Number.isFinite(Number(right.loosePrice)) ? Number(right.loosePrice) : Number.POSITIVE_INFINITY
        return a - b || String(left.title || '').localeCompare(String(right.title || ''), 'fr', { sensitivity: 'base' })
      })
    } else if (activeSort === 'price_desc') {
      games.sort((left, right) => {
        const a = Number.isFinite(Number(left.loosePrice)) ? Number(left.loosePrice) : Number.NEGATIVE_INFINITY
        const b = Number.isFinite(Number(right.loosePrice)) ? Number(right.loosePrice) : Number.NEGATIVE_INFINITY
        return b - a || String(left.title || '').localeCompare(String(right.title || ''), 'fr', { sensitivity: 'base' })
      })
    } else if (activeSort === 'year') {
      games.sort((left, right) => {
        const a = Number.isFinite(Number(left.year)) ? Number(left.year) : Number.NEGATIVE_INFINITY
        const b = Number.isFinite(Number(right.year)) ? Number(right.year) : Number.NEGATIVE_INFINITY
        return b - a || String(left.title || '').localeCompare(String(right.title || ''), 'fr', { sensitivity: 'base' })
      })
    }

    if (activeType === 'game') return games
    if (activeType === 'franchise') return franchises
    return [...franchises, ...games]
  }

  function clearSelection() {
    selectedIndex = -1
    selectedItem = null
    qsa('.terminal-row', searchResultsEl).forEach((row) => row.classList.remove('selected'))
    searchPreviewEl.style.display = 'none'
  }

  function openResult(item) {
    if (!item) return
    if (item._type === 'franchise') {
      window.location.href = `/franchises.html?slug=${encodeURIComponent(item.slug)}`
      return
    }
    window.location.href = `/game-detail.html?id=${encodeURIComponent(item.id)}`
  }

  function showPreview(item) {
    searchPreviewEl.style.display = 'block'
    setText(previewTitleEl, item.title || item.name || '-')
    previewMetaEl.innerHTML = `
      <span><span class="pv-label">Console </span><span class="pv-val">${escapeHtml(item.console || item.developer || '-')}</span></span>
      <span><span class="pv-label">Annee </span><span class="pv-val">${escapeHtml(item.year || (item.first_game ? `${item.first_game}->${item.last_game}` : '-'))}</span></span>
      <span><span class="pv-label">Rarete </span><span class="pv-val">${escapeHtml(item.rarity || '-')}</span></span>
    `
    previewPriceEl.innerHTML = item.loosePrice
      ? `
          <span><span class="pv-label">Loose </span><span class="pv-val" style="color:var(--text-alert)">$${Math.round(item.loosePrice)}</span></span>
          <span><span class="pv-label">CIB </span><span class="pv-val">$${item.cibPrice ? Math.round(item.cibPrice) : '-'}</span></span>
        `
      : ''
  }

  function selectResult(item, rowEl) {
    qsa('.terminal-row', searchResultsEl).forEach((row) => row.classList.remove('selected'))
    rowEl.classList.add('selected')
    selectedIndex = Number(rowEl.dataset.index || '-1')
    selectedItem = item
    showPreview(item)
  }

  function setSelectedIndex(nextIndex) {
    const rows = qsa('.terminal-row', searchResultsEl)
    if (!rows.length || nextIndex < 0 || nextIndex >= orderedResults.length) return
    const row = rows.find((node) => Number(node.dataset.index) === nextIndex)
    if (!row) return
    selectResult(orderedResults[nextIndex], row)
    row.scrollIntoView({ block: 'nearest' })
  }

  function renderMessage(message) {
    renderEmptyState('Recherche en attente', message)
  }

  function createGameRow(item, index) {
    const row = document.createElement('div')
    row.className = 'terminal-row'
    row.style.gridTemplateColumns = '12px 1fr 120px 70px 80px 60px'
    row.dataset.index = String(index)
    row.dataset.id = item.id
    row.innerHTML = `
      <span class="terminal-row-indicator">></span>
      <span class="result-title" style="color:var(--text-primary)">${escapeHtml(item.title)}</span>
      <span class="result-meta">${escapeHtml(item.console || '')} - ${escapeHtml(item.year || '-')}</span>
      <span style="text-align:right;color:var(--text-alert)">${item.loosePrice ? '$' + Math.round(item.loosePrice) : '-'}</span>
      <span style="text-align:center;font-size:9px;color:${rarityColor(item.rarity)}">${escapeHtml(item.rarity || '-')}</span>
      <span style="text-align:center" class="${trendClass(item)}">${trendSign(item)}</span>
    `
    row.addEventListener('click', () => selectResult(item, row))
    row.addEventListener('dblclick', () => openResult(item))
    return row
  }

  function createFranchiseRow(item, index) {
    const row = document.createElement('div')
    row.className = 'terminal-row row-franchise'
    row.style.gridTemplateColumns = '12px 80px 1fr 1fr'
    row.dataset.index = String(index)
    row.dataset.slug = item.slug
    row.innerHTML = `
      <span class="terminal-row-indicator">></span>
      <span class="encyclo-badge encyclo-badge-franchise">FRANCHISE</span>
      <span style="color:var(--text-primary)">${escapeHtml(item.name)}</span>
      <span style="color:var(--text-muted);font-size:10px">${escapeHtml(item.first_game || '-')}->${escapeHtml(item.last_game || '-')} - ${escapeHtml(item.developer || '')}</span>
    `
    row.addEventListener('click', () => selectResult(item, row))
    row.addEventListener('dblclick', () => openResult(item))
    return row
  }

  function renderResults(results, query) {
    updateContextQuery(query)
    setText(searchCountEl, `${results.length} entree${results.length > 1 ? 's' : ''}`)

    if (!results.length) {
      renderEmptyState(
        'Aucun resultat archive',
        `Aucune entree ne correspond a "${query}". Affinez la requete ou changez le filtre actif.`,
        '0 entree'
      )
      return
    }

    orderedResults = sortResults(results)
    selectedIndex = -1
    selectedItem = null
    setHtml(searchResultsEl, '')
    searchPreviewEl.style.display = 'none'

    orderedResults.forEach((item, index) => {
      searchResultsEl.appendChild(item._type === 'franchise' ? createFranchiseRow(item, index) : createGameRow(item, index))
    })

    const firstRow = searchResultsEl.querySelector('.terminal-row')
    if (firstRow) {
      selectResult(orderedResults[0], firstRow)
    }
  }

  async function performSearch() {
    const query = searchInputEl.value.trim()
    updateUrl(query)
    updateContextQuery(query)

    if (query.length < 2) {
      renderMessage('Saisissez au moins 2 caracteres pour interroger l\'archive.')
      return
    }

    setText(searchCountEl, 'Recherche...')
    try {
      const payload = await fetchSearch(query, activeType, 30)
      if (!payload.ok) {
        renderEmptyState('Recherche indisponible', 'Le terminal ne peut pas interroger l\'archive pour le moment.')
        return
      }

      lastResults = payload.items
      renderResults(lastResults, query)
    } catch (_error) {
      renderEmptyState('Recherche indisponible', 'Le terminal ne peut pas interroger l\'archive pour le moment.')
    }
  }

  function scheduleSearch() {
    window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(performSearch, 250)
  }

  function bindFilters() {
    typeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        activeType = button.dataset.type || 'all'
        updateActiveFilter()
        performSearch()
      })
    })

    sortButtons.forEach((button) => {
      button.addEventListener('click', () => {
        activeSort = button.dataset.sort || 'relevance'
        updateActiveSort()
        const query = searchInputEl.value.trim()
        updateUrl(query)
        if (lastResults.length) {
          renderResults(lastResults, query)
        }
      })
    })
  }

  function bindInput() {
    searchInputEl.addEventListener('input', scheduleSearch)
    searchInputEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        window.clearTimeout(debounceTimer)
        if (selectedItem) {
          openResult(selectedItem)
        } else {
          performSearch()
        }
      }

      if (event.key === 'ArrowDown' && orderedResults.length) {
        event.preventDefault()
        setSelectedIndex(selectedIndex < orderedResults.length - 1 ? selectedIndex + 1 : 0)
      }

      if (event.key === 'ArrowUp' && orderedResults.length) {
        event.preventDefault()
        setSelectedIndex(selectedIndex > 0 ? selectedIndex - 1 : orderedResults.length - 1)
      }
    })
  }

  function bindGlobalKeys() {
    document.addEventListener('keydown', (event) => {
      const tagName = event.target?.tagName
      const inField = tagName === 'INPUT' || tagName === 'TEXTAREA' || event.target?.isContentEditable

      if (event.key === '/' && !inField) {
        event.preventDefault()
        searchInputEl.focus()
        searchInputEl.select()
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        searchInputEl.value = ''
        setHtml(searchResultsEl, '')
        setText(searchCountEl, '')
        searchPreviewEl.style.display = 'none'
        updateUrl('')
        updateContextQuery('')
        lastResults = []
        orderedResults = []
        selectedIndex = -1
        selectedItem = null
        searchInputEl.focus()
      }

      if (!inField && event.key === 'ArrowDown' && orderedResults.length) {
        event.preventDefault()
        setSelectedIndex(selectedIndex < orderedResults.length - 1 ? selectedIndex + 1 : 0)
      }

      if (!inField && event.key === 'ArrowUp' && orderedResults.length) {
        event.preventDefault()
        setSelectedIndex(selectedIndex > 0 ? selectedIndex - 1 : orderedResults.length - 1)
      }

      if (!inField && event.key === 'Enter' && selectedItem) {
        event.preventDefault()
        openResult(selectedItem)
      }
    })
  }

  function init() {
    searchInputEl.value = params.get('q') || ''
    updateActiveFilter()
    updateActiveSort()
    updateContextQuery(searchInputEl.value.trim())
    bindFilters()
    bindInput()
    bindGlobalKeys()

    if (searchInputEl.value.trim().length >= 2) {
      performSearch()
    } else {
      renderMessage('Saisissez au moins 2 caracteres pour interroger l\'archive.')
      requestAnimationFrame(() => searchInputEl.focus())
    }
  }

  init()
})()
