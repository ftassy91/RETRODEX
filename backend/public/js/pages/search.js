'use strict'

;(() => {
  const inputEl = document.getElementById('search-router-input')
  const resultsEl = document.getElementById('search-core-results')
  const countEl = document.getElementById('search-core-count')
  const bannerEl = document.getElementById('search-curation-banner')

  if (!inputEl || !resultsEl) {
    return
  }

  const params = new URLSearchParams(window.location.search)
  let currentQuery = params.get('q') || ''
  let searchTimer = null

  function syncUrl(query) {
    const url = new URL(window.location.href)
    if (query) url.searchParams.set('q', query)
    else url.searchParams.delete('q')
    window.history.replaceState({}, '', `${url.pathname}${url.search}`)
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')
  }

  function createChip(label, modifier = '') {
    const chip = document.createElement('span')
    chip.className = `sc-chip${modifier ? ` ${modifier}` : ''}`
    chip.textContent = label
    return chip
  }

  function buildItemContentSignals(item) {
    if (!window.RetroDexContentSignals?.buildRichness || item.type !== 'game') {
      return null
    }

    const meta = item.meta || {}
    return window.RetroDexContentSignals.buildRichness({
      ...meta,
      title: item.title,
      summary: meta.summary,
      synopsis: meta.synopsis,
      tagline: meta.tagline,
      developer: meta.developer,
      loosePrice: meta.loosePrice,
      cibPrice: meta.cibPrice,
      mintPrice: meta.mintPrice,
      metascore: meta.metascore,
      curation: item.curation || meta.curation || null,
      signals: item.signals || meta.signals || {},
    })
  }

  function renderPublicationBanner(publication) {
    if (!bannerEl) return
    if (!publication) {
      bannerEl.textContent = 'RetroDex lit uniquement la surface publiee.'
      return
    }

    const published = Number(publication.publishedGamesCount || 0)
    const consoles = Number(publication.consoleCount || 0)
    bannerEl.textContent = `${publication.label || 'Pass 1'} | ${published} fiches visibles | ${consoles} consoles`
  }

  async function preloadPublicationBanner() {
    try {
      const response = await fetch('/api/items?limit=1')
      const payload = await response.json()
      renderPublicationBanner(payload.publication || null)
    } catch (_error) {
      renderPublicationBanner(null)
    }
  }

  function renderEmpty(message) {
    resultsEl.innerHTML = `
      <div class="terminal-empty-state search-empty">
        <div class="terminal-empty-title">Recherche</div>
        <div class="terminal-empty-copy">${escapeHtml(message)}</div>
      </div>
    `
  }

  function renderResults(results) {
    if (!results.length) {
      renderEmpty('Aucun resultat visible.')
      if (countEl) countEl.textContent = '0 resultat'
      return
    }

    if (countEl) countEl.textContent = `${results.length} resultat(s)`
    resultsEl.innerHTML = ''

    results.forEach((item) => {
      const contentSignals = buildItemContentSignals(item)
      const row = document.createElement('a')
      row.className = 'sc-row sc-row-lean'
      row.href = item.href

      const main = document.createElement('div')
      main.className = 'sc-main'

      const title = document.createElement('span')
      title.className = 'sc-title'
      title.textContent = item.title
      main.appendChild(title)

      const subtitle = document.createElement('span')
      subtitle.className = 'sc-sub'
      subtitle.textContent = item.subtitle || ''
      main.appendChild(subtitle)

      const summaryText = item.meta?.tagline || item.meta?.summary || item.meta?.synopsis || ''
      if (summaryText) {
        const summary = document.createElement('span')
        summary.className = 'sc-summary'
        summary.textContent = summaryText.slice(0, 126) + (summaryText.length > 126 ? '...' : '')
        main.appendChild(summary)
      }

      const chipRow = document.createElement('div')
      chipRow.className = 'sc-chip-row'
      if (item.type === 'game' && item.meta?.console) {
        chipRow.appendChild(createChip(item.meta.console, 'is-primary'))
      } else {
        chipRow.appendChild(createChip(String(item.type || 'entry').toUpperCase(), 'is-primary'))
      }
      if (item.meta?.year) chipRow.appendChild(createChip(String(item.meta.year)))
      if (contentSignals) {
        chipRow.appendChild(createChip(`Richesse ${contentSignals.band.shortLabel}`, `is-richness is-${contentSignals.band.key}`))
        chipRow.appendChild(createChip(`Etat ${contentSignals.completionState.shortLabel}`, 'is-completion'))
        chipRow.appendChild(createChip(`Confiance ${contentSignals.confidence.shortLabel}`, 'is-confidence'))
      } else if (item.meta?.rarity) {
        chipRow.appendChild(createChip(item.meta.rarity, 'is-hot'))
      }
      main.appendChild(chipRow)

      row.appendChild(main)

      const signal = document.createElement('div')
      signal.className = 'sc-signal-grid sc-signal-grid-lean'
      if (item.meta?.metascore) {
        const score = document.createElement('div')
        score.className = 'surface-signal-card'
        score.innerHTML = `
          <span class="surface-signal-label">Metascore</span>
          <span class="surface-signal-value">${escapeHtml(String(item.meta.metascore))}</span>
        `
        signal.appendChild(score)
      }
      if (item.meta?.loosePrice != null && item.type === 'game') {
        const price = document.createElement('div')
        price.className = 'surface-signal-card'
        price.innerHTML = `
          <span class="surface-signal-label">Loose</span>
          <span class="surface-signal-value">${Number(item.meta.loosePrice) > 0 ? (window.RetroDexFormat?.formatCurrency(item.meta.loosePrice, 'n/a', item.meta.priceCurrency) || `$${Math.round(Number(item.meta.loosePrice))}`) : 'n/a'}</span>
        `
        signal.appendChild(price)
      }
      if (!signal.children.length) {
        const typeCard = document.createElement('div')
        typeCard.className = 'surface-signal-card'
        typeCard.innerHTML = `
          <span class="surface-signal-label">Type</span>
          <span class="surface-signal-value">${escapeHtml(String(item.type || '').toUpperCase())}</span>
        `
        signal.appendChild(typeCard)
      }
      row.appendChild(signal)

      const action = document.createElement('span')
      action.className = 'sc-action'
      action.textContent = item.type === 'game' ? 'Ouvrir la fiche ->' : 'Voir ->'
      row.appendChild(action)

      resultsEl.appendChild(row)
    })
  }

  async function doSearch(query) {
    if (!window.RetroDexSearch) {
      renderEmpty('Chargement du moteur...')
      window.setTimeout(() => doSearch(query), 400)
      return
    }

    if (countEl) countEl.textContent = 'Recherche...'

    try {
      const results = await window.RetroDexSearch.search(query, {}, 'all', 30)
      renderPublicationBanner(window.RetroDexSearch.lastPayload?.()?.publication || null)
      renderResults(results)
      syncUrl(query)
    } catch (_error) {
      renderEmpty('La recherche est indisponible pour cette session.')
    }
  }

  function showIdleState() {
    if (countEl) countEl.textContent = ''
    renderEmpty('Saisissez un titre, une console ou une franchise.')
    syncUrl('')
  }

  inputEl.addEventListener('input', () => {
    window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => {
      currentQuery = inputEl.value.trim()
      if (currentQuery.length >= 2) doSearch(currentQuery)
      else if (!currentQuery) showIdleState()
    }, 200)
  })

  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      inputEl.value = ''
      currentQuery = ''
      showIdleState()
    }
  })

  inputEl.value = currentQuery
  window.RetroDexSearch?.preload?.()
  preloadPublicationBanner()

  if (currentQuery.length >= 2) doSearch(currentQuery)
  else showIdleState()
})()
