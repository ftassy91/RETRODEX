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

  function pickRichItems(items = []) {
    return [...items]
      .map((item) => ({
        ...item,
        _contentSignals: typeof buildRichness === 'function' ? buildRichness(item) : null,
      }))
      .sort((left, right) => {
        const leftScore = Number(left?._contentSignals?.score || 0)
        const rightScore = Number(right?._contentSignals?.score || 0)
        if (leftScore !== rightScore) return rightScore - leftScore
        return (Number(right.metascore) || 0) - (Number(left.metascore) || 0)
      })
      .slice(0, 3)
  }

  function buildCard(item) {
    const signals = item._contentSignals
    const href = `/game-detail.html?id=${encodeURIComponent(item.id)}`
    const summary = String(item.summary || item.synopsis || '').trim()
    const meta = [item.console, item.year].filter(Boolean).map((part) => esc(part)).join(' | ')
    const shortSummary = summary ? `${summary.slice(0, 90)}${summary.length > 90 ? '...' : ''}` : 'Fiche forte.'

    return `
      <article class="hub-encyclo-card hub-rich-card">
        <div class="hub-encyclo-card-title">${esc(item.title || 'Sans titre')}</div>
        <div class="hub-encyclo-card-meta">${meta || 'Archive RetroDex'}</div>
        <div class="surface-chip-row hub-rich-chip-row">
          ${signals ? `<span class="surface-chip is-primary">${esc(signals.band.shortLabel)}</span>` : ''}
          ${signals ? `<span class="surface-chip">État ${esc(signals.completionState.shortLabel)}</span>` : ''}
          ${item.metascore ? `<span class="surface-chip is-hot">MS ${esc(item.metascore)}</span>` : ''}
        </div>
        <p class="hub-card-copy">${esc(shortSummary)}</p>
        <div class="hub-universe-actions">
          <a class="hub-inline-link" href="${href}">Ouvrir</a>
        </div>
      </article>
    `
  }

  async function loadHub() {
    try {
      const [itemsPayload, consolesPayload, statsPayload] = await Promise.all([
        fetchJson('/api/items?limit=120&sort=metascore_desc'),
        fetchJson('/api/consoles'),
        fetchJson('/api/stats'),
      ])

      const publication = itemsPayload.publication || consolesPayload.publication || {}
      const items = Array.isArray(itemsPayload.items) ? itemsPayload.items : []
      const richItems = pickRichItems(items)
      const published = Number(publication.publishedGamesCount || 0)
      const total = Number(publication.catalogGamesCount || statsPayload.total_games || 0)
      const consoles = Number(publication.consoleCount || 0)
      const withSynopsis = Number(statsPayload?.encyclopedia_stats?.with_synopsis || 0)

      bannerEl.textContent = `${publication.label || 'Pass 1'} | ${published} fiches | ${consoles} supports`
      setText(publishedEl, String(published || '--'))
      setText(totalEl, String(total || '--'))
      setText(synopsisEl, String(withSynopsis || '--'))
      setText(consolesEl, String(consoles || '--'))
      setText(publicationSignalEl, `${published} visibles`)
      setText(editorialSignalEl, `${withSynopsis} lectures`)
      setText(archiveSignalEl, richItems.length ? `${richItems.length} picks` : '--')

      if (!richItems.length) {
        renderState('Aucune fiche forte', 'La selection arrive.')
        return
      }

      richGridEl.innerHTML = richItems.map(buildCard).join('')
    } catch (_error) {
      bannerEl.textContent = 'Hub RetroDex'
      setText(publicationSignalEl, 'indisponible')
      setText(editorialSignalEl, 'indisponible')
      setText(archiveSignalEl, 'indisponible')
      renderState('Signaux indisponibles', 'Impossible de lire la vitrine.')
    }
  }

  loadHub()
})()
