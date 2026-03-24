'use strict'

const TOTAL_SYNOPSIS_TARGET = 1296
const RARITY_ORDER = ['LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON']

const overviewTotalGamesEl = document.getElementById('overview-total-games')
const overviewPlatformTotalEl = document.getElementById('overview-platform-total')
const overviewPricedTotalEl = document.getElementById('overview-priced-total')
const rarityGridEl = document.getElementById('rarity-grid')
const platformBarsEl = document.getElementById('platform-bars')
const marketT1El = document.getElementById('market-t1-count')
const marketT3El = document.getElementById('market-t3-count')
const marketT4El = document.getElementById('market-t4-count')
const marketMostExpensiveEl = document.getElementById('market-most-expensive')
const marketLeastExpensiveEl = document.getElementById('market-least-expensive')
const marketNoteEl = document.getElementById('market-note')
const encycloSynopsisEl = document.getElementById('encyclo-synopsis-count')
const encycloFranchiseEl = document.getElementById('encyclo-franchise-count')
const priceMedianLooseEl = document.getElementById('price-median-loose')
const statsErrorEl = document.getElementById('stats-error')
const marketSearchInputEl = document.getElementById('market-search-input')
const marketSearchCountEl = document.getElementById('market-search-count')
const marketSearchResultsEl = document.getElementById('market-search-results')
const marketSearchPreviewEl = document.getElementById('market-search-preview')
const marketPreviewTitleEl = document.getElementById('market-preview-title')
const marketPreviewMetaEl = document.getElementById('market-preview-meta')
const marketPreviewPriceEl = document.getElementById('market-preview-price')
const marketPreviewLinksEl = document.getElementById('market-preview-links')

const urlParams = new URLSearchParams(window.location.search)
let marketSearchTimer = null

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatCurrency(value) {
  const number = Number(value)
  return Number.isFinite(number)
    ? `$${number.toFixed(2).replace(/\\.00$/, '')}`
    : '$0'
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }
  return response.json()
}

function marketSignalLabel(signal) {
  if (signal === 'premium') return 'PREMIUM'
  if (signal === 'watch') return 'WATCH'
  return 'BASELINE'
}

function marketSignalClass(signal) {
  if (signal === 'premium') return 'trend-up'
  if (signal === 'watch') return 'trend-flat'
  return ''
}

function renderMarketSearchEmpty(message) {
  if (!marketSearchResultsEl) return

  marketSearchResultsEl.innerHTML = `
    <div class="terminal-empty-state search-empty">
      <div class="terminal-empty-title">Recherche RetroMarket</div>
      <div class="terminal-empty-copy">${escapeHtml(message)}</div>
    </div>
  `
  if (marketSearchPreviewEl) {
    marketSearchPreviewEl.style.display = 'none'
  }
}

function showMarketSearchPreview(item) {
  if (!marketSearchPreviewEl) return

  marketSearchPreviewEl.style.display = 'block'
  marketPreviewTitleEl.textContent = item.title || '-'
  marketPreviewMetaEl.innerHTML = `
    <span><span class="pv-label">Console </span><span class="pv-val">${escapeHtml(item.console || '-')}</span></span>
    <span><span class="pv-label">Annee </span><span class="pv-val">${escapeHtml(item.year || '-')}</span></span>
    <span><span class="pv-label">Rarete </span><span class="pv-val">${escapeHtml(item.rarity || '-')}</span></span>
    <span><span class="pv-label">Signal </span><span class="pv-val">${escapeHtml(marketSignalLabel(item.signal))}</span></span>
  `
  marketPreviewPriceEl.innerHTML = `
    <span><span class="pv-label">Loose </span><span class="pv-val">${escapeHtml(formatCurrency(item.loosePrice || 0))}</span></span>
    <span><span class="pv-label">CIB </span><span class="pv-val">${escapeHtml(formatCurrency(item.cibPrice || 0))}</span></span>
    <span><span class="pv-label">Mint </span><span class="pv-val">${escapeHtml(formatCurrency(item.mintPrice || 0))}</span></span>
  `
  marketPreviewLinksEl.innerHTML = `
    <a class="terminal-action-link" href="/encyclopedia.html?game=${encodeURIComponent(item.id)}">Voir plus dans RetroDex &rarr;</a>
  `
}

function renderMarketSearchResults(items) {
  if (!marketSearchResultsEl) return

  if (!items.length) {
    renderMarketSearchEmpty('Aucun signal marche pour cette requete.')
    if (marketSearchCountEl) {
      marketSearchCountEl.textContent = '0 resultat'
    }
    return
  }

  marketSearchResultsEl.innerHTML = ''
  items.forEach((item, index) => {
    const row = document.createElement('button')
    row.type = 'button'
    row.className = 'terminal-row'
    row.style.gridTemplateColumns = '1fr 120px 80px 80px 80px 90px'
    row.innerHTML = `
      <span style="color:var(--text-primary)">${escapeHtml(item.title)}</span>
      <span class="result-meta">${escapeHtml(item.console || '-')} &middot; ${escapeHtml(item.year || '-')}</span>
      <span style="text-align:right;color:var(--text-alert)">${escapeHtml(formatCurrency(item.loosePrice || 0))}</span>
      <span style="text-align:right">${escapeHtml(formatCurrency(item.cibPrice || 0))}</span>
      <span style="text-align:right">${escapeHtml(formatCurrency(item.mintPrice || 0))}</span>
      <span style="text-align:center" class="${marketSignalClass(item.signal)}">${escapeHtml(marketSignalLabel(item.signal))}</span>
    `
    row.addEventListener('click', () => {
      marketSearchResultsEl.querySelectorAll('.terminal-row').forEach((node) => node.classList.remove('selected'))
      row.classList.add('selected')
      showMarketSearchPreview(item)
    })
    row.addEventListener('dblclick', () => {
      window.location.href = `/encyclopedia.html?game=${encodeURIComponent(item.id)}`
    })
    marketSearchResultsEl.appendChild(row)

    if (index === 0) {
      row.classList.add('selected')
      showMarketSearchPreview(item)
    }
  })

  if (marketSearchCountEl) {
    marketSearchCountEl.textContent = `${items.length} resultat(s)`
  }
}

async function performMarketSearch() {
  if (!marketSearchInputEl) return
  const query = String(marketSearchInputEl.value || '').trim()

  const nextParams = new URLSearchParams(window.location.search)
  query ? nextParams.set('q', query) : nextParams.delete('q')
  window.history.replaceState({}, '',
    `${window.location.pathname}${nextParams.toString() ? `?${nextParams.toString()}` : ''}`)

  if (query.length < 2) {
    if (marketSearchCountEl) marketSearchCountEl.textContent = ''
    renderMarketSearchEmpty('Saisissez au moins 2 caractères pour lire les signaux de valeur.')
    return
  }
  if (marketSearchCountEl) marketSearchCountEl.textContent = 'Recherche...'

  try {
    let items
    if (window.RetroDexSearch) {
      const results = await window.RetroDexSearch.search(query, {}, 'retromarket', 12)
      items = results.map((result) => ({
        id: result.id,
        title: result.title,
        console: result.meta?.console,
        year: result.meta?.year,
        rarity: result.meta?.rarity,
        loosePrice: result.meta?.loosePrice,
        cibPrice: result.meta?.cibPrice,
        mintPrice: result.meta?.mintPrice,
        signal: ['LEGENDARY', 'EPIC'].includes(result.meta?.rarity) ? 'premium'
          : result.meta?.rarity === 'RARE' ? 'watch' : 'baseline',
      }))
    } else {
      const payload = await fetchJson(`/api/games?q=${encodeURIComponent(query)}&limit=12`)
      items = (payload.items || []).map((game) => ({
        id: game.id,
        title: game.title,
        console: game.console,
        year: game.year,
        rarity: game.rarity,
        loosePrice: game.loosePrice,
        cibPrice: game.cibPrice,
        mintPrice: game.mintPrice,
        signal: ['LEGENDARY', 'EPIC'].includes(game.rarity) ? 'premium'
          : game.rarity === 'RARE' ? 'watch' : 'baseline',
      }))
    }
    renderMarketSearchResults(items)
  } catch (error) {
    renderMarketSearchEmpty(`Recherche indisponible (${error.message}).`)
  }
}

function bindMarketSearch() {
  if (!marketSearchInputEl) return

  const initialQuery = urlParams.get('q') || ''
  marketSearchInputEl.value = initialQuery
  marketSearchInputEl.addEventListener('input', () => {
    window.clearTimeout(marketSearchTimer)
    marketSearchTimer = window.setTimeout(performMarketSearch, 200)
  })

  if (initialQuery) {
    performMarketSearch()
  } else {
    renderMarketSearchEmpty('Recherche contextuelle RetroMarket : prix, rarete et fourchettes uniquement.')
  }
}

function renderRarityDistribution(byRarity, totalGames) {
  rarityGridEl.innerHTML = RARITY_ORDER.map((rarity) => {
    const count = Number(byRarity?.[rarity] || 0)
    const pct = totalGames ? ((count / totalGames) * 100).toFixed(1) : '0.0'

    return `
      <article class="rarity-item rarity-${escapeHtml(rarity.toLowerCase())}">
        <span class="rarity-name">${escapeHtml(rarity)}</span>
        <span class="rarity-count">${escapeHtml(count)}</span>
        <span class="rarity-pct">${escapeHtml(pct)}%</span>
      </article>
    `
  }).join('')
}

function renderTopPlatforms(platforms) {
  const max = Math.max(...platforms.map((item) => Number(item.count) || 0), 1)

  platformBarsEl.innerHTML = platforms.map((item) => {
    const count = Number(item.count) || 0
    const bar = '#'.repeat(Math.max(1, Math.round((count / max) * 22)))

    return `
      <div class="platform-row">
        <div class="platform-name">${escapeHtml(item.platform)}</div>
        <div class="platform-ascii">${bar}</div>
        <div class="platform-count">${escapeHtml(count)}</div>
      </div>
    `
  }).join('')
}

function renderGameSpot(element, game, fallbackTitle, fallbackMeta) {
  if (!game) {
    element.href = '/games-list.html'
    element.innerHTML = `
      <span class="game-spot-title">${escapeHtml(fallbackTitle)}</span>
      <span class="game-spot-meta">${escapeHtml(fallbackMeta)}</span>
      <span class="game-spot-price">&mdash;</span>
    `
    return
  }

  element.href = `/game-detail.html?id=${encodeURIComponent(game.id)}`
  element.innerHTML = `
    <span class="game-spot-title">${escapeHtml(game.title)}</span>
    <span class="game-spot-meta">${escapeHtml(game.platform || 'Console inconnue')} &middot; ${escapeHtml(game.year || 'n/a')}</span>
    <span class="game-spot-price">${escapeHtml(formatCurrency(game.loosePrice))}</span>
  `
}

async function loadStats() {
  try {
    const payload = await fetchJson('/api/stats')

    overviewTotalGamesEl.textContent = String(payload.total_games || 0)
    overviewPlatformTotalEl.textContent = String(payload.total_platforms || 0)
    overviewPricedTotalEl.textContent = String(payload.priced_games || 0)
    encycloSynopsisEl.textContent = `${payload.encyclopedia_stats?.with_synopsis || 0} / ${Math.max(payload.total_games || 0, TOTAL_SYNOPSIS_TARGET)}`
    encycloFranchiseEl.textContent = String(payload.encyclopedia_stats?.total_franchises || 0)
    priceMedianLooseEl.textContent = formatCurrency(payload.price_stats?.median_loose || 0)

    renderRarityDistribution(payload.by_rarity || {}, Number(payload.total_games || 0))
    renderTopPlatforms((payload.by_platform || []).slice(0, 10))

    marketT1El.textContent = String(payload.trust_stats?.t1 || 0)
    marketT3El.textContent = String(payload.trust_stats?.t3 || 0)
    marketT4El.textContent = String(payload.trust_stats?.t4 || 0)

    renderGameSpot(marketMostExpensiveEl, payload.expensive_game, 'Aucune donnee', 'Jeu le plus cher')
    renderGameSpot(marketLeastExpensiveEl, payload.cheapest_game, 'Aucune donnee', 'Jeu le moins cher')

    marketNoteEl.textContent =
      `Moyenne loose: ${formatCurrency(payload.price_stats?.avg_loose || 0)} | Min: ${formatCurrency(payload.price_stats?.min_loose || 0)} | Max: ${formatCurrency(payload.price_stats?.max_loose || 0)}`
  } catch (error) {
    statsErrorEl.hidden = false
    statsErrorEl.textContent = `Lecture stats indisponible (${error.message}).`
    marketNoteEl.textContent = 'Analyse RetroMarket indisponible.'
    console.error('Stats page failed:', error)
  }
}

loadStats()
bindMarketSearch()
