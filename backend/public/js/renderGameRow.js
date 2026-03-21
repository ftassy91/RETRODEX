'use strict'

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
  el.className = 'result-row'
  el.style.cursor = 'pointer'
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
  const price = showPrice && game.loosePrice ? '$' + Math.round(game.loosePrice) : ''
  const year = game.year || '—'
  const console_ = game.console || ''

  el.dataset.gameId = game.id || ''
  el.innerHTML = `
    <span class="result-title" style="color:var(--text-primary)">${game.title || ''}</span>
    <span class="result-meta">${console_} · ${year}</span>
    ${showPrice ? '<span class="result-price" style="color:var(--text-alert)">' + price + '</span>' : ''}
    ${showRarity ? '<span class="result-rarity" style="color:' + (rarityColors[rarity] || 'var(--text-muted)') + ';font-size:9px">' + rarity + '</span>' : ''}
  `

  return el
}

if (typeof module !== 'undefined') module.exports = { renderGameRow }
