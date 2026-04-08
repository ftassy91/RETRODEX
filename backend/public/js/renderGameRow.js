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
  const contentSignals = window.RetroDexContentSignals?.buildRichness
    ? window.RetroDexContentSignals.buildRichness(game)
    : null
  const loosePrice = showPrice ? (game.loosePrice ? `$${Math.round(game.loosePrice)}` : '-') : ''
  const cibPrice = showPrice && game.cibPrice ? `$${Math.round(game.cibPrice)}` : null
  const mintPrice = showPrice && game.mintPrice ? `$${Math.round(game.mintPrice)}` : null
  const confidenceTier = priceConfidenceTier(game)
  const collectionStateNorm = String(collectionState || '').toLowerCase()
  const showOwnedBadge = collectionStateNorm === 'owned'
  const showWantedBadge = collectionStateNorm === 'wanted'
  const showSaleBadge = collectionStateNorm === 'for_sale'
  const archiveBadge = contentSignals
    ? `<span class="presence-badge is-richness is-${escapeHtml(contentSignals.band.key)}">${escapeHtml(contentSignals.band.shortLabel)}</span>`
    : ''
  const relationCue = String(game.developer || game.publisher || '').trim()
  const relationHtml = relationCue
    ? `<span class="result-context-row">Studio ${escapeHtml(relationCue)}</span>`
    : ''
  function truncateText(text, max) {
    if (!text) return '';
    const clean = String(text).replace(/<[^>]+>/g, '').trim();
    return clean.length > max ? clean.slice(0, max) + '\u2026' : clean;
  }
  const synopsisSnippet = truncateText(game.synopsis || game.summary, 90);
  const summaryHtml = synopsisSnippet
    ? `<span class="game-row-synopsis">${escapeHtml(synopsisSnippet)}</span>`
    : ''

  el.innerHTML = `
    <span class="result-row-indicator">&rsaquo;</span>
    <div class="result-info">
      <span class="result-title" title="${escapeHtml(game.title || '')}">${escapeHtml(game.title || '')}${showOwnedBadge ? '<span class="result-owned-badge">POSSEDE</span>' : ''}${showWantedBadge ? '<span class="result-collection-badge is-wanted">WISHLIST</span>' : ''}${showSaleBadge ? '<span class="result-collection-badge is-sale">EN VENTE</span>' : ''}</span>
      <span class="result-meta-row">
        <span class="result-meta">${escapeHtml(consoleName)} &middot; ${escapeHtml(year)}${genre ? ` &middot; ${escapeHtml(genre)}` : ''}</span>
      </span>
      ${archiveBadge ? `<span class="result-presence-row result-archive-row">${archiveBadge}</span>` : ''}
      ${relationHtml}
      ${summaryHtml}
      ${renderPresenceBadges(game)}
    </div>
    <div class="result-signal">
      ${showPrice ? `
        <span class="result-price-group">
          <span class="result-price result-price-loose"${confidenceTier ? ` title="Prix loose · ${escapeHtml(confidenceTier)}"` : ''}>${loosePrice}</span>
          ${(cibPrice || mintPrice) ? `<span class="result-price-secondary">${cibPrice ? `<span class="result-price-cib" title="Prix CIB">${cibPrice}</span>` : ''}${mintPrice ? `<span class="result-price-mint" title="Prix Mint">${mintPrice}</span>` : ''}</span>` : ''}
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
