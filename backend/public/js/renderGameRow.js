'use strict'

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function renderGameRow(game, options = {}) {
  const { linkTo = 'game-detail', showPrice = true, showRarity = true } = options
  const rarityColors = {
    LEGENDARY: 'var(--confidence-high)',
    EPIC: 'var(--text-alert)',
    RARE: 'var(--confidence-mid)',
    UNCOMMON: 'var(--text-muted)',
    COMMON: 'var(--text-muted)',
  }

  const el = document.createElement('div')
  el.className = 'result-row result-row-catalog'
  el.style.cursor = 'pointer'
  el.dataset.gameId = game.id || ''

  el.onclick = () => {
    if (typeof options.onClick === 'function') {
      options.onClick(game, el)
      return
    }

    if (linkTo === 'game-detail') {
      location.href = `/game-detail.html?id=${encodeURIComponent(game.id)}`
    }
  }

  const rarity = game.rarity || ''
  const year = game.year || 'n/a'
  const consoleName = game.console || ''
  const genre = game.genre || ''
  const loosePrice = showPrice
    ? (game.loosePrice ? `$${Math.round(game.loosePrice)}` : '&mdash;')
    : ''

  el.innerHTML = `
    <span class="result-row-indicator">&rsaquo;</span>
    <div class="result-info">
      <span class="result-title">${escapeHtml(game.title || '')}</span>
      <span class="result-meta">${escapeHtml(consoleName)} &middot; ${escapeHtml(year)}${genre ? ` &middot; ${escapeHtml(genre)}` : ''}</span>
    </div>
    <div class="result-signal">
      ${showPrice ? `<span class="result-price">${loosePrice}</span>` : ''}
      ${showRarity ? `<span class="result-rarity" style="color:${rarityColors[rarity] || 'var(--text-muted)'}">${escapeHtml(rarity || 'COMMON')}</span>` : ''}
    </div>
  `

  return el
}

if (typeof module !== 'undefined') module.exports = { renderGameRow }
