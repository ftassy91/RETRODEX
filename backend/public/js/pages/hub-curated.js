'use strict'

;(() => {
  const runtimeMonitor = window.RetroDexRuntimeMonitor?.createPageMonitor?.('hub')
  const bannerEl = document.getElementById('hub-curation-banner')
  const publishedEl = document.getElementById('hub-stat-published')
  const totalEl = document.getElementById('hub-stat-total')
  const synopsisEl = document.getElementById('hub-stat-synopsis')
  const consolesEl = document.getElementById('hub-stat-consoles')
  const publicationSignalEl = document.getElementById('hub-system-publication')
  const editorialSignalEl = document.getElementById('hub-system-editorial')
  const archiveSignalEl = document.getElementById('hub-system-archive')
  const richGridEl = document.getElementById('hub-rich-grid')
  const esc = window.RetroDexFormat?.escapeHtml || ((value) => String(value ?? ''))
  const buildRichness = window.RetroDexContentSignals?.buildRichness
  const sharedFetchJson = window.RetroDexApi?.fetchJson

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
    const summary = String(item.summary || item.synopsis || '').trim()
    const shortSummary = summary
      ? `${summary.slice(0, 116)}${summary.length > 116 ? '...' : ''}`
      : 'Archive, contexte, prix et collection sur une seule fiche.'
    const meta = [item.console, item.year].filter(Boolean).map((part) => esc(part)).join(' | ')
    const proofLabel = signals?.score >= 8
      ? 'lecture forte'
      : Number(item.metascore || 0) >= 90
        ? 'repere canonique'
        : 'contexte + valeur'
    const actionCue = item.collection_status
      ? 'ouvrir pour arbitrer la collection'
      : 'ouvrir pour lire puis qualifier'
    const relationCue = String(item.developer || item.publisher || '').trim()

    return `
      <article class="hub-encyclo-card hub-rich-card">
        <div class="hub-card-proof">${esc(proofLabel)}</div>
        <div class="hub-encyclo-card-title">${esc(item.title || 'Sans titre')}</div>
        <div class="hub-encyclo-card-meta">${meta || 'Archive RetroDex'}</div>
        <div class="surface-chip-row hub-rich-chip-row">
          ${signals ? `<span class="surface-chip is-primary">${esc(signals.band.shortLabel)}</span>` : ''}
          ${item.metascore ? `<span class="surface-chip is-hot">MS ${esc(item.metascore)}</span>` : ''}
        </div>
        <p class="hub-card-copy">${esc(shortSummary)}</p>
        ${relationCue ? `<div class="hub-card-proof hub-card-proof-secondary">Studio ${esc(relationCue)}</div>` : ''}
        <div class="hub-card-proof hub-card-proof-secondary">Action ${esc(actionCue)}</div>
        <div class="hub-universe-actions">
          <a class="hub-inline-link" href="${href}">voir la fiche</a>
        </div>
      </article>
    `
  }

  async function loadHub() {
    const slowTimer = window.setTimeout(() => {
      if (bannerEl) {
        bannerEl.textContent = 'Chargement lent | signaux RetroDex en cours de lecture'
      }
      runtimeMonitor?.mark('slow-load')
    }, 4500)

    try {
      const [itemsResult, statsResult] = await Promise.allSettled([
        fetchJson('/api/items?limit=12&sort=metascore_desc'),
        fetchJson('/api/stats'),
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
      const consoles = Number(publication.consoleCount || 0)
      const withSynopsis = Number(statsPayload?.with_synopsis || 0)

      bannerEl.textContent = `${published || '--'} fiches pretes | ${withSynopsis || '--'} lectures visibles | ${consoles || '--'} supports`
      if (typeof rollTo === 'function') {
        rollTo(publishedEl, published || '--')
        rollTo(totalEl, total || '--')
        rollTo(synopsisEl, withSynopsis || '--')
        rollTo(consolesEl, consoles || '--')
      } else {
        setText(publishedEl, String(published || '--'))
        setText(totalEl, String(total || '--'))
        setText(synopsisEl, String(withSynopsis || '--'))
        setText(consolesEl, String(consoles || '--'))
      }
      setText(publicationSignalEl, published ? `${published} fiches pretes` : 'catalogue partiel')
      setText(editorialSignalEl, withSynopsis ? `${withSynopsis} lectures visibles` : 'lecture partielle')
      setText(archiveSignalEl, strongPages.length ? `${strongPages.length} fiches a ouvrir` : 'selection indisponible')

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
      bannerEl.textContent = 'RetroDex | lecture, qualification, valeur'
      setText(publicationSignalEl, 'indisponible')
      setText(editorialSignalEl, 'indisponible')
      setText(archiveSignalEl, 'indisponible')
      renderState('Signaux indisponibles', 'Impossible de charger les fiches a ouvrir pour cette session.')
      runtimeMonitor?.fail(_error)
    } finally {
      window.clearTimeout(slowTimer)
    }
  }

  loadHub()
})()
