'use strict'

;(() => {
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

  if (!bannerEl || !richGridEl) {
    return
  }

  async function fetchJson(url) {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  function setText(el, value) {
    if (el) el.textContent = value
  }

  function renderState(title, copy) {
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
      .slice(0, 6)
  }

  function buildCard(item) {
    const signals = item._contentSignals
    const href = `/game-detail.html?id=${encodeURIComponent(item.id)}`
    const summary = String(item.summary || item.synopsis || '').trim()
    const shortSummary = summary
      ? `${summary.slice(0, 116)}${summary.length > 116 ? '...' : ''}`
      : 'Fiche a ouvrir.'
    const meta = [item.console, item.year].filter(Boolean).map((part) => esc(part)).join(' | ')

    return `
      <article class="hub-encyclo-card hub-rich-card">
        <div class="hub-encyclo-card-title">${esc(item.title || 'Sans titre')}</div>
        <div class="hub-encyclo-card-meta">${meta || 'Archive RetroDex'}</div>
        <div class="surface-chip-row hub-rich-chip-row">
          ${signals ? `<span class="surface-chip is-primary">${esc(signals.band.shortLabel)}</span>` : ''}
          ${signals ? `<span class="surface-chip">Etat ${esc(signals.completionState.shortLabel)}</span>` : ''}
          ${item.metascore ? `<span class="surface-chip is-hot">MS ${esc(item.metascore)}</span>` : ''}
        </div>
        <p class="hub-card-copy">${esc(shortSummary)}</p>
        <div class="hub-universe-actions">
          <a class="hub-inline-link" href="${href}">ouvrir la fiche</a>
        </div>
      </article>
    `
  }

  async function loadHub() {
    try {
      const [itemsPayload, statsPayload] = await Promise.all([
        fetchJson('/api/items?limit=90&sort=metascore_desc'),
        fetchJson('/api/stats'),
      ])

      const publication = itemsPayload.publication || {}
      const items = Array.isArray(itemsPayload.items) ? itemsPayload.items : []
      const strongPages = pickStrongPages(items)

      const published = Number(publication.publishedGamesCount || 0)
      const total = Number(publication.catalogGamesCount || statsPayload.total_games || 0)
      const consoles = Number(publication.consoleCount || 0)
      const withSynopsis = Number(statsPayload?.encyclopedia_stats?.with_synopsis || 0)

      bannerEl.textContent = `${publication.label || 'Pass 1'} | ${published} fiches visibles | ${consoles} supports`
      setText(publishedEl, String(published || '--'))
      setText(totalEl, String(total || '--'))
      setText(synopsisEl, String(withSynopsis || '--'))
      setText(consolesEl, String(consoles || '--'))
      setText(publicationSignalEl, `${published} visibles`)
      setText(editorialSignalEl, `${withSynopsis} lectures`)
      setText(archiveSignalEl, strongPages.length ? `${strongPages.length} fiches fortes` : 'en cours')

      if (!strongPages.length) {
        renderState('Aucune fiche forte', 'La vitrine se remplira avec les meilleures pages publiees.')
        return
      }

      richGridEl.innerHTML = strongPages.map(buildCard).join('')
    } catch (_error) {
      bannerEl.textContent = 'RetroDex | systeme de lecture et de collection'
      setText(publicationSignalEl, 'indisponible')
      setText(editorialSignalEl, 'indisponible')
      setText(archiveSignalEl, 'indisponible')
      renderState('Signaux indisponibles', 'Impossible de charger la vitrine pour cette session.')
    }
  }

  loadHub()
})()
