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
  const {
    linkTo = 'game-detail',
    showPrice = true,
    showRarity = true,
    collectionState = null,
  } = options
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
  const genre = game.genre && game.genre !== 'Other' ? game.genre : ''
  const loosePrice = showPrice
    ? (game.loosePrice ? `$${Math.round(game.loosePrice)}` : '&mdash;')
    : ''
  const showOwnedBadge = String(collectionState || '').toLowerCase() === 'owned'

  el.innerHTML = `
    <span class="result-row-indicator">&rsaquo;</span>
    <div class="result-info">
      <span class="result-title" title="${escapeHtml(game.title || '')}">${escapeHtml(game.title || '')}${showOwnedBadge ? '<span class="result-owned-badge">OWNED</span>' : ''}</span>
      <span class="result-meta">${escapeHtml(consoleName)} &middot; ${escapeHtml(year)}${genre ? ` &middot; ${escapeHtml(genre)}` : ''}</span>
    </div>
    <div class="result-signal">
      ${showPrice ? `<span class="result-price">${loosePrice}</span>` : ''}
      ${showRarity ? `<span class="result-rarity" style="color:${rarityColors[rarity] || 'var(--text-muted)'}">${escapeHtml(rarity || 'COMMON')}</span>` : ''}
    </div>
  `

  if (window.RetroDexAssets && game.console) {
    const img = window.RetroDexAssets.createSupportImg(game.console, 16)
    const infoEl = el.querySelector('.result-info')
    if (infoEl) infoEl.insertBefore(img, infoEl.firstChild)
  }

  if (window.RetroDexAssets) {
    const rarityImg = window.RetroDexAssets.createRarityImg(game.rarity, 14)
    if (rarityImg) {
      rarityImg.style.marginLeft = '0'
      rarityImg.style.marginRight = '4px'
      const rarityEl = el.querySelector('.result-rarity')
      if (rarityEl) rarityEl.prepend(rarityImg)
    }
  }

  return el
}

if (typeof module !== 'undefined') module.exports = { renderGameRow }
