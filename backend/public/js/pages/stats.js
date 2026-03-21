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
    statsErrorEl.textContent = `Impossible de charger les statistiques (${error.message}).`
    marketNoteEl.textContent = 'Analyse indisponible.'
    console.error('Stats page failed:', error)
  }
}

loadStats()
