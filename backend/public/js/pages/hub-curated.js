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
  const discoverGridEl = document.getElementById('hub-discover-grid')
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

  const RARITY_ORDER = { LEGENDARY: 0, EPIC: 1, RARE: 2, UNCOMMON: 3, COMMON: 4 }

  function pickDiscoverItems(items = [], count = 6) {
    // Take items that have a cover image, sorted by metascore then rarity
    const withCovers = items.filter((item) => String(item.coverImage || '').trim())
    withCovers.sort((a, b) => {
      const ms = (Number(b.metascore) || 0) - (Number(a.metascore) || 0)
      if (ms !== 0) return ms
      return (RARITY_ORDER[a.rarity] ?? 5) - (RARITY_ORDER[b.rarity] ?? 5)
    })
    // Spread across different consoles to avoid all NES games
    const seen = new Set()
    const spread = []
    for (const item of withCovers) {
      if (spread.length >= count) break
      if (!seen.has(item.console)) {
        seen.add(item.console)
        spread.push(item)
      }
    }
    // Fill remaining slots if spread didn't reach count
    for (const item of withCovers) {
      if (spread.length >= count) break
      if (!spread.includes(item)) spread.push(item)
    }
    return spread.slice(0, count)
  }

  function buildCoverCard(item) {
    const href = `/game-detail.html?id=${encodeURIComponent(item.id)}&source=hub-discover`
    const rarityClass = String(item.rarity || 'COMMON').toLowerCase()
    return `
      <a class="hub-discover-card rarity-${esc(rarityClass)}" href="${href}" title="${esc(item.title || '')}">
        <div class="hub-discover-cover">
          <img src="${esc(item.coverImage)}" alt="${esc(item.title || '')}" loading="lazy" />
        </div>
        <div class="hub-discover-info">
          <div class="hub-discover-title">${esc(item.title || 'Sans titre')}</div>
          <div class="hub-discover-meta">${esc(item.console || '')}${item.year ? ` · ${esc(item.year)}` : ''}</div>
        </div>
      </a>
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
    const shortSummary = summary ? `${summary.slice(0, 104)}${summary.length > 104 ? '...' : ''}` : 'Fiche recommandee.'

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
      const [itemsPayload, consolesPayload, statsPayload] = await Promise.all([
        fetchJson('/api/items?limit=120&sort=metascore_desc'),
        fetchJson('/api/consoles'),
        fetchJson('/api/stats'),
      ])

      const publication = itemsPayload.publication || consolesPayload.publication || {}
      const items = Array.isArray(itemsPayload.items) ? itemsPayload.items : []
      const richItems = pickRichItems(items)
      const discoverItems = pickDiscoverItems(items)

      // All dynamic values below are wrapped by esc() — safe for innerHTML
      if (discoverGridEl) {
        if (discoverItems.length) {
          discoverGridEl.innerHTML = discoverItems.map(buildCoverCard).join('')
        } else {
          discoverGridEl.closest('.hub-discover-shell')?.remove()
        }
      }
      const published = Number(publication.publishedGamesCount || 0)
      const total = Number(publication.catalogGamesCount || statsPayload.total_games || 0)
      const consoles = Number(publication.consoleCount || 0)
      const withSynopsis = Number(statsPayload?.encyclopedia_stats?.with_synopsis || 0)

      bannerEl.textContent = `${publication.label || 'Pass 1'} | ${published} fiches visibles | ${consoles} consoles`
      setText(publishedEl, String(published || '--'))
      setText(totalEl, String(total || '--'))
      setText(synopsisEl, String(withSynopsis || '--'))
      setText(consolesEl, String(consoles || '--'))
      setText(publicationSignalEl, `${published} visibles`)
      setText(editorialSignalEl, `${withSynopsis} lectures`)
      setText(archiveSignalEl, richItems.length ? `${richItems.length} picks` : 'en cours')

      if (!richItems.length) {
        renderState('Aucune fiche forte', 'La selection se remplira avec les publications riches.')
        return
      }

      richGridEl.innerHTML = richItems.map(buildCard).join('')
    } catch (_error) {
      if (discoverGridEl) discoverGridEl.closest('.hub-discover-shell')?.remove()
      bannerEl.textContent = 'Hub RetroDex | entree vers l index, les fiches et la collection'
      setText(publicationSignalEl, 'indisponible')
      setText(editorialSignalEl, 'indisponible')
      setText(archiveSignalEl, 'indisponible')
      renderState('Signaux indisponibles', 'Impossible de lire la vitrine pour cette session.')
    }
  }

  loadHub()
})()
