'use strict'

;(() => {
  const runtimeMonitor = window.RetroDexRuntimeMonitor?.createPageMonitor?.('hub')
  const bannerEl = document.getElementById('hub-curation-banner')
  const navGamesEl = document.getElementById('hub-nav-games')
  const navCollectionEl = document.getElementById('hub-nav-collection')
  const navPricesEl = document.getElementById('hub-nav-prices')
  const richGridEl = document.getElementById('hub-rich-grid')
  const esc = window.RetroDexFormat?.escapeHtml || ((value) => String(value ?? ''))
  const buildRichness = window.RetroDexContentSignals?.buildRichness
  const sharedFetchJson = window.RetroDexApi?.fetchJson

  // Cover manifest: maps game_id → pixel art file
  let _coverMap = null

  function loadCoverManifest() {
    if (_coverMap) return Promise.resolve(_coverMap)
    return fetch('/assets/hub_pixel_art/_manifest.json')
      .then(function (r) { return r.ok ? r.json() : [] })
      .then(function (entries) {
        _coverMap = new Map()
        if (Array.isArray(entries)) {
          entries.forEach(function (e) {
            if (e.game_id) _coverMap.set(e.game_id, e.file)
            if (e.slug) _coverMap.set(e.slug, e.file)
          })
        }
        return _coverMap
      })
      .catch(function () { _coverMap = new Map(); return _coverMap })
  }

  function getCoverUrl(item) {
    if (!_coverMap) return null
    var file = _coverMap.get(item.id) || _coverMap.get(item.slug) || null
    return file ? '/assets/hub_pixel_art/' + file : null
  }

  if (!bannerEl) {
    return
  }

  async function fetchJson(url, options) {
    if (typeof sharedFetchJson === 'function') {
      return sharedFetchJson(url, options)
    }

    const controller = typeof AbortController === 'function' ? new AbortController() : null
    const timeoutId = controller ? window.setTimeout(() => controller.abort(), 12000) : null

    try {
      const response = await fetch(url, {
        ...(options || {}),
        signal: controller ? controller.signal : options?.signal,
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || `${response.status} ${response.statusText}`)
      }
      return payload
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`Request timeout for ${url}`)
      }
      throw error
    } finally {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }

  function setText(el, value) {
    if (el) el.textContent = value
  }

  function renderState(title, copy) {
    if (!richGridEl) {
      return
    }

    richGridEl.innerHTML = `
      <div class="terminal-empty-state hub-empty-state">
        <div class="terminal-empty-title">${esc(title)}</div>
        <div class="terminal-empty-copy">${esc(copy)}</div>
      </div>
    `
  }

  function pickStrongPages(items = []) {
    return [...items]
      .map((item) => ({
        ...item,
        _contentSignals: typeof buildRichness === 'function' ? buildRichness(item) : null,
      }))
      .sort((left, right) => {
        const leftScore = Number(left?._contentSignals?.score || 0)
        const rightScore = Number(right?._contentSignals?.score || 0)
        if (leftScore !== rightScore) return rightScore - leftScore

        const leftMeta = Number(left.metascore || 0)
        const rightMeta = Number(right.metascore || 0)
        if (leftMeta !== rightMeta) return rightMeta - leftMeta

        return String(left.title || '').localeCompare(String(right.title || ''), 'fr', { sensitivity: 'base' })
      })
      .slice(0, 3)
  }

  function buildCard(item) {
    const signals = item._contentSignals
    const href = `/game-detail.html?id=${encodeURIComponent(item.id)}`
    const meta = [item.console, item.year].filter(Boolean).map((part) => esc(part)).join(' · ')
    const coverUrl = getCoverUrl(item)
    const initial = (item.title || '?')[0].toUpperCase()

    const coverHtml = coverUrl
      ? `<img class="hub-card-cover" src="${esc(coverUrl)}" alt="${esc(item.title)}" loading="lazy" />`
      : `<div class="hub-card-cover hub-card-cover-placeholder"><span>${esc(initial)}</span></div>`

    return `
      <a class="hub-rich-card" href="${href}">
        ${coverHtml}
        <div class="hub-card-body">
          <div class="hub-encyclo-card-title">${esc(item.title || 'Sans titre')}</div>
          <div class="hub-encyclo-card-meta">${meta || 'RetroDex'}</div>
          <div class="surface-chip-row hub-rich-chip-row">
            ${signals ? `<span class="surface-chip is-primary">${esc(signals.band.shortLabel)}</span>` : ''}
            ${item.metascore ? `<span class="surface-chip is-hot">MS ${esc(item.metascore)}</span>` : ''}
          </div>
        </div>
      </a>
    `
  }

  async function loadHub() {
    const slowTimer = window.setTimeout(() => {
      if (bannerEl) {
        bannerEl.textContent = 'Chargement lent | signaux en cours de lecture'
      }
      runtimeMonitor?.mark('slow-load')
    }, 4500)

    try {
      const [itemsResult, statsResult] = await Promise.allSettled([
        fetchJson('/api/items?limit=12&sort=metascore_desc'),
        fetchJson('/api/stats'),
        loadCoverManifest(),
      ])
      runtimeMonitor?.mark('requests-settled', {
        items: itemsResult.status,
        stats: statsResult.status,
      })
      const itemsPayload = itemsResult.status === 'fulfilled' ? itemsResult.value : { items: [], publication: {} }
      const statsPayload = statsResult.status === 'fulfilled' ? statsResult.value : {}

      if (itemsResult.status !== 'fulfilled' && statsResult.status !== 'fulfilled') {
        throw new Error('Hub data unavailable')
      }

      const publication = itemsPayload.publication || {}
      const items = Array.isArray(itemsPayload.items) ? itemsPayload.items : []
      const strongPages = pickStrongPages(items)

      const published = Number(publication.publishedGamesCount || 0)
      const total = Number(publication.catalogGamesCount || statsPayload.total_games || 0)
      const priced = Number(statsPayload.priced_games || 0)

      // Populate nav card counters
      if (typeof rollTo === 'function') {
        rollTo(navGamesEl, total || '--')
        rollTo(navCollectionEl, published || '--')
        rollTo(navPricesEl, priced || '--')
      } else {
        setText(navGamesEl, String(total || '--'))
        setText(navCollectionEl, String(published || '--'))
        setText(navPricesEl, String(priced || '--'))
      }
      ;[navGamesEl, navCollectionEl, navPricesEl].forEach(function (el) { if (el) el.classList.add('is-loaded') })

      // Update banner
      bannerEl.textContent = `${total || '--'} jeux | ${published || '--'} fiches pretes | ${priced || '--'} prix`

      if (!richGridEl) {
        return
      }

      if (!strongPages.length) {
        renderState('Aucune fiche mise en avant', 'Les preuves de lecture ne sont pas encore disponibles pour cette session.')
        return
      }

      richGridEl.innerHTML = strongPages.map(buildCard).join('')
      runtimeMonitor?.success({
        cards: strongPages.length,
        published,
      })
    } catch (_error) {
      bannerEl.textContent = 'RetroDex'
      renderState('Signaux indisponibles', 'Impossible de charger les fiches a ouvrir pour cette session.')
      runtimeMonitor?.fail(_error)
    } finally {
      window.clearTimeout(slowTimer)
    }
  }

  loadHub()
})()
