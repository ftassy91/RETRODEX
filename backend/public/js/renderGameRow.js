'use strict'

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function renderPresenceBadges(game) {
  const signals = game?.signals || {}
  const badges = []
  const docsCount = Number(Boolean(signals.hasMaps)) + Number(Boolean(signals.hasManuals))
  const mediaCount = Number(Boolean(signals.hasSprites)) + Number(Boolean(signals.hasEndings))

  if (game?.curation?.isPublished) {
    badges.push('<span class="presence-badge is-curated">PUBLIE</span>')
  }
  if (docsCount > 0) badges.push('<span class="presence-badge">DOCS</span>')
  if (mediaCount > 0) badges.push('<span class="presence-badge">MEDIA</span>')

  return badges.length ? `<span class="result-presence-row">${badges.join('')}</span>` : ''
}

function priceConfidenceTier(game) {
  if (!game.loosePrice) return null
  const conf = Number(game.sourceConfidence)
  if (conf >= 0.7) return 'T1 Fiable'
  if (conf >= 0.5) return 'T2 Estime'
  if (conf > 0) return 'T3 Indicatif'
  return 'Prix estime'
}

function buildPriceAgeChip(game) {
  const raw = String(game?.priceLastUpdated || game?.price_last_updated || '').trim()
  if (!raw) return null
  const ageDays = Math.floor((Date.now() - new Date(raw).getTime()) / 86400000)
  if (!Number.isFinite(ageDays) || ageDays < 0) return null
  const label = ageDays === 0 ? 'auj' : ageDays < 60 ? `${ageDays}j` : ageDays < 365 ? `${Math.round(ageDays / 30)}m` : `${Math.round(ageDays / 365)}a`
  const tier = ageDays <= 14 ? 'fresh' : ageDays <= 60 ? 'mid' : 'stale'
  const sourceNames = String(game?.sourceNames || '').trim()
  const title = sourceNames
    ? `Prix mis a jour il y a ${ageDays}j — ${sourceNames}`
    : `Prix mis a jour il y a ${ageDays} jour(s)`
  return { label, tier, title }
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
  const loosePrice = showPrice ? (game.loosePrice ? `$${Math.round(game.loosePrice)}` : '-') : ''
  const confidenceTier = priceConfidenceTier(game)
  const collectionStateNorm = String(collectionState || '').toLowerCase()
  const showOwnedBadge = collectionStateNorm === 'owned'
  const showWantedBadge = collectionStateNorm === 'wanted'
  const showSaleBadge = collectionStateNorm === 'for_sale'

  const coverUrl = game.cover_url || game.coverImage || ''
  const coverHtml = coverUrl
    ? `<img class="result-cover" src="${escapeHtml(coverUrl)}" alt="" loading="lazy" />`
    : `<div class="result-cover result-cover-placeholder"><span>${escapeHtml((game.title || '?')[0].toUpperCase())}</span></div>`

  el.innerHTML = `
    ${coverHtml}
    <div class="result-info">
      <span class="result-title" title="${escapeHtml(game.title || '')}">${escapeHtml(game.title || '')}${showOwnedBadge ? '<span class="result-owned-badge">POSSEDE</span>' : ''}${showWantedBadge ? '<span class="result-collection-badge is-wanted">WISHLIST</span>' : ''}${showSaleBadge ? '<span class="result-collection-badge is-sale">EN VENTE</span>' : ''}</span>
      <span class="result-meta-row">
        <span class="result-meta">${consoleName ? escapeHtml(consoleName) : '—'} &middot; ${escapeHtml(year)}</span>
      </span>
    </div>
    <div class="result-signal">
      ${showPrice ? `
        <span class="result-price-group">
          <span class="result-price result-price-loose"${confidenceTier ? ` title="Prix loose · ${escapeHtml(confidenceTier)}"` : ''}>${loosePrice}</span>
        </span>` : ''}
      <span class="result-metascore"></span>
      ${showRarity ? `<span class="result-rarity" style="color:${rarityColors[rarity] || 'var(--text-muted)'}">${escapeHtml(rarity || 'COMMON')}</span>` : ''}
    </div>
  `

  if (window.RetroDexAssets && game.console) {
    const img = window.RetroDexAssets.createSupportImg(game.console, 16)
    img.classList.add('result-support-icon')
    const metaRowEl = el.querySelector('.result-meta-row')
    if (metaRowEl) metaRowEl.insertBefore(img, metaRowEl.firstChild)
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

  const metascoreEl = el.querySelector('.result-metascore')
  if (metascoreEl) {
    if (window.RetroDexMetascore && game.metascore) {
      const badge = window.RetroDexMetascore.renderBadge(game.metascore, 'micro')
      const label = window.RetroDexMetascore.getLabel(game.metascore)
      badge.title = `Metascore : ${game.metascore}/100 | ${label}`
      badge.addEventListener('mouseenter', () => {
        window.RetroDexExperience?.showStatus?.(`METASCORE ${game.metascore}/100 | ${label}`)
      })
      metascoreEl.appendChild(badge)
    } else {
      metascoreEl.innerHTML = '<span class="result-metascore-empty">-</span>'
    }
  }

  return el
}

if (typeof module !== 'undefined') module.exports = { renderGameRow }
