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

function renderGameRow(game, options = {}) {
  const {
    linkTo = 'game-detail',
    showPrice = true,
    showRarity = false,
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
  const contentSignals = window.RetroDexContentSignals?.buildRichness
    ? window.RetroDexContentSignals.buildRichness(game)
    : null
  const loosePrice = showPrice ? (game.loosePrice ? `$${Math.round(game.loosePrice)}` : '-') : ''
  const showOwnedBadge = String(collectionState || '').toLowerCase() === 'owned'
  const archiveBadges = [
    contentSignals ? `<span class="presence-badge is-richness is-${escapeHtml(contentSignals.band.key)}">${escapeHtml(contentSignals.band.shortLabel)}</span>` : '',
    contentSignals ? `<span class="presence-badge is-state">État ${escapeHtml(contentSignals.completionState.shortLabel)}</span>` : '',
    contentSignals ? `<span class="presence-badge is-state">Confiance ${escapeHtml(contentSignals.confidence.shortLabel)}</span>` : '',
  ].filter(Boolean).join('')
  const summary = String(game.summary || game.synopsis || game.tagline || '').trim()
  const summaryHtml = summary
    ? `<span class="result-summary">${escapeHtml(summary.length > 116 ? `${summary.slice(0, 116).trimEnd()}...` : summary)}</span>`
    : ''

  el.innerHTML = `
    <span class="result-row-indicator">&rsaquo;</span>
    <div class="result-info">
      <span class="result-title" title="${escapeHtml(game.title || '')}">${escapeHtml(game.title || '')}${showOwnedBadge ? '<span class="result-owned-badge">COLLECTION</span>' : ''}</span>
      <span class="result-meta-row">
        <span class="result-meta">${escapeHtml(consoleName)} &middot; ${escapeHtml(year)}</span>
      </span>
      ${archiveBadges ? `<span class="result-presence-row result-archive-row">${archiveBadges}</span>` : ''}
      ${summaryHtml}
    </div>
    <div class="result-signal">
      ${showPrice ? `<span class="result-price">${loosePrice}</span>` : ''}
      <span class="result-metascore"></span>
      ${showRarity && rarity ? `<span class="result-rarity" style="color:${rarityColors[rarity] || 'var(--text-muted)'}">${escapeHtml(rarity)}</span>` : ''}
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

if (typeof window !== 'undefined') window.renderGameRow = renderGameRow
if (typeof module !== 'undefined') module.exports = { renderGameRow }
