'use strict'

const CoreFormat = window.RetroDexFormat || {}
const CoreApi = window.RetroDexApi || {}
const CoreState = window.RetroDexState || {}
const ContentSignals = window.RetroDexContentSignals || {}
const runtimeMonitor = window.RetroDexRuntimeMonitor?.createPageMonitor?.('game-detail')

const heroEl = document.getElementById('hero')
const statsRowEl = document.getElementById('stats-row')
const collectionStateEl = document.getElementById('collection-state')
const collectionCurrentMetaEl = document.getElementById('collection-current-meta')
const collectionButtonEl = document.getElementById('collection-button')
const wishlistButtonEl = document.getElementById('wishlist-button')
const collectionRemoveButtonEl = document.getElementById('collection-remove-button')
const collectionFormEl = document.getElementById('collection-form')
const collectionConditionEl = document.getElementById('collection-condition')
const collectionCompletenessEl = document.getElementById('collection-completeness')
const collectionQualificationConfidenceEl = document.getElementById('collection-qualification-confidence')
const collectionPricePaidEl = document.getElementById('collection-price-paid')
const collectionPurchaseDateEl = document.getElementById('collection-purchase-date')
const collectionRegionEl = document.getElementById('collection-region')
const collectionEditionNoteEl = document.getElementById('collection-edition-note')
const collectionNotesEl = document.getElementById('collection-notes')
const collectionStatusEl = document.getElementById('collection-status')
const contribConditionEl = document.getElementById('contrib-condition')
const contribPriceEl = document.getElementById('contrib-price')
const contribContextEl = document.getElementById('contrib-context')
const contribDateEl = document.getElementById('contrib-date')
const contribNoteEl = document.getElementById('contrib-note')
const contribSubmitEl = document.getElementById('contrib-submit')
const contribFeedbackEl = document.getElementById('contrib-feedback')
const catalogBackLinkEl = document.getElementById('catalog-back-link')
const breadcrumbTitleEl = document.getElementById('breadcrumb-title')
const detailShellEl = document.querySelector('.detail-shell, main, .content')
const editorialShellEl = document.getElementById('editorial-shell')
const editorialContentEl = document.getElementById('editorial-content')
const relatedShellEl = document.getElementById('related-shell')
const relatedContentEl = document.getElementById('related-content')

let currentGame = null
let currentCollectionItem = null
let currentEncyclopediaData = null
let currentArchiveData = null
let currentGameDetailData = null
let currentRenderedDetailTabs = new Set()
let currentDetailHydrationRequest = 0
let currentFullDetailSchedule = null
const HUB_IMAGE_VERSION = '20260323b'
let hubImageManifestPromise = null

const PRICE_HISTORY_STATES = [
  { key: 'loose', label: 'Loose', condition: 'Loose', color: '#9bbc0f' },
  { key: 'cib', label: 'CIB', condition: 'CIB', color: '#f1c45c' },
  { key: 'mint', label: 'Mint', condition: 'Mint', color: '#7fb0ff' },
]

const DEFAULT_PRICE_HISTORY_PERIOD = '1y'
const EMPTY_STATE_CLASS = 'detail-empty-inline'

function resolveGameMeta(game) {
  return {
    consoleName: game.consoleData?.name || game.console || 'Console inconnue',
    consoleSlug: game.consoleData?.slug || game.consoleId || '',
    developerName: game.developerCompany?.name || game.developer || 'studio inconnu',
    publisherName: game.publisherCompany?.name
      || (game.publisher && game.publisher !== 'undefined' ? game.publisher : null),
    genreName: (game.genres?.[0]?.name) || game.genre || '',
  }
}

function escapeHtml(value) {
  if (typeof CoreFormat.escapeHtml === 'function') {
    return CoreFormat.escapeHtml(value)
  }

  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function parseStructuredValue(value, fallback = null) {
  if (value == null || value === '') {
    return fallback
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return value
  }

  if (typeof value !== 'string') {
    return fallback
  }

  try {
    return JSON.parse(value)
  } catch (_error) {
    return value
  }
}

function parseStructuredArray(value) {
  const parsed = parseStructuredValue(value, null)
  if (Array.isArray(parsed)) {
    return parsed
  }
  if (parsed == null || parsed === '') {
    return []
  }
  return [parsed]
}

function formatDurationValue(value) {
  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric > 0) {
    const rounded = Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1).replace(/\.0$/, '')
    return `${rounded}h`
  }

  const text = String(value || '').trim()
  if (!text) {
    return ''
  }

  return /h$/i.test(text) ? text : `${text}h`
}

function buildEmptyStateHtml(label) {
  return `<span class="${EMPTY_STATE_CLASS}">${escapeHtml(label)}</span>`
}

function hasIndexedPrice(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0
}

function formatPrice(value, fallback = 'Non indexe', currency) {
  if (!hasIndexedPrice(value)) return fallback
  const rounded = Math.round(Number(value))
  if (currency === 'EUR') return `\u20AC${rounded}`
  if (currency === 'USD') return `$${rounded}`
  if (currency) return `${rounded} ?`
  return `$${rounded}`
}

function formatPriceHtml(value, fallback = 'Non indexe') {
  return hasIndexedPrice(value) ? escapeHtml(formatPrice(value)) : buildEmptyStateHtml(fallback)
}

function formatDecisionValue(value) {
  return hasIndexedPrice(value) ? formatPrice(value) : 'Non indexe'
}

function buildDecisionPriceSummary(game) {
  const parts = []
  if (hasIndexedPrice(game?.loosePrice)) {
    parts.push(`Loose ${formatDecisionValue(game.loosePrice)}`)
  }
  if (hasIndexedPrice(game?.cibPrice)) {
    parts.push(`CIB ${formatDecisionValue(game.cibPrice)}`)
  }
  if (hasIndexedPrice(game?.mintPrice)) {
    parts.push(`Mint ${formatDecisionValue(game.mintPrice)}`)
  }

  return parts.length ? parts.join(' | ') : 'Non indexe'
}

function computeCollectionDecision(game, item) {
  const listType = item ? normalizeCollectionListType(item.list_type) : null
  const owned = listType === 'owned' || listType === 'for_sale'
  const wanted = listType === 'wanted'
  const condition = String(item?.condition || '').trim()
  const completeness = getQualificationCompleteness(item)
  const qualificationConfidence = getQualificationConfidence(item)
  const pricePaid = Number(item?.price_paid || 0)
  const loosePrice = Number(game?.loosePrice || 0)
  const cibPrice = Number(game?.cibPrice || 0)
  const hasLoosePrice = hasIndexedPrice(loosePrice)
  const hasCibPrice = hasIndexedPrice(cibPrice)
  const cibDelta = hasLoosePrice && hasCibPrice ? cibPrice - loosePrice : null

  let actionLabel = 'CONSERVER'
  let actionNote = 'Position conservee. Aucun signal fort detecte.'
  let actionTone = ''

  if (owned && (completeness === 'unknown' || qualificationConfidence === 'unknown' || qualificationConfidence === 'low')) {
    actionLabel = 'QUALIFIER'
    actionNote = 'Verifier edition, region, completude et confiance avant d utiliser la valeur comme signal fort.'
    actionTone = 'is-primary'
  } else if (owned && completeness === 'partial') {
    actionLabel = 'COMPLETER'
    actionNote = 'L entree est partielle. Completer avant d arbitrer la valeur ou l upgrade.'
    actionTone = 'is-primary'
  } else if (listType === 'for_sale' || (owned && pricePaid > 0 && hasLoosePrice && loosePrice >= pricePaid * 1.5)) {
    actionLabel = 'A VENDRE'
    actionNote = pricePaid > 0
      ? 'La valeur loose depasse le prix paye de 50% ou plus.'
      : 'Le jeu est deja marque a vendre.'
    actionTone = 'is-hot'
  } else if (owned && condition === 'Loose' && Number.isFinite(cibDelta) && cibDelta <= 20) {
    actionLabel = 'UPGRADER'
    actionNote = 'Le delta Loose -> CIB reste sous $20.'
    actionTone = 'is-primary'
  } else if (wanted && hasLoosePrice && loosePrice <= 25) {
    actionLabel = 'ACHETER'
    actionNote = 'Wishlist active et valeur loose sous $25.'
    actionTone = 'is-hot'
  }

  return {
    possessionLabel: owned ? 'Oui' : 'Non',
    interestLabel: listType === 'wanted' ? 'Wishlist' : listType === 'for_sale' ? 'A vendre' : 'Aucun',
    conditionLabel: item ? (condition || 'Loose') : 'n/a',
    qualificationLabel: item ? getQualificationLabel(item) : 'Aucune entree',
    qualificationConfidenceLabel: item ? getQualificationConfidenceLabel(item) : 'inconnue',
    valueLabel: buildDecisionPriceSummary(game),
    actionLabel,
    actionNote,
    actionTone,
    stateLabel: owned ? 'Possede' : wanted ? 'Soutenu' : 'Aucun suivi',
  }
}

function formatMetascoreHtml(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0
    ? escapeHtml(String(Math.round(numeric)))
    : buildEmptyStateHtml('Non note')
}

function formatDurationHtml(value) {
  const duration = formatDurationValue(value)
  return duration ? escapeHtml(duration) : buildEmptyStateHtml('Non renseigne')
}

function buildGameCardMeta(consoleName, year) {
  const parts = [String(consoleName || '').trim(), String(year || '').trim()].filter(Boolean)
  return parts.length ? parts.map((part) => escapeHtml(part)).join(' &middot; ') : ''
}

function buildGameCardCoverHtml(game) {
  const coverImage = String(game?.coverImage || game?.cover_url || '').trim()
  if (coverImage) {
    return `<img src="${escapeHtml(coverImage)}" alt="${escapeHtml(game?.title || 'Game')} cover" class="game-card-cover" width="48" height="48" loading="lazy" />`
  }

  const initial = String(game?.title || '?').trim().charAt(0).toUpperCase() || '?'
  return `<span class="game-card-placeholder">${escapeHtml(initial)}</span>`
}

function formatCount(value, singular, plural = `${singular}s`) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) {
    return `0 ${plural}`
  }

  return `${number} ${number === 1 ? singular : plural}`
}

function formatMultilineHtml(value, fallback = 'n/a') {
  const text = String(value || '').trim()
  if (!text) {
    return escapeHtml(fallback)
  }

  return escapeHtml(text).replace(/\r?\n/g, '<br />')
}

function generateCoverPlaceholder(title, rarity, consoleName) {
  const initials = String(title || '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(' ')
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')

  const colors = {
    LEGENDARY: '#1a3a1a',
    EPIC: '#2a1a00',
    RARE: '#1a1a2a',
    UNCOMMON: '#0f1510',
    COMMON: '#0a0f0a',
  }

  const bg = colors[String(rarity || '').toUpperCase()] || '#0a0f0a'
  const platformLabel = String(consoleName || '').toUpperCase().slice(0, 12)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
    <rect width="160" height="160" fill="${bg}"/>
    <rect x="1" y="1" width="158" height="158" fill="none" stroke="#1e2e1e" stroke-width="1"/>
    <text x="80" y="76" text-anchor="middle" font-family="BigBlueTerminal" font-size="42" font-weight="normal" fill="#00ff66" opacity="0.82">${initials || '?'}</text>
    <text x="80" y="100" text-anchor="middle" font-family="BigBlueTerminal" font-size="9" fill="#486648">${platformLabel}</text>
  </svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function rarityClass(value) {
  return String(value || 'COMMON').toLowerCase()
}

function conditionClass(value) {
  const normalized = String(value || 'Loose').toLowerCase()
  return normalized === 'mint' ? 'mint' : normalized === 'cib' ? 'cib' : 'loose'
}

function normalizeCollectionListType(value) {
  const normalized = String(value || 'owned').trim().toLowerCase()
  if (normalized === 'wanted' || normalized === 'for_sale') {
    return normalized
  }
  return 'owned'
}

function getCollectionNote(item) {
  return String(item?.personal_note || item?.notes || '').trim()
}

function getQualificationCompleteness(item) {
  return String(item?.completeness || 'unknown').trim().toLowerCase() || 'unknown'
}

function getQualificationConfidence(item) {
  return String(item?.qualification_confidence || 'unknown').trim().toLowerCase() || 'unknown'
}

function getQualificationLabel(item) {
  const completeness = getQualificationCompleteness(item)
  if (completeness === 'cib') return 'Entree qualifiee CIB'
  if (completeness === 'sealed') return 'Entree qualifiee scellee'
  if (completeness === 'partial') return 'Qualification partielle'
  if (completeness === 'loose') return 'Entree qualifiee loose'
  return 'A qualifier'
}

function getQualificationConfidenceLabel(item) {
  const confidence = getQualificationConfidence(item)
  if (confidence === 'high') return 'haute'
  if (confidence === 'medium') return 'moyenne'
  if (confidence === 'low') return 'faible'
  return 'inconnue'
}

function getGameId() {
  if (typeof CoreState.getParam === 'function') {
    return CoreState.getParam('id') || CoreState.getParam('slug') || ''
  }

  var params = new URLSearchParams(window.location.search)
  return params.get('id') || params.get('slug') || ''
}

function truncateMetaDescription(value, maxLength = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (text.length <= maxLength) return text

  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`
}

function setMetaContent(selector, content) {
  const el = document.querySelector(selector)
  if (el) {
    el.setAttribute('content', content)
  }
}

function updateSeoMeta(game) {
  const title = `${game.title || 'Fiche jeu'} | RetroDex`
  const description = truncateMetaDescription(
    game.tagline
    || game.summary
    || `${game.title || 'Ce jeu retro'} sur ${game.consoleData?.name || game.console || 'console inconnue'}${game.year ? ` (${game.year})` : ''}. Prix, rarete et encyclopedie RetroDex.`
  )

  document.title = title
  setMetaContent('meta[name="description"]', description)
  setMetaContent('meta[property="og:title"]', title)
  setMetaContent('meta[property="og:description"]', description)
}

function loadHubImageManifest() {
  if (!hubImageManifestPromise) {
    hubImageManifestPromise = fetch(`/assets/hub_pixel_art/_manifest.json?v=${HUB_IMAGE_VERSION}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : []))
      .catch(() => [])
  }

  return hubImageManifestPromise
}

async function getPreferredIllustrationPath(game) {
  const manifest = await loadHubImageManifest()
  if (!Array.isArray(manifest)) return ''

  const gameId = game?.id
  const gameSlug = game?.slug

  const entry = manifest.find((item) => {
    if (!item) return false
    if (gameId && item.game_id === gameId) return true
    if (gameSlug && item.slug === gameSlug) return true
    return false
  })

  if (entry?.file) {
    return `/assets/hub_pixel_art/${entry.file}?v=${HUB_IMAGE_VERSION}`
  }

  return ''
}

function buildCatalogueBackLink() {
  const params = new URLSearchParams(window.location.search)
  const source = params.get('source')
  params.delete('id')
  params.delete('source')
  const query = params.toString()

  if (source === 'search') {
    catalogBackLinkEl.href = query ? `/search.html?${query}` : '/search.html'
    catalogBackLinkEl.textContent = 'RECHERCHE'
    return
  }

  catalogBackLinkEl.href = query ? `/games-list.html?${query}` : '/games-list.html'
  catalogBackLinkEl.textContent = 'CATALOGUE'
}

async function fetchJson(url, options) {
  if (typeof CoreApi.fetchJson === 'function') {
    return CoreApi.fetchJson(url, options)
  }

  const response = await fetch(url, options)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `${response.status} ${response.statusText}`)
  }

  return response.json()
}

function showSkeleton() {
  heroEl.innerHTML = `
    <div class="hero-grid">
      <div>
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-line-medium"></div>
        <div class="skeleton skeleton-line-short"></div>
        <div class="skeleton skeleton-line-full"></div>
      </div>
      <div>
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-line-full"></div>
        <div class="skeleton skeleton-line-medium"></div>
      </div>
    </div>
  `
  if (statsRowEl) {
    statsRowEl.innerHTML = `
      <div class="skeleton skeleton-line-full"></div>
      <div class="skeleton skeleton-line-full"></div>
      <div class="skeleton skeleton-line-full"></div>
      <div class="skeleton skeleton-line-full"></div>
    `
  }

  if (editorialShellEl) {
    editorialShellEl.hidden = true
  }

  if (relatedShellEl) {
    relatedShellEl.hidden = true
  }
}

function buildPossessionChip(item) {
  if (!item) return '<span class="possession-chip is-untracked">NON SUIVI</span>';
  const listType = item.list_type;
  if (listType === 'owned') return '<span class="possession-chip is-owned">POSSEDE</span>';
  if (listType === 'for_sale') return '<span class="possession-chip is-sale">EN VENTE</span>';
  if (listType === 'wanted') return '<span class="possession-chip is-wanted">WISHLIST</span>';
  return '';
}

function buildQualificationChip(item) {
  if (!item || normalizeCollectionListType(item.list_type) === 'wanted') {
    return ''
  }

  const confidence = getQualificationConfidence(item)
  const modifier = confidence === 'high'
    ? ' is-owned'
    : confidence === 'medium'
      ? ' is-wanted'
      : ' is-untracked'

  return `<span class="possession-chip${modifier}">${escapeHtml(getQualificationLabel(item).toUpperCase())}</span>`
}

function renderHeroSection(game) {
  const meta = resolveGameMeta(game)
  const summary = String(game.summary || game.synopsis || '').trim()
  const metascoreValue = game.metascore ? String(game.metascore) : 'n/a'
  const hasAnyPrice = (game.loosePrice || game.cibPrice || game.mintPrice)
  const trustMeta = getTrustMeta(game.priceConfidenceTier)
  const priceContext = buildHeroPriceContext(game, trustMeta)
  const pricePanel = hasAnyPrice
    ? `<div class="detail-hero-price-panel">
        <div class="detail-hero-price-row">
          ${game.loosePrice ? `<div class="detail-hero-price-cell"><span class="detail-hero-price-label">Loose</span><span class="detail-hero-price-value">${escapeHtml(formatPrice(game.loosePrice, '', game.priceCurrency))}</span></div>` : ''}
          ${game.cibPrice ? `<div class="detail-hero-price-cell"><span class="detail-hero-price-label">CIB</span><span class="detail-hero-price-value">${escapeHtml(formatPrice(game.cibPrice, '', game.priceCurrency))}</span></div>` : ''}
          ${game.mintPrice ? `<div class="detail-hero-price-cell"><span class="detail-hero-price-label">Mint</span><span class="detail-hero-price-value">${escapeHtml(formatPrice(game.mintPrice, '', game.priceCurrency))}</span></div>` : ''}
        </div>
      </div>`
    : '<span class="detail-hero-reference is-empty">Marche secondaire</span>'

  heroEl.innerHTML = `
    <div class="detail-hero-shell">
      <div class="detail-hero-status"><span class="terminal-preview-label">FICHE</span></div>

      <div class="hero-grid detail-hero-grid detail-hero-grid-tight">
        <section class="game-header detail-identity-panel">
          <div class="game-header-main">
            <div class="game-cover-slot">
              <div class="game-cover-container">
                <img id="game-cover-img" src="" alt="${escapeHtml(game.title || 'Game')} cover" width="220" height="290" />
              </div>
            </div>

            <div class="game-header-copy">
              <div class="detail-hero-title-row">
                <h1 class="hero-title page-title detail-hero-title">${escapeHtml(game.title)}</h1>
                <span class="rarity-badge rarity-${escapeHtml(rarityClass(game.rarity))} detail-hero-rarity">${escapeHtml(game.rarity || 'COMMON')}</span>
              </div>

              <div class="detail-hero-meta-strip">
                <span class="detail-hero-meta-value">${escapeHtml(meta.consoleName)}</span>
                <span>|</span>
                <span class="detail-hero-meta-value">${escapeHtml(game.year || 'n/a')}</span>
                <span>|</span>
                <span id="hero-metascore-value" class="detail-hero-meta-value">${game.metascore ? escapeHtml(metascoreValue) : buildEmptyStateHtml('Non note')}</span>
              </div>

              <div class="detail-hero-developer">
                ${meta.developerName && meta.developerName !== 'studio inconnu'
                  ? `<a class="detail-studio-link" href="${buildRelationCatalogUrl({ q: meta.developerName }, 'developer', meta.developerName)}" title="Voir tous les jeux de ${escapeHtml(meta.developerName)}">${escapeHtml(meta.developerName)}</a>`
                  : escapeHtml(meta.developerName)}
              </div>

              <span id="hero-possession-chip">${buildPossessionChip(currentCollectionItem)}${buildQualificationChip(currentCollectionItem)}${!currentCollectionItem ? '<a href="/collection.html" class="detail-add-cta">+ ajouter a la collection</a>' : ''}</span>

              <div id="hero-summary-shell" class="hero-summary-shell"${summary ? '' : ' hidden'}>
                <div id="hero-summary" class="hero-summary surface-summary-copy">${summary ? formatMultilineHtml(summary) : ''}</div>
              </div>
              <p id="hero-reading-state" class="detail-reading-state">Chargement de la lecture...</p>

              <div class="game-tagline-shell" id="game-tagline-shell" hidden>
                <span class="detail-inline-label">Note</span>
                <div class="game-tagline" id="game-tagline"></div>
              </div>

              <div id="game-relations" class="game-relations"></div>
              <div class="surface-action-row detail-hero-actions">
                <a class="terminal-action-link" href="/games-list.html">Retour au catalogue &rarr;</a>
                <a class="terminal-action-link is-primary" href="#editorial-shell">Ouvrir l'archive &rarr;</a>
              </div>
            </div>
          </div>
        </section>

        <aside class="detail-market-panel detail-hero-aside">
          <div class="detail-kicker">DECISION</div>
          ${priceContext}
          ${pricePanel}
          <div id="collection-decision-strip" class="detail-decision-strip">
            <div class="detail-kicker">COLLECTION</div>
            <div id="collection-decision-grid" class="surface-signal-grid is-five detail-decision-grid"></div>
            <p id="collection-decision-note" class="detail-reading-note"></p>
          </div>
        </aside>
      </div>
    </div>
  `

  if (window.RetroDexAssets && game.console) {
    const metaStripEl = heroEl.querySelector('.detail-hero-meta-strip')
    if (metaStripEl) {
      const supportWrapEl = document.createElement('span')
      supportWrapEl.className = 'detail-console-support-wrap'
      const img = window.RetroDexAssets.createSupportImg(game.console, 18)
      img.classList.add('detail-console-support-icon')
      supportWrapEl.appendChild(img)
      metaStripEl.insertBefore(supportWrapEl, metaStripEl.firstChild)
    }
  }

  if (window.RetroDexMetascore) {
    const heroMetaEl = document.getElementById('hero-metascore-value')
    if (heroMetaEl && game.metascore) {
      heroMetaEl.textContent = `${game.metascore} | ${window.RetroDexMetascore.getLabel(game.metascore)}`
      heroMetaEl.style.color = window.RetroDexMetascore.getColor(game.metascore)
    }
  }

  renderCollectionDecisionStrip()
}

function buildDetailContentSignals() {
  if (!currentGame || typeof ContentSignals.buildRichness !== 'function') {
    return null
  }

  return ContentSignals.buildRichness(currentGame, {
    detail: currentGameDetailData,
    archive: currentArchiveData,
    encyclopedia: currentEncyclopediaData,
  })
}

function buildHeroSignalCard(label, value, modifier = '') {
  return `
    <div class="surface-signal-card${modifier ? ` ${modifier}` : ''}">
      <span class="surface-signal-label">${escapeHtml(label)}</span>
      <span class="surface-signal-value">${escapeHtml(value)}</span>
    </div>
  `
}

function renderCollectionDecisionStrip(options = {}) {
  const decisionGridEl = document.getElementById('collection-decision-grid')
  const decisionNoteEl = document.getElementById('collection-decision-note')
  if (!decisionGridEl || !decisionNoteEl || !currentGame) {
    return
  }

  if (options.error) {
    decisionGridEl.innerHTML = `
      <div class="surface-signal-card is-primary">
        <span class="surface-signal-label">STATUT</span>
        <span class="surface-signal-value">Indisponible</span>
      </div>
      <div class="surface-signal-card">
        <span class="surface-signal-label">QUALIFICATION</span>
        <span class="surface-signal-value">Indisponible</span>
      </div>
      <div class="surface-signal-card">
        <span class="surface-signal-label">VALEUR</span>
        <span class="surface-signal-value">Indisponible</span>
      </div>
      <div class="surface-signal-card">
        <span class="surface-signal-label">CONFIANCE</span>
        <span class="surface-signal-value">Indisponible</span>
      </div>
      <div class="surface-signal-card surface-signal-card--action">
        <span class="surface-signal-label">ACTION</span>
        <span class="surface-signal-value surface-signal-action-value">Indisponible</span>
      </div>
    `
    decisionNoteEl.textContent = 'Lecture collection indisponible.'
    return
  }

  const decision = computeCollectionDecision(currentGame, currentCollectionItem)
  const actionClass = decision.actionTone || ''

  decisionGridEl.innerHTML = `
    <div class="surface-signal-card is-primary">
      <span class="surface-signal-label">STATUT</span>
      <span class="surface-signal-value">${escapeHtml(decision.possessionLabel)}</span>
    </div>
    <div class="surface-signal-card">
      <span class="surface-signal-label">QUALIFICATION</span>
      <span class="surface-signal-value">${escapeHtml(decision.qualificationLabel)}</span>
    </div>
    <div class="surface-signal-card">
      <span class="surface-signal-label">VALEUR</span>
      <span class="surface-signal-value">${escapeHtml(decision.valueLabel)}</span>
    </div>
    <div class="surface-signal-card">
      <span class="surface-signal-label">CONFIANCE</span>
      <span class="surface-signal-value">${escapeHtml(`${decision.qualificationConfidenceLabel} | ${getPriceTrustSummary(currentGame)} | ${getPriceFreshnessMeta(currentGame?.priceLastUpdated)?.label || 'fraicheur inconnue'}`)}</span>
    </div>
    <div class="surface-signal-card surface-signal-card--action${actionClass ? ` ${actionClass}` : ''}">
      <span class="surface-signal-label">ACTION</span>
      <span class="surface-signal-value surface-signal-action-value">${escapeHtml(decision.actionLabel)}</span>
      ${decision.actionLabel === 'A VENDRE' && currentCollectionItem && normalizeCollectionListType(currentCollectionItem.list_type) !== 'for_sale'
        ? '<button id="action-mark-for-sale-btn" class="decision-action-btn" type="button" onclick="handleMarkForSale()">MARQUER A VENDRE</button>'
        : decision.actionLabel === 'QUALIFIER' || decision.actionLabel === 'COMPLETER'
          ? `<button id="action-open-qualification-btn" class="decision-action-btn" type="button">${decision.actionLabel === 'COMPLETER' ? 'COMPLETER CETTE ENTREE' : 'QUALIFIER CETTE ENTREE'}</button>`
          : ''}
    </div>
  `
  decisionNoteEl.textContent = decision.actionNote || 'Lecture de collection en cours.'

  const openQualificationBtn = document.getElementById('action-open-qualification-btn')
  if (openQualificationBtn) {
    openQualificationBtn.addEventListener('click', () => {
      setCollectionAccordionOpen(true)
      collectionCompletenessEl?.focus()
    })
  }
}

function renderDetailContentStatus() {
  const readingStateEl = document.getElementById('hero-reading-state')
  if (!readingStateEl) {
    return
  }

  const signals = buildDetailContentSignals()
  if (!signals) {
    readingStateEl.textContent = 'Lecture en cours de qualification.'
    return
  }

  const anecdoteCount = Array.isArray(currentEncyclopediaData?.dev_anecdotes)
    ? currentEncyclopediaData.dev_anecdotes.length
    : 0
  const readingParts = [
    `Lecture ${signals.band.shortLabel.toLowerCase()}`,
    signals.band.note,
  ]
  if (anecdoteCount > 0) {
    readingParts.push(`${anecdoteCount} anecdote${anecdoteCount > 1 ? 's' : ''} de developpement`)
  }
  readingStateEl.textContent = readingParts.filter(Boolean).join(' \u00B7 ')
}

function confidenceClass(value) {
  const pct = Number(value) || 0
  if (pct >= 70) return 'confidence-high'
  if (pct >= 30) return 'confidence-mid'
  return 'confidence-low'
}

function getTrustMeta(tierOrPct) {
  const str = String(tierOrPct || '').toLowerCase()
  if (str === 'high') return { tier: 'T1', label: 'VERIFIE' }
  if (str === 'medium') return { tier: 'T2', label: 'FIABLE' }
  if (str === 'low') return { tier: 'T3', label: 'INDICATIF' }
  // Numeric fallback for price index panel (confidence_pct from sales data)
  const pct = Number(tierOrPct) || 0
  if (pct >= 80) return { tier: 'T1', label: 'VERIFIE' }
  if (pct >= 60) return { tier: 'T2', label: 'FIABLE' }
  if (pct >= 30) return { tier: 'T3', label: 'INDICATIF' }
  if (pct >= 10) return { tier: 'T3', label: 'INDICATIF' }
  return { tier: 'T0', label: 'INCONNU' }
}

function getTrustBadgeText(tier) {
  if (tier === 'T1') return 'DONNEES VERIFIEES | TIER T1'
  if (tier === 'T2') return 'DONNEES CROISEES | TIER T2'
  return 'ESTIMATION | PEU DE DONNEES'
}

function getPriceTrustSummary(game) {
  const tier = String(game?.priceConfidenceTier || '').toLowerCase()
  if (tier === 'high') return 'prix T1 fiable'
  if (tier === 'medium') return 'prix T2 estime'
  if (tier === 'low') return 'prix T3 indicatif'
  return 'prix non qualifie'
}

function getTrustBadgeStyle() {
  return ''
}

function getFreshnessLabel(value) {
  const freshness = String(value || '').toLowerCase()
  if (freshness === 'recent') return 'signal recent'
  if (freshness === 'aging') return 'signal en veille'
  if (freshness === 'stale') return 'signal vieillissant'
  return 'signal ancien'
}

function getPriceFreshnessMeta(priceLastUpdated) {
  if (!priceLastUpdated) {
    return null
  }

  const updated = new Date(priceLastUpdated)
  if (Number.isNaN(updated.getTime())) {
    return null
  }

  const daysAgo = Math.floor((Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24))
  const monthsAgo = Math.max(1, Math.round(daysAgo / 30))

  if (daysAgo <= 30) {
    return {
      label: 'tres frais',
      detail: `${daysAgo} j`,
      dateText: formatTrustDate(priceLastUpdated),
    }
  }

  if (daysAgo <= 90) {
    return {
      label: 'a surveiller',
      detail: `${daysAgo} j`,
      dateText: formatTrustDate(priceLastUpdated),
    }
  }

  return {
    label: 'ancien',
    detail: `${monthsAgo} mois`,
    dateText: formatTrustDate(priceLastUpdated),
  }
}

function buildHeroPriceContext(game, trustMeta) {
  const freshnessMeta = getPriceFreshnessMeta(game?.priceLastUpdated)
  const trustTier = trustMeta?.tier || 'T0'
  const shouldShowContext = trustTier !== 'T0' || freshnessMeta
  const sourceNames = String(game?.sourceNames || '').trim()
  const qualificationWarning = currentCollectionItem
    && (getQualificationCompleteness(currentCollectionItem) === 'unknown' || ['unknown', 'low'].includes(getQualificationConfidence(currentCollectionItem)))
    ? 'Valeur indicative tant que l entree n est pas qualifiee.'
    : ''

  if (!shouldShowContext) {
    return ''
  }

  const diamondTierMap = { high: 5, medium: 3, low: 1 }
  const diamondCount = diamondTierMap[String(game.priceConfidenceTier || '').toLowerCase()] || 0
  const diamondStr = diamondCount > 0
    ? `<span class="trust-diamonds" style="color:var(--text-muted);margin-left:8px;letter-spacing:1px">${'\u25C6'.repeat(diamondCount)}${'\u25C7'.repeat(5 - diamondCount)}</span>`
    : ''

  return `
    <div class="detail-hero-price-context">
      <div class="detail-price-context-row">
        <span class="detail-hero-reference">Fiabilite prix</span>
        <span class="trust-badge trust-${escapeHtml(trustTier)}" style="${escapeHtml(getTrustBadgeStyle(trustTier))}"${game.priceConfidenceReason ? ` title="${escapeHtml(game.priceConfidenceReason)}"` : ''}>${escapeHtml(getTrustBadgeText(trustTier))}</span>${diamondStr}
        ${freshnessMeta ? `<span class="detail-hero-reference">Fraicheur</span><span class="detail-hero-reference">${escapeHtml(freshnessMeta.label)} \u00B7 ${escapeHtml(freshnessMeta.detail)}</span>` : ''}
      </div>
      ${freshnessMeta?.dateText ? `<div class="detail-hero-price-date">Mis a jour : ${escapeHtml(freshnessMeta.dateText)}</div>` : ''}
      ${buildPriceFreshnessAlert(game?.priceLastUpdated)}
      ${sourceNames ? `<div class="detail-hero-sources">Sources : ${escapeHtml(sourceNames)}</div>` : ''}
      ${qualificationWarning ? `<div class="detail-hero-price-help is-warning">${escapeHtml(qualificationWarning)}</div>` : ''}
      <div class="detail-hero-price-help">Repere marche : croiser avec l'etat reel, la fraicheur et l'historique.</div>
    </div>
  `
}

function buildPriceFreshnessAlert(priceLastUpdated) {
  if (!priceLastUpdated) return ''
  const updated = new Date(priceLastUpdated)
  if (isNaN(updated.getTime())) return ''
  const daysAgo = Math.floor((Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24))
  if (daysAgo <= 90) return ''
  const months = Math.floor(daysAgo / 30)
  return `<div class=”price-freshness-alert”>PRIX MIS A JOUR IL Y A ${months} MOIS -- VERIFIER AVANT DECISION</div>`
}

function formatTrustDate(value) {
  if (!value) {
    return ''
  }

  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function buildTrustSource(entries, confidence) {
  if (!entries.length) {
    return 'aucune donnee - contribuez un prix'
  }

  const sourcesEditorial = Math.max(0, ...entries.map((entry) => Number(entry.sources_editorial) || 0))
  const latestSaleDate = entries
    .map((entry) => entry.last_sale_date || '')
    .filter(Boolean)
    .sort()
    .at(-1)

  if (sourcesEditorial > 0) {
    const formattedDate = formatTrustDate(latestSaleDate)
    return `${sourcesEditorial} vente(s) verifiee(s) | derniere obs. : ${formattedDate || 'date inconnue'}`
  }

  if ((Number(confidence) || 0) >= 0) {
    return 'Aucune vente verifiee -- prix calcule par reference'
  }

  return 'aucune donnee - contribuez un prix'
}

function formatIndexRange(low, high, currency) {
  const lowNumber = Number(low)
  const highNumber = Number(high)
  if (!Number.isFinite(lowNumber) || !Number.isFinite(highNumber) || lowNumber <= 0 || highNumber <= 0) {
    return 'n/a'
  }

  return `${formatPrice(lowNumber, '', currency)} - ${formatPrice(highNumber, '', currency)}`
}

async function loadGameRegions(gameId) {
  const chipsEl = document.getElementById('hero-region-chips')
  if (!chipsEl) return

  try {
    const payload = await fetchJson(`/api/games/${encodeURIComponent(gameId)}/regions`)
    const regions = (payload.regions || []).slice(0, 6)
    if (!regions.length) return

    chipsEl.innerHTML = regions
      .map((r) => `<span class="region-chip region-${escapeHtml(r)}">${escapeHtml(r)}</span>`)
      .join('')
  } catch (err) {
    console.error('[game-detail] loadGameRegions failed for game', gameId, err)
  }
}

async function loadRetrodexIndex(gameId) {
  const indexEl = document.getElementById('retrodex-index')
  if (!indexEl) {
    return
  }

  indexEl.innerHTML = '<div class="index-loading">Chargement des prix...</div>'

  try {
    const payload = await fetchJson(`/api/games/${encodeURIComponent(gameId)}/index`)
    const entries = safeArray(payload.index)
    const hasUsableIndex = entries.some((entry) => (Number(entry.index_value) || 0) > 0)

    if (!entries.length || !hasUsableIndex) {
      indexEl.className = 'index-insufficient'
      indexEl.textContent = 'Donnees insuffisantes - contribuez un prix'
      return
    }

    const orderedEntries = ['Loose', 'CIB', 'Mint'].map((condition) => {
      const found = entries.find((entry) => String(entry.condition || '').toLowerCase() === condition.toLowerCase())
      return found != null ? { ...found, condition } : { condition }
    })
    const primaryEntry = orderedEntries.find((entry) => entry.condition === 'Loose' && (Number(entry.index_value) || 0) > 0)
      || orderedEntries.find((entry) => (Number(entry.index_value) || 0) > 0)
      || orderedEntries[0]
    const confidence = Math.round(Math.max(...entries.map((entry) => Number(entry.confidence_pct) || 0)))
    const trustMeta = getTrustMeta(confidence)
    const trustSource = buildTrustSource(entries, confidence)
    const sourcesEditorial = Math.max(0, ...entries.map((entry) => Number(entry.sources_editorial) || 0))
    const sourcesCommunity = Math.max(0, ...entries.map((entry) => Number(entry.sources_community) || 0))
    const freshest = entries
      .map((entry) => String(entry.freshness || '').trim())
      .filter(Boolean)
      .sort((left, right) => {
        const order = { recent: 0, aging: 1, stale: 2, outdated: 3 }
        return (order[left] ?? 9) - (order[right] ?? 9)
      })[0] || 'outdated'

    indexEl.className = 'retrodex-index'
    indexEl.innerHTML = `
      <div class="index-header">
        <div>
          <span class="index-title">INDICE RETRODEX</span>
          <span class="index-subtitle">Reference collector</span>
        </div>
        <span class="confidence ${confidenceClass(confidence)}">${confidence}% confiance</span>
      </div>
      <div class="index-primary">
        <span class="index-primary-label">REFERENCE</span>
          <span class="index-primary-value">${formatPriceHtml(primaryEntry.index_value, 'Prix non indexe')}</span>
        <span class="index-primary-meta">${escapeHtml(primaryEntry.condition || 'n/a')} | ${escapeHtml(formatIndexRange(primaryEntry.range_low, primaryEntry.range_high, currentGame?.priceCurrency))}</span>
      </div>
      <div class="trust-header">
        <span class="trust-badge trust-${trustMeta.tier}" style="${escapeHtml(getTrustBadgeStyle(trustMeta.tier))}">${escapeHtml(getTrustBadgeText(trustMeta.tier))}</span>
        <span class="trust-source">${escapeHtml(trustSource)}</span>
      </div>
      <div class="trust-support-row">
        <span class="trust-freshness">${escapeHtml(getFreshnessLabel(freshest))}</span>
        <span class="index-sources">${sourcesEditorial} ventes | 0 listings | ${sourcesCommunity} contributions</span>
      </div>
      <div class="index-prices">
        ${orderedEntries.map((entry) => `
          <div class="index-condition ${entry.condition === primaryEntry.condition ? 'is-primary' : ''}">
            <span class="label">${escapeHtml(entry.condition || 'n/a')}</span>
            <span class="value">${formatPriceHtml(entry.index_value)}</span>
            <span class="range">${escapeHtml(formatIndexRange(entry.range_low, entry.range_high, currentGame?.priceCurrency))}</span>
          </div>
        `).join('')}
      </div>
    `
  } catch (err) {
    console.warn('[game-detail] loadRetrodexIndex failed for game', gameId, err.message)
    indexEl.innerHTML = ''
  }
}

function isImageLikeUrl(value) {
  return /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(String(value || '').trim())
}

function renderOverviewCard(data = {}) {
  const facts = [
    ['Plateforme', data.platform],
    ['Annee', data.year],
    ['Genre', data.genre],
    ['Rarete', data.rarity],
    ['Developpeur', data.developer],
    ['Editeur', data.publisher],
    ['Metascore', data.metascore],
    ['Main', data.game_length?.main],
    ['Complet', data.game_length?.complete],
  ].filter(([, value]) => value != null && String(value).trim() !== '')

  return `
    <article class="detail-domain-block">
      <div class="detail-domain-heading">Vue d'ensemble</div>
      ${data.cover?.external_url ? `
        <div class="detail-overview-cover">
          <a class="detail-media-preview-link" href="${escapeHtml(data.cover.external_url)}" target="_blank" rel="noopener noreferrer">
            <img
              src="${escapeHtml(data.cover.preview_url || data.cover.external_url)}"
              alt="${escapeHtml(data.title || 'Cover')}"
              class="detail-media-preview detail-overview-cover-img"
              loading="lazy"
            />
          </a>
        </div>
      ` : ''}
      ${data.summary ? `
        <div class="detail-domain-subblock">
          <span class="archive-label">Resume</span>
          <div class="archive-lore">${formatMultilineHtml(data.summary)}</div>
        </div>
      ` : ''}
      ${data.synopsis && data.synopsis !== data.summary ? `
        <div class="detail-domain-subblock">
          <span class="archive-label">Synopsis</span>
          <div class="archive-lore">${formatMultilineHtml(data.synopsis)}</div>
        </div>
      ` : ''}
      ${facts.length ? `
        <div class="detail-overview-facts">
          ${facts.map(([label, value]) => `
            <div class="detail-overview-fact">
              <span class="detail-overview-fact-label">${escapeHtml(label)}</span>
              <span class="detail-overview-fact-value">${escapeHtml(String(value))}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </article>
  `
}

function renderRichTextBlocks(blocks = []) {
  return blocks.map((block) => `
    <article class="detail-domain-block">
      <div class="detail-domain-heading">${escapeHtml(block.title || 'Texte')}</div>
      <div class="archive-lore">${formatMultilineHtml(block.text || '')}</div>
    </article>
  `).join('')
}

function renderCharacterList(items = []) {
  return `
    <article class="detail-domain-block">
      <div class="detail-domain-heading">Personnages</div>
      ${items.map((item) => `
        <div class="archive-character-row">
          <span class="archive-char-name">${escapeHtml(item.name || 'Inconnu')}</span>
          <span class="archive-char-role">${escapeHtml(item.role || '')}</span>
          <span class="archive-char-desc">${escapeHtml(item.description || '')}</span>
        </div>
      `).join('')}
    </article>
  `
}

function renderPeopleList(items = []) {
  return `
    <article class="detail-domain-block">
      <div class="detail-domain-heading">Equipe</div>
      ${items.map((item) => `
        <div class="encyclo-team-row">
          <span class="team-role">${escapeHtml(item.role || item.roleLabel || item.type || 'Equipe')}</span>
          <span class="team-name">${escapeHtml(item.name || 'Inconnu')}</span>
          ${item.note ? `<span class="team-note">${escapeHtml(item.note)}</span>` : ''}
        </div>
      `).join('')}
    </article>
  `
}

function renderCodeList(items = []) {
  return `
    <article class="detail-domain-block">
      <div class="detail-domain-heading">Codes</div>
      ${items.map((item) => `
        <div class="encyclo-cheat-row">
          <span class="cheat-name">${escapeHtml(item.label || 'Code')}</span>
          <span class="cheat-code">${escapeHtml(item.code || '--')}</span>
          <span class="cheat-effect">${escapeHtml(item.effect || '')}</span>
        </div>
      `).join('')}
    </article>
  `
}

function renderRecordList(items = []) {
  return `
    <article class="detail-domain-block">
      <div class="detail-domain-heading">Records</div>
      ${items.map((item) => `
        <div class="detail-record-row">
          <span class="detail-record-label">${escapeHtml(item.label || 'Record')}</span>
          <span class="detail-record-value">${escapeHtml(item.value || '')}</span>
          ${item.runner ? `<span class="detail-record-meta">${escapeHtml(item.runner)}</span>` : ''}
          ${item.source ? `<span class="detail-record-meta">${escapeHtml(item.source)}</span>` : ''}
          ${item.url ? `<a class="detail-record-meta" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Leaderboard</a>` : ''}
        </div>
      `).join('')}
    </article>
  `
}

function renderFactList(items = []) {
  return `
    <article class="detail-domain-block">
      <div class="detail-domain-heading">Development</div>
      <div class="detail-fact-list">
        ${items.map((item) => `
          <div class="detail-fact-row">
            <span class="detail-fact-label">${escapeHtml(item.label || 'Info')}</span>
            <span class="detail-fact-value">${escapeHtml(item.note || '')}</span>
          </div>
        `).join('')}
      </div>
    </article>
  `
}

function renderAnecdoteList(items = []) {
  return `
    <article class="detail-domain-block">
      <div class="detail-domain-heading">Anecdotes</div>
      ${items.map((item) => `
        <div class="encyclo-anecdote">
          <div class="anecdote-title">${escapeHtml(item.title || 'Note')}</div>
          <div class="anecdote-text">${formatMultilineHtml(item.text || '')}</div>
        </div>
      `).join('')}
    </article>
  `
}

function renderOstBlock(block = {}) {
  return `
    ${block.composers?.length ? `
      <article class="detail-domain-block">
        <div class="detail-domain-heading">Compositeurs</div>
        ${block.composers.map((item) => `
          <div class="encyclo-team-row">
            <span class="team-role">${escapeHtml(item.role || 'Compositeur')}</span>
            <span class="team-name">${escapeHtml(item.name || 'Inconnu')}</span>
          </div>
        `).join('')}
      </article>
    ` : ''}
    ${block.tracks?.length ? `
      <article class="detail-domain-block">
        <div class="detail-domain-heading">Tracks</div>
        <div class="archive-ost-tracks">
          <ul>${block.tracks.map((track) => `<li>${escapeHtml(track.title || '')}</li>`).join('')}</ul>
        </div>
      </article>
    ` : ''}
    ${block.releases?.length ? `
      <article class="detail-domain-block">
        <div class="detail-domain-heading">Releases</div>
        <div class="detail-ost-release-list">
          ${block.releases.map((release) => `
            <div class="detail-ost-release-row">
              <span class="detail-ost-release-title">${escapeHtml(release.name || 'OST')}</span>
              <span class="detail-ost-release-meta">
                ${escapeHtml([
                  release.releaseYear || '',
                  release.format || '',
                  release.label || '',
                  release.trackCount ? `${release.trackCount} tracks` : '',
                ].filter(Boolean).join(' | ') || 'Metadonnees partielles')}
              </span>
            </div>
          `).join('')}
        </div>
      </article>
    ` : ''}
  `
}

function renderMediaGallery(block = {}) {
  const titleMap = {
    manual: 'Manuals',
    map: 'Maps',
    sprite_sheet: 'Sprites',
    ending: 'Ending',
    asset: 'Assets',
  }

  return `
    <article class="detail-domain-block">
      <div class="detail-domain-heading">${escapeHtml(titleMap[block.mediaType] || 'Media')}</div>
      <div class="detail-media-gallery">
        ${(block.items || []).map((item) => {
          const previewUrl = item.preview_url || item.embed_url || ''
          const showImage = previewUrl && isImageLikeUrl(previewUrl)
          const canEmbedDoc = block.mediaType === 'manual' && item.embed_url
          return `
            <div class="detail-media-card">
              <div class="detail-media-card-head">
                <span class="detail-media-kind">${escapeHtml(item.title || titleMap[block.mediaType] || 'Reference')}</span>
                ${item.provider ? `<span class="detail-media-row-meta">${escapeHtml(item.provider)}</span>` : ''}
              </div>
              ${canEmbedDoc ? `
                <div class="detail-media-embed-shell">
                  <iframe
                    class="detail-media-embed"
                    src="${escapeHtml(item.embed_url)}"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                    title="${escapeHtml(item.title || 'Manual')}"
                  ></iframe>
                </div>
              ` : showImage ? `
                <a class="detail-media-preview-link" href="${escapeHtml(item.external_url)}" target="_blank" rel="noopener noreferrer">
                  <img
                    src="${escapeHtml(previewUrl)}"
                    alt="${escapeHtml(item.title || 'Media')}"
                    class="detail-media-preview"
                    loading="lazy"
                  />
                </a>
              ` : ''}
              <a class="terminal-action-link detail-media-link" href="${escapeHtml(item.external_url)}" target="_blank" rel="noopener noreferrer">
                Ouvrir la reference ->
              </a>
            </div>
          `
        }).join('')}
      </div>
    </article>
  `
}

function renderGameDetailBlock(block) {
  if (!block) {
    return ''
  }

  if (block.type === 'overview') return renderOverviewCard(block.data || {})
  if (block.type === 'text') return renderRichTextBlocks([block])
  if (block.type === 'character-list') return renderCharacterList(block.items || [])
  if (block.type === 'people-list') return renderPeopleList(block.items || [])
  if (block.type === 'code-list') return renderCodeList(block.items || [])
  if (block.type === 'record-list') return renderRecordList(block.items || [])
  if (block.type === 'fact-list') return renderFactList(block.items || [])
  if (block.type === 'anecdote-list') return renderAnecdoteList(block.items || [])
  if (block.type === 'ost') return renderOstBlock(block)
  if (block.type === 'media-gallery') return renderMediaGallery(block)
  return ''
}

function renderDynamicEditorialPanel(tab) {
  const blocks = Array.isArray(tab?.content) ? tab.content : []
  if (!blocks.length) {
    return `<div class="detail-empty-state">Aucune donnee publiee pour cette section.</div>`
  }

  return blocks.map((block) => renderGameDetailBlock(block)).join('')
}

function renderDynamicEditorialContent() {
  if (!editorialShellEl || !editorialContentEl || !currentGameDetailData) {
    return false
  }

  const sections = Array.isArray(currentGameDetailData.tabs) ? currentGameDetailData.tabs : []
  if (!sections.length) {
    editorialShellEl.hidden = true
    editorialContentEl.innerHTML = ''
    return true
  }

  const currentActiveTab = editorialContentEl.querySelector('.detail-editorial-tab.active')?.dataset.tab
  const activeTab = sections.some((section) => section.id === currentActiveTab)
    ? currentActiveTab
    : sections[0].id

  const detailScope = String(currentGameDetailData.meta?.scope || 'full').toLowerCase()
  const detailSubcopy = detailScope === 'primary'
    ? 'donnees principales chargees'
    : 'fiche complete'

  currentRenderedDetailTabs = new Set()
  editorialShellEl.hidden = false
  editorialContentEl.innerHTML = `
    <div class="detail-editorial-head">
      <div class="detail-domain-eyebrow">GameDetail / Encyclopedia</div>
      <div class="detail-domain-subcopy">${escapeHtml(detailSubcopy)}</div>
    </div>
    <div class="detail-editorial-tabs">
      ${sections.map((section) => `
        <button type="button" class="detail-editorial-tab ${section.id === activeTab ? 'active' : ''}" data-tab="${section.id}">
          ${escapeHtml(section.name)}
        </button>
      `).join('')}
    </div>
    <div class="detail-editorial-panels">
      ${sections.map((section) => `
        <section class="detail-editorial-panel" data-panel="${section.id}" ${section.id === activeTab ? '' : 'hidden'}></section>
      `).join('')}
    </div>
  `

  activateEditorialTab(activeTab)
  editorialContentEl.querySelectorAll('.detail-editorial-tab').forEach((button) => {
    button.addEventListener('click', () => activateEditorialTab(button.dataset.tab))
  })

  return true
}

function activateEditorialTab(tabId) {
  editorialContentEl.querySelectorAll('.detail-editorial-tab').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tabId)
  })

  editorialContentEl.querySelectorAll('.detail-editorial-panel').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tabId
  })

  if (currentGameDetailData) {
    const panelEl = editorialContentEl.querySelector(`.detail-editorial-panel[data-panel="${tabId}"]`)
    if (panelEl && !currentRenderedDetailTabs.has(tabId)) {
      const tab = (currentGameDetailData.tabs || []).find((entry) => entry.id === tabId)
      panelEl.innerHTML = renderDynamicEditorialPanel(tab)
      currentRenderedDetailTabs.add(tabId)
    }
  }
}

function normalizeContributor(member, fallbackRole = '') {
  if (!member) {
    return null
  }

  if (typeof member === 'string') {
    const name = member.trim()
    return name ? { name, role: fallbackRole, note: '' } : null
  }

  const name = String(member.name || member.full_name || member.person || '').trim()
  if (!name) {
    return null
  }

  return {
    name,
    role: String(member.role || fallbackRole || '').trim(),
    note: String(member.note || member.description || '').trim(),
  }
}

function buildContributorRows(devTeam = [], composers = []) {
  const rows = []
  const seen = new Set()

  const pushContributor = (entry, fallbackRole = '') => {
    const person = normalizeContributor(entry, fallbackRole)
    if (!person) {
      return
    }

    const dedupeKey = person.name.toLowerCase()
    if (seen.has(dedupeKey)) {
      return
    }

    seen.add(dedupeKey)
    rows.push(person)
  }

  safeArray(devTeam).forEach((member) => pushContributor(member))
  safeArray(composers).forEach((member) => pushContributor(member, 'Compositeur'))

  return rows.slice(0, 10)
}

function normalizeProductionCompany(entry) {
  const item = parseStructuredValue(entry, entry)
  if (!item) {
    return null
  }

  if (typeof item === 'string') {
    const name = item.trim()
    return name ? { name, role: '', roleLabel: '', country: '', confidence: 0 } : null
  }

  const name = String(item.name || '').trim()
  if (!name) {
    return null
  }

  return {
    name,
    role: String(item.role || '').trim(),
    roleLabel: String(item.roleLabel || item.role || '').trim(),
    country: String(item.country || '').trim(),
    confidence: Number(item.confidence || 0),
  }
}

function formatProductionRole(value) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return 'Production'
  }

  return normalized
}

function formatMediaTypeLabel(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'cover') return 'Cover'
  if (normalized === 'manual') return 'Notice'
  if (normalized === 'archive_item') return 'Archive.org'
  if (normalized === 'youtube_video') return 'YouTube'
  if (normalized === 'screenshot') return 'Screenshot'
  if (normalized === 'screenshots') return 'Screenshots'
  if (normalized === 'box_art') return 'Box Art'
  if (normalized === 'artwork') return 'Artwork'

  return normalized
    ? normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    : 'Reference'
}

function formatComplianceLabel(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'approved') return 'APPROUVE'
  if (normalized === 'approved_with_review') return 'APPROUVE + REVUE'
  if (normalized === 'reference_only') return 'REFERENCE ONLY'
  if (normalized === 'needs_review') return 'A VERIFIER'
  if (normalized === 'blocked') return 'BLOQUE'
  if (normalized === 'mixed') return 'MIXTE'
  if (normalized === 'missing') return 'MANQUANT'
  return normalized ? normalized.toUpperCase() : 'INCONNU'
}

function complianceClass(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'approved') return 'is-approved'
  if (normalized === 'approved_with_review' || normalized === 'needs_review') return 'is-review'
  if (normalized === 'reference_only' || normalized === 'mixed') return 'is-reference'
  if (normalized === 'blocked') return 'is-blocked'
  return 'is-unknown'
}

function buildProductionPanel() {
  const archive = currentArchiveData || {}
  const encyclo = currentEncyclopediaData || {}
  const fallbackGame = currentGame || {}
  const production = parseStructuredValue(archive.production, archive.production) || {}
  const developers = parseStructuredArray(production.developers).map(normalizeProductionCompany).filter(Boolean)
  const publishers = parseStructuredArray(production.publishers).map(normalizeProductionCompany).filter(Boolean)
  const studios = parseStructuredArray(production.studios).map(normalizeProductionCompany).filter(Boolean)
  const companies = parseStructuredArray(production.companies).map(normalizeProductionCompany).filter(Boolean)
  const roleEntries = parseStructuredArray(production.roles).map((entry) => parseStructuredValue(entry, entry)).filter(Boolean)
  const devTeam = buildContributorRows(
    parseStructuredArray(production.dev_team || encyclo.dev_team || fallbackGame.dev_team),
    []
  )
  const fallbackDeveloper = String(fallbackGame.developer || '').trim()

  if (!developers.length && fallbackDeveloper) {
    developers.push({
      name: fallbackDeveloper,
      role: 'developer',
      roleLabel: 'Developpement',
      country: '',
      confidence: 0,
    })
  }

  const blocks = []

  const buildCompanyList = (label, entries, emptyLabel) => `
    <article class="detail-production-block">
      <div class="detail-production-block-label">${escapeHtml(label)}</div>
      ${entries.length ? `
        <div class="detail-production-list">
          ${entries.map((entry) => `
            <div class="detail-production-item">
              <span class="detail-production-item-name">${escapeHtml(entry.name)}</span>
              <span class="detail-production-item-meta">
                ${escapeHtml(entry.roleLabel || formatProductionRole(entry.role || label))}
                ${entry.country ? ` | ${escapeHtml(entry.country)}` : ''}
                ${entry.confidence > 0 ? ` | ${escapeHtml(`${Math.round(entry.confidence * 100)}%`)}` : ''}
              </span>
            </div>
          `).join('')}
        </div>
      ` : `<div class="detail-empty-state">${escapeHtml(emptyLabel)}</div>`}
    </article>
  `

  blocks.push(buildCompanyList('Developpeur', developers, 'Developpement non renseigne'))
  blocks.push(buildCompanyList('Editeur', publishers, 'Edition non renseignee'))
  blocks.push(buildCompanyList('Studios', studios, 'Studio non renseigne'))

  const roleHtml = roleEntries.length
    ? roleEntries.map((entry) => `
        <span class="detail-production-role-chip">
          ${escapeHtml(entry.label || formatProductionRole(entry.role))}${entry.count ? ` | ${escapeHtml(String(entry.count))}` : ''}
        </span>
      `).join('')
    : companies.length
      ? companies.map((entry) => `
          <span class="detail-production-role-chip">
            ${escapeHtml(entry.roleLabel || formatProductionRole(entry.role))}
          </span>
        `).join('')
      : ''

  const teamHtml = devTeam.length
    ? devTeam.map((member) => `
        <div class="detail-production-team-row">
          <span class="team-role">${escapeHtml(member.role || 'Equipe')}</span>
          <span class="team-name">${escapeHtml(member.name)}</span>
          ${member.note ? `<span class="team-note">${escapeHtml(member.note)}</span>` : ''}
        </div>
      `).join('')
    : `<div class="detail-empty-state">Aucun credit d'equipe structure</div>`

  return `
    <section class="detail-production-panel">
      <div class="detail-production-head">
        <div>
          <div class="detail-domain-eyebrow">Production</div>
          <div class="detail-domain-subcopy">studios - roles - credits - societes</div>
        </div>
        ${roleHtml ? `<div class="detail-production-role-row">${roleHtml}</div>` : ''}
      </div>
      <div class="detail-production-grid">
        ${blocks.join('')}
      </div>
      <article class="detail-production-block detail-production-block-wide">
        <div class="detail-production-block-label">Credits / equipe</div>
        <div class="detail-production-team">
          ${teamHtml}
        </div>
      </article>
    </section>
  `
}

function buildLoreCharactersTab() {
  const archive = currentArchiveData || {}
  const encyclo = currentEncyclopediaData || {}
  const fallbackGame = currentGame || {}
  const summaryText = String(encyclo.summary || fallbackGame.summary || '').trim()
  const synopsisText = String(encyclo.synopsis || fallbackGame.synopsis || '').trim()
  const loreText = String(archive.lore || fallbackGame.lore || '').trim()
  const gameplayText = String(archive.gameplay_description || fallbackGame.gameplay_description || '').trim()
  const anecdotes = parseStructuredArray(encyclo.dev_anecdotes || fallbackGame.dev_anecdotes)
  const cheatCodes = parseStructuredArray(encyclo.cheat_codes || fallbackGame.cheat_codes)
  const characters = parseStructuredArray(archive.characters || fallbackGame.characters)
  const versions = parseStructuredArray(archive.versions || fallbackGame.versions)
  const speedrun = parseStructuredValue(archive.speedrun_wr || fallbackGame.speedrun_wr, null)
  const mainDuration = formatDurationValue(archive.duration?.main || fallbackGame.avg_duration_main)
  const completeDuration = formatDurationValue(archive.duration?.complete || fallbackGame.avg_duration_complete)
  const blocks = []

  if (summaryText || synopsisText || loreText || gameplayText) {
    blocks.push(`
      <article class="detail-domain-block">
        <div class="detail-domain-heading">Lecture</div>
        ${summaryText ? `<div class="archive-lore">${formatMultilineHtml(summaryText)}</div>` : ''}
        ${synopsisText && synopsisText !== summaryText ? `
          <div class="detail-domain-subblock">
            <span class="archive-label">Synopsis</span>
            <div class="archive-lore">${formatMultilineHtml(synopsisText)}</div>
          </div>
        ` : ''}
        ${loreText ? `
          <div class="detail-domain-subblock">
            <span class="archive-label">Lore</span>
            <div class="archive-lore">${formatMultilineHtml(loreText)}</div>
          </div>
        ` : ''}
        ${gameplayText ? `
          <div class="detail-domain-subblock">
            <span class="archive-label">Gameplay</span>
            <div class="archive-gameplay">${formatMultilineHtml(gameplayText)}</div>
          </div>
        ` : ''}
      </article>
    `)
  }

  if (mainDuration || completeDuration || versions.length || speedrun?.time || speedrun?.value) {
    const durationParts = [
      mainDuration ? `Main ${escapeHtml(mainDuration)}` : `Main ${buildEmptyStateHtml('Non renseigne')}`,
      completeDuration ? `Complet ${escapeHtml(completeDuration)}` : '',
    ].filter(Boolean)

    blocks.push(`
      <article class="detail-domain-block">
        <div class="detail-domain-heading">Progression</div>
        <div class="archive-duration">${durationParts.length ? durationParts.join(' | ') : buildEmptyStateHtml('Aucune duree')}</div>
        ${(speedrun?.time || speedrun?.value) ? `<div class="archive-speedrun"><span class="archive-label">WR</span> ${escapeHtml(speedrun.category || 'Any%')} : ${escapeHtml(speedrun.time || speedrun.value)}${speedrun.runner ? ` | ${escapeHtml(speedrun.runner)}` : ''}</div>` : ''}
        ${versions.length ? `
          <div class="archive-ost-tracks">
            <span class="archive-label">Versions</span>
            <ul>${versions.map((version) => `<li>${escapeHtml(typeof version === 'string' ? version : version.name || version.label || '')}</li>`).join('')}</ul>
          </div>
        ` : ''}
      </article>
    `)
  }

  if (characters.length) {
    blocks.push(`
      <article class="detail-domain-block">
        <div class="detail-domain-heading">Personnages</div>
        ${characters.map((character) => {
          const item = parseStructuredValue(character, character)
          if (typeof item === 'string') {
            return `<div class="archive-character-row"><span class="archive-char-name">${escapeHtml(item)}</span></div>`
          }

          return `
            <div class="archive-character-row">
              <span class="archive-char-name">${escapeHtml(item.name || 'Inconnu')}</span>
              <span class="archive-char-role">${escapeHtml(item.role || '')}</span>
              <span class="archive-char-desc">${escapeHtml(item.description || '')}</span>
            </div>
          `
        }).join('')}
      </article>
    `)
  }

  if (anecdotes.length) {
    blocks.push(`
      <article class="detail-domain-block">
        <div class="detail-domain-heading">Anecdotes de developpement</div>
        ${anecdotes.map((entry, index) => {
          const note = parseStructuredValue(entry, entry)
          const title = typeof note === 'object' ? note.title || note.label : `Note ${index + 1}`
          const text = typeof note === 'object' ? note.text || note.note || note.description || '' : note
          return `
            <div class="encyclo-anecdote">
              <div class="anecdote-title">${escapeHtml(title || `Note ${index + 1}`)}</div>
              <div class="anecdote-text">${formatMultilineHtml(text)}</div>
            </div>
          `
        }).join('')}
      </article>
    `)
  }

  if (cheatCodes.length) {
    blocks.push(`
      <article class="detail-domain-block">
        <div class="detail-domain-heading">Codes</div>
        ${cheatCodes.map((code) => {
          const item = parseStructuredValue(code, code)
          if (typeof item === 'string') {
            return `<div class="encyclo-cheat-row"><span class="cheat-effect">${escapeHtml(item)}</span></div>`
          }

          return `
            <div class="encyclo-cheat-row">
              <span class="cheat-name">${escapeHtml(item.label || item.name || 'Code')}</span>
              <span class="cheat-code">${escapeHtml(item.code || item.value || '--')}</span>
              <span class="cheat-effect">${escapeHtml(item.effect || item.description || '')}</span>
            </div>
          `
        }).join('')}
      </article>
    `)
  }

  return blocks.length
    ? blocks.join('')
    : `<div class="detail-empty-state">Aucune donnee lore, personnages ou editoriale publiee pour ce jeu.</div>`
}

function buildMediaDocsTab() {
  const archive = currentArchiveData || {}
  const fallbackGame = currentGame || {}
  const media = parseStructuredValue(archive.media, archive.media) || {}
  const manuals = parseStructuredArray(media.manuals)
  const references = parseStructuredArray(media.references)
  const variants = parseStructuredArray(media.variants)
  const covers = parseStructuredArray(media.covers)
  const screenshots = parseStructuredArray(media.screenshots)
  const items = parseStructuredArray(media.items)
  const compliance = parseStructuredValue(media.complianceSummary, media.complianceSummary) || {}
  const summaryBadge = `
    <span class="detail-compliance-badge ${complianceClass(compliance.status)}">
      ${escapeHtml(formatComplianceLabel(compliance.status))}
    </span>
  `
  const visibleManuals = manuals.length ? manuals : (archive.manual_url || fallbackGame.manual_url ? [{ mediaType: 'manual', url: archive.manual_url || fallbackGame.manual_url }] : [])
  const visualAssetCount = variants.length || Math.max(0, covers.length - 1) + screenshots.length
  const itemSource = items.length ? [...items] : []

  if (!itemSource.length) {
    itemSource.push(...visibleManuals)
  } else if (visibleManuals.length) {
    visibleManuals.forEach((entry) => {
      const item = parseStructuredValue(entry, entry) || {}
      const mediaType = item.mediaType || item.media_type || 'reference'
      const url = item.url || ''
      if (!itemSource.some((candidate) => {
        const parsedCandidate = parseStructuredValue(candidate, candidate) || {}
        return (parsedCandidate.mediaType || parsedCandidate.media_type || 'reference') === mediaType
          && String(parsedCandidate.url || '') === String(url)
      })) {
        itemSource.push(entry)
      }
    })
  }

  if (!items.length && !visibleManuals.length && !covers.length && !screenshots.length && !references.length && !visualAssetCount) {
    return `<div class="detail-empty-state">Aucune notice ou reference media publiee pour ce jeu.</div>`
  }

  const itemRows = itemSource.map((entry) => {
    const item = parseStructuredValue(entry, entry) || {}
    const mediaType = item.mediaType || item.media_type || 'reference'
    const provider = item.providerLabel || item.provider || 'Source interne'
    const complianceStatus = item.complianceStatus || item.compliance_status || compliance.status || 'missing'
    const storageMode = item.storageMode || item.storage_mode || ''

    return `
      <div class="detail-media-row">
        <div class="detail-media-row-head">
          <span class="detail-media-kind">${escapeHtml(formatMediaTypeLabel(mediaType))}</span>
          <span class="detail-compliance-badge ${complianceClass(complianceStatus)}">${escapeHtml(formatComplianceLabel(complianceStatus))}</span>
        </div>
        <div class="detail-media-row-meta">${escapeHtml(String(provider))}${storageMode ? ` | ${escapeHtml(String(storageMode))}` : ''}</div>
        <a class="terminal-action-link detail-media-link" href="${escapeHtml(item.url || '')}" target="_blank" rel="noopener noreferrer">
          Ouvrir la reference ->
        </a>
      </div>
    `
  }).join('')

  return `
    <article class="detail-domain-block">
      <div class="detail-domain-heading">Conformite & inventaire</div>
      <div class="detail-media-summary">
        ${summaryBadge}
        <span>${escapeHtml(`${manuals.length || visibleManuals.length} notice(s)`)}</span>
        <span>${escapeHtml(`${covers.length} cover(s)`)}</span>
        <span>${escapeHtml(`${visualAssetCount} variante(s)`)}</span>
        <span>${escapeHtml(`${screenshots.length} screenshot(s)`)}</span>
        <span>${escapeHtml(`${references.length} reference(s) externe(s)`)}</span>
      </div>
    </article>
    <article class="detail-domain-block">
      <div class="detail-domain-heading">References publiees</div>
      <div class="detail-media-list">
        ${itemRows}
      </div>
    </article>
  `
}

function buildMusicTab() {
  const archive = currentArchiveData || {}
  const fallbackGame = currentGame || {}
  const composers = buildContributorRows([], parseStructuredArray(archive.ost?.composers || fallbackGame.ost_composers))
  const tracks = parseStructuredArray(archive.ost?.notable_tracks || fallbackGame.ost_notable_tracks)
  const releases = parseStructuredArray(archive.ost?.releases)

  if (!composers.length && !tracks.length && !releases.length) {
    return `<div class="detail-empty-state">Aucune donnee OST structuree publiee pour ce jeu.</div>`
  }

  return `
    ${composers.length ? `
      <article class="detail-domain-block">
        <div class="detail-domain-heading">Compositeurs</div>
        ${composers.map((member) => `
          <div class="encyclo-team-row">
            <span class="team-role">${escapeHtml(member.role || 'Compositeur')}</span>
            <span class="team-name">${escapeHtml(member.name)}</span>
            ${member.note ? `<span class="team-note">${escapeHtml(member.note)}</span>` : ''}
          </div>
        `).join('')}
      </article>
    ` : ''}
    ${tracks.length ? `
      <article class="detail-domain-block">
        <div class="detail-domain-heading">Tracks notables</div>
        <div class="archive-ost-tracks">
          <ul>${tracks.map((track) => `<li>${escapeHtml(typeof track === 'string' ? track : track.title || track.name || '')}</li>`).join('')}</ul>
        </div>
      </article>
    ` : ''}
    <article class="detail-domain-block">
      <div class="detail-domain-heading">Sorties OST</div>
      ${releases.length ? `
        <div class="detail-ost-release-list">
          ${releases.map((release) => {
            const item = parseStructuredValue(release, release) || {}
            return `
              <div class="detail-ost-release-row">
                <span class="detail-ost-release-title">${escapeHtml(item.name || item.title || 'OST')}</span>
                <span class="detail-ost-release-meta">
                  ${escapeHtml([
                    item.releaseYear || item.release_year || '',
                    item.format || '',
                    item.label || '',
                    item.trackCount || item.track_count ? `${item.trackCount || item.track_count} tracks` : '',
                  ].filter(Boolean).join(' | ') || 'Metadonnees partielles')}
                </span>
              </div>
            `
          }).join('')}
        </div>
      ` : `<div class="detail-empty-state">Aucune sortie OST structuree disponible pour l'instant.</div>`}
    </article>
  `
}

function buildEditorialSections() {
  return [
    { id: 'lore_characters', label: 'Lore & personnages', html: buildLoreCharactersTab() },
    { id: 'media_docs', label: 'Media & Manuals', html: buildMediaDocsTab() },
    { id: 'music_ost', label: 'Music & OST', html: buildMusicTab() },
  ]
}

function renderEditorialContent() {
  if (!editorialShellEl || !editorialContentEl) {
    return
  }

  if (currentGameDetailData) {
    renderDynamicEditorialContent()
    return
  }

  if (!currentGame && !currentEncyclopediaData && !currentArchiveData) {
    editorialShellEl.hidden = true
    editorialContentEl.innerHTML = ''
    return
  }

  const sections = buildEditorialSections()
  const currentActiveTab = editorialContentEl.querySelector('.detail-editorial-tab.active')?.dataset.tab
  const activeTab = sections.some((section) => section.id === currentActiveTab)
    ? currentActiveTab
    : sections[0].id

  editorialShellEl.hidden = false
  editorialContentEl.innerHTML = `
    ${buildProductionPanel()}
    <div class="detail-editorial-tabs">
      ${sections.map((section) => `
        <button type="button" class="detail-editorial-tab ${section.id === activeTab ? 'active' : ''}" data-tab="${section.id}">
          ${section.label}
        </button>
      `).join('')}
    </div>
    <div class="detail-editorial-panels">
      ${sections.map((section) => `
        <section class="detail-editorial-panel" data-panel="${section.id}" ${section.id === activeTab ? '' : 'hidden'}>
          ${section.html}
        </section>
      `).join('')}
    </div>
  `

  editorialContentEl.querySelectorAll('.detail-editorial-tab').forEach((button) => {
    button.addEventListener('click', () => activateEditorialTab(button.dataset.tab))
  })
}

async function loadGameDetailData(gameId) {
  if (!editorialShellEl || !editorialContentEl) {
    return false
  }

  try {
    const requestId = ++currentDetailHydrationRequest
    const data = await fetchJson(`/api/games/${encodeURIComponent(gameId)}/detail?scope=primary`)
    if (!data.ok) {
      currentGameDetailData = null
      renderEditorialContent()
      return false
    }

    if (requestId !== currentDetailHydrationRequest) {
      return false
    }

    currentGameDetailData = data
    if (currentGame) {
      const overview = data.content?.overview || {}
      if (!String(currentGame.summary || '').trim() && String(overview.summary || '').trim()) {
        currentGame.summary = overview.summary
        renderSummary(currentGame)
      } else if (!String(currentGame.summary || '').trim() && String(overview.synopsis || '').trim()) {
        currentGame.synopsis = overview.synopsis
        renderSummary(currentGame)
      }
    }

    renderEditorialContent()
    runtimeMonitor?.mark('detail-primary-ready', { gameId, scope: data.meta?.scope || 'primary' })
    scheduleFullGameDetailHydration(gameId, requestId)
    return true
  } catch (error) {
    currentGameDetailData = null
    renderEditorialContent()
    console.warn('[RetroDex] detail data layer load failed:', error.message)
    return false
  }
}

function scheduleFullGameDetailHydration(gameId, requestId) {
  if (currentFullDetailSchedule) {
    window.clearTimeout(currentFullDetailSchedule)
    currentFullDetailSchedule = null
  }

  const runHydration = () => {
    currentFullDetailSchedule = null
    void hydrateFullGameDetailData(gameId, requestId)
  }

  if (typeof window.requestIdleCallback === 'function') {
    currentFullDetailSchedule = window.setTimeout(runHydration, 180)
    window.requestIdleCallback(() => {
      if (currentFullDetailSchedule) {
        window.clearTimeout(currentFullDetailSchedule)
        runHydration()
      }
    }, { timeout: 1200 })
    return
  }

  currentFullDetailSchedule = window.setTimeout(runHydration, 180)
}

async function loadEncyclopedia(gameId) {
  if (!editorialShellEl || !editorialContentEl) {
    return
  }

  try {
    const data = await fetchJson(`/api/games/${encodeURIComponent(gameId)}/encyclopedia`)
    if (!data.ok) {
      currentEncyclopediaData = null
      renderEditorialContent()
      return
    }

    if (currentGame && !String(currentGame.summary || '').trim() && String(data.summary || '').trim()) {
      currentGame.summary = data.summary
      renderSummary(currentGame)
    } else if (currentGame && !String(currentGame.summary || '').trim() && String(data.synopsis || '').trim()) {
      currentGame.synopsis = data.synopsis
      renderSummary(currentGame)
    }
    currentEncyclopediaData = {
      summary: data.summary ?? null,
      synopsis: data.synopsis ?? null,
      dev_anecdotes: Array.isArray(data.dev_anecdotes) ? data.dev_anecdotes : [],
      dev_team: Array.isArray(data.dev_team) ? data.dev_team : [],
      cheat_codes: Array.isArray(data.cheat_codes) ? data.cheat_codes : [],
    }
    renderEditorialContent()
  } catch (error) {
    currentEncyclopediaData = null
    renderEditorialContent()
    console.warn('Encyclopedia load failed:', error.message)
  }
}

function buildRelationCatalogUrl(filters = {}, context = '', label = '') {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    const normalized = String(value || '').trim()
    if (normalized) {
      params.set(key, normalized)
    }
  })
  if (context) params.set('source', 'relation')
  if (context) params.set('context', context)
  if (label) params.set('label', label)
  return `/games-list.html?${params.toString()}`
}

function renderGameRelations(game, franchise = null) {
  const relationsEl = document.getElementById('game-relations')
  if (!relationsEl || !game) {
    return
  }

  const developerName = String(
    game.developerCompany?.name
      || game.developer
      || game.publisherCompany?.name
      || game.publisher
      || ''
  ).trim()
  const consoleName = String(game.console || '').trim()
  const year = Number.parseInt(String(game.year || ''), 10)
  const relationLinks = []

  if (franchise?.slug && franchise?.name) {
    relationLinks.push(`
      <a class="game-relation-link is-accent" href="/franchises.html?slug=${encodeURIComponent(franchise.slug)}">
        <span class="game-relation-label">Franchise</span>
        <span class="game-relation-value">${escapeHtml(franchise.name)}</span>
      </a>
    `)
  }

  if (developerName && !['studio inconnu', 'publisher inconnu', 'n/a', 'undefined', 'unknown'].includes(developerName.toLowerCase())) {
    relationLinks.push(`
      <a class="game-relation-link" href="${buildRelationCatalogUrl({ q: developerName }, 'developer', developerName)}">
        <span class="game-relation-label">Studio</span>
        <span class="game-relation-value">${escapeHtml(developerName)}</span>
      </a>
    `)
  }

  if (consoleName) {
    relationLinks.push(`
      <a class="game-relation-link" href="${buildRelationCatalogUrl({ console: consoleName }, 'console', consoleName)}">
        <span class="game-relation-label">Console</span>
        <span class="game-relation-value">${escapeHtml(consoleName)}</span>
      </a>
    `)
  }

  if (Number.isFinite(year) && year > 0) {
    relationLinks.push(`
      <a class="game-relation-link" href="${buildRelationCatalogUrl({ yearMin: year, yearMax: year }, 'period', String(year))}">
        <span class="game-relation-label">Periode</span>
        <span class="game-relation-value">${escapeHtml(String(year))}</span>
      </a>
    `)
  }

  relationsEl.innerHTML = relationLinks.join('')
  relationsEl.hidden = relationLinks.length === 0
}

async function loadFranchise(game) {
  const gameId = typeof game === 'string' ? game : game?.id
  const baseGame = typeof game === 'object' ? game : currentGame
  if (!gameId || !baseGame) {
    return
  }

  try {
    const data = await fetchJson(`/api/games/${encodeURIComponent(gameId)}/franchise`)
    renderGameRelations(baseGame, data.ok ? data.franchise : null)
  } catch (_error) {
    console.warn('[game-detail] franchise load failed:', _error?.message)
    renderGameRelations(baseGame, null)
  }
}

function renderSummary(game) {
  const summaryShellEl = document.getElementById('hero-summary-shell')
  const summaryEl = document.getElementById('hero-summary')
  if (!summaryShellEl || !summaryEl) {
    return
  }

  const summary = String(game.summary || game.synopsis || '').trim()
  const synopsisBandEl = document.getElementById('synopsis-band')

  if (synopsisBandEl && summary) {
    // Show summary in the dedicated band below hero; hide the in-hero duplicate
    synopsisBandEl.innerHTML = formatMultilineHtml(summary) // formatMultilineHtml calls escapeHtml() -- safe
    synopsisBandEl.hidden = false
    summaryShellEl.hidden = true
  } else {
    // No band available -- fall back to in-hero summary
    summaryShellEl.hidden = !summary
    summaryEl.innerHTML = summary ? formatMultilineHtml(summary) : ''
    if (synopsisBandEl) synopsisBandEl.hidden = true
  }
}

function renderProvenance(game) {
  const el = document.getElementById('provenance-line')
  if (!el) return

  const parts = []
  if (game.createdAt || game.indexedAt) {
    const raw = game.createdAt || game.indexedAt
    const date = new Date(raw)
    if (!Number.isNaN(date.getTime())) {
      parts.push(`Indexe le ${date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`)
    }
  }
  if (game.sources?.length) {
    parts.push(`${game.sources.length} source${game.sources.length > 1 ? 's' : ''}`)
  }
  if (game.rarity) {
    parts.push(`Rarete : ${escapeHtml(game.rarity)}`)
  }

  if (!parts.length) {
    el.hidden = true
    return
  }

  el.textContent = parts.join(' \u00B7 ')
  el.hidden = false
}

function renderStats(game) {
  const summaryStats = [
    { label: 'Plateforme', value: game.console || 'n/a' },
    { label: 'Annee', value: game.year || 'n/a' },
    { label: 'Metascore', value: '__METASCORE__', id: 'stat-metascore' },
    { label: 'Rarete', value: game.rarity || 'COMMON' },
  ]
  const detailStats = [
    { label: 'Genre', value: game.genre && game.genre !== 'Other' ? game.genre : '' },
    { label: 'Developpeur', value: game.developerCompany?.name || game.developer || '' },
    { label: 'Editeur', value: game.publisherCompany?.name || (game.publisher && game.publisher !== 'undefined' ? game.publisher : '') },
    { label: 'Slug', value: game.slug || '' },
  ].filter((entry) => entry.value != null && String(entry.value).trim() !== '')

  statsRowEl.innerHTML = `
    <div class="terminal-summary-bar detail-stats-bar">
      ${summaryStats.map(({ label, value, id }) => `
        <div class="terminal-summary-cell">
          <div class="terminal-summary-label">${escapeHtml(label)}</div>
          <div class="terminal-summary-value"${id ? ` id="${id}"` : ''}>${value === '__METASCORE__' ? formatMetascoreHtml(game.metascore) : escapeHtml(value)}</div>
        </div>
      `).join('')}
    </div>
    ${detailStats.length ? `
      <div class="surface-chip-row detail-stats-chip-row">
        ${detailStats.map(({ label, value }) => `
          <span class="surface-chip"><strong>${escapeHtml(label)}</strong>&nbsp;${escapeHtml(value)}</span>
        `).join('')}
      </div>
    ` : ''}
  `

  const statMeta = document.getElementById('stat-metascore')
  if (statMeta && window.RetroDexMetascore) {
    if (game.metascore) {
      const color = window.RetroDexMetascore.getColor(game.metascore)
      const label = window.RetroDexMetascore.getLabel(game.metascore)
      statMeta.textContent = `${game.metascore} | ${label}`
      statMeta.style.color = color
    } else {
      statMeta.innerHTML = buildEmptyStateHtml('Non note')
      statMeta.style.color = ''
    }
  }

  // Keep the advanced data block informative without letting it compete with the hero.
  const statsToggle = document.querySelector('#stats-shell .detail-accordion-toggle span:first-child')
  if (statsToggle && game.loosePrice) {
    const cur = game.priceCurrency
    const parts = [`Loose ${formatPrice(game.loosePrice, '', cur)}`]
    if (game.cibPrice) parts.push(`CIB ${formatPrice(game.cibPrice, '', cur)}`)
    if (game.mintPrice) parts.push(`Mint ${formatPrice(game.mintPrice, '', cur)}`)
    statsToggle.innerHTML = `Prix et marche \u00B7 ${escapeHtml(parts.join(' \u00B7 '))}`
  }
}

function populateCollectionForm(item) {
  if (collectionConditionEl) {
    collectionConditionEl.value = item?.condition || 'Loose'
  }
  if (collectionCompletenessEl) {
    collectionCompletenessEl.value = getQualificationCompleteness(item)
  }
  if (collectionQualificationConfidenceEl) {
    collectionQualificationConfidenceEl.value = getQualificationConfidence(item)
  }
  if (collectionPricePaidEl) {
    collectionPricePaidEl.value = item?.price_paid != null ? String(item.price_paid) : ''
  }
  if (collectionPurchaseDateEl) {
    collectionPurchaseDateEl.value = item?.purchase_date || ''
  }
  if (collectionRegionEl) {
    collectionRegionEl.value = item?.region || ''
  }
  if (collectionEditionNoteEl) {
    collectionEditionNoteEl.value = item?.edition_note || ''
  }
  if (collectionNotesEl) {
    collectionNotesEl.value = getCollectionNote(item)
  }
}

function readCollectionFormValues() {
  const condition = collectionConditionEl?.value || 'Loose'
  const completeness = collectionCompletenessEl?.value || 'unknown'
  const qualification_confidence = collectionQualificationConfidenceEl?.value || 'unknown'
  const rawPrice = String(collectionPricePaidEl?.value || '').trim()
  const price_paid = rawPrice ? Number(rawPrice) : null
  const purchase_date = String(collectionPurchaseDateEl?.value || '').trim() || null
  const region = String(collectionRegionEl?.value || '').trim() || null
  const edition_note = String(collectionEditionNoteEl?.value || '').trim() || null
  const notes = String(collectionNotesEl?.value || '').trim() || null

  if (rawPrice && (!Number.isFinite(price_paid) || price_paid <= 0)) {
    throw new Error("Prix d'achat invalide.")
  }

  if (purchase_date && !/^\d{4}-\d{2}-\d{2}$/.test(purchase_date)) {
    throw new Error("Date d'achat invalide.")
  }

  return {
    condition,
    completeness,
    qualification_confidence,
    price_paid,
    purchase_date,
    region,
    edition_note,
    notes,
    personal_note: notes,
  }
}

function buildCollectionMeta(item, listType) {
  if (!item) {
    return ''
  }

  const fragments = [
    `<span class="condition-badge condition-${escapeHtml(conditionClass(item.condition))}" data-condition="${escapeHtml(item.condition || 'Loose')}">${escapeHtml(item.condition || 'Loose')}</span>`,
    `<span class="collection-note-text">${escapeHtml(getQualificationLabel(item))}</span>`,
    `<span class="collection-note-text">Confiance ${escapeHtml(getQualificationConfidenceLabel(item))}</span>`,
  ]

  if (item.region) {
    fragments.push(`<span class="collection-note-text">Region ${escapeHtml(item.region)}</span>`)
  }

  if (item.edition_note) {
    fragments.push(`<span class="collection-note-text">${escapeHtml(item.edition_note)}</span>`)
  }

  if (item.purchase_date) {
    fragments.push(`<span class="collection-note-text">Entree le ${escapeHtml(item.purchase_date)}</span>`)
  }

  const note = getCollectionNote(item)
  if (note) {
    fragments.push(`<span class="collection-note-text">${escapeHtml(note)}</span>`)
  }

  return fragments.join('')
}

function setCollectionAccordionOpen(shouldOpen) {
  const contentEl = document.getElementById('collection-content')
  const sectionEl = contentEl?.closest('.detail-accordion')
  if (!sectionEl) {
    return
  }
  setAccordionState(sectionEl, Boolean(shouldOpen))
}

function applyCollectionUiState(item, options = {}) {
  if (options.error) {
    collectionStateEl.textContent = 'Indisponible'
    collectionCurrentMetaEl.innerHTML = ''
    collectionFormEl.hidden = false
    collectionButtonEl.disabled = true
    if (wishlistButtonEl) {
      wishlistButtonEl.disabled = true
      wishlistButtonEl.textContent = 'Wishlist'
    }
    if (collectionRemoveButtonEl) {
      collectionRemoveButtonEl.hidden = true
      collectionRemoveButtonEl.disabled = true
    }
    populateCollectionForm(null)
    setCollectionAccordionOpen(false)
    return
  }

  const heroPossessionChipEl = document.getElementById('hero-possession-chip')
  if (heroPossessionChipEl) {
    heroPossessionChipEl.innerHTML = buildPossessionChip(item) + buildQualificationChip(item) + (!item ? '<a href="/collection.html" class="detail-add-cta">+ ajouter a la collection</a>' : '')
  }

  collectionFormEl.hidden = false
  populateCollectionForm(item)

  if (!item) {
    collectionStateEl.textContent = ''
    collectionCurrentMetaEl.innerHTML = ''
    collectionButtonEl.textContent = "Ajouter a l'etagere"
    collectionButtonEl.disabled = false
    if (wishlistButtonEl) {
      wishlistButtonEl.textContent = "Ajouter a la wishlist"
      wishlistButtonEl.disabled = false
    }
    if (collectionRemoveButtonEl) {
      collectionRemoveButtonEl.hidden = true
      collectionRemoveButtonEl.disabled = true
      collectionRemoveButtonEl.textContent = 'Retirer'
    }
    return
  }

  setCollectionAccordionOpen(true)

  const listType = normalizeCollectionListType(item.list_type)
  collectionCurrentMetaEl.innerHTML = buildCollectionMeta(item, listType)
  window.RetroDexAssets?.decorateConditionBadges?.(collectionCurrentMetaEl)

  if (listType === 'wanted') {
    collectionStateEl.textContent = 'Dans la wishlist'
    collectionButtonEl.textContent = "Basculer vers l'etagere"
    collectionButtonEl.disabled = false
    if (wishlistButtonEl) {
      wishlistButtonEl.textContent = 'Wishlist'
      wishlistButtonEl.disabled = true
    }
    if (collectionRemoveButtonEl) {
      collectionRemoveButtonEl.hidden = false
      collectionRemoveButtonEl.disabled = false
      collectionRemoveButtonEl.textContent = 'Retirer'
    }
    return
  }

  if (listType === 'for_sale') {
    collectionStateEl.textContent = 'A vendre'
    collectionButtonEl.textContent = 'Enregistrer'
    collectionButtonEl.disabled = false
    if (wishlistButtonEl) {
      wishlistButtonEl.textContent = 'Wishlist'
      wishlistButtonEl.disabled = true
    }
    if (collectionRemoveButtonEl) {
      collectionRemoveButtonEl.hidden = false
      collectionRemoveButtonEl.disabled = false
      collectionRemoveButtonEl.textContent = 'Retirer'
    }
    return
  }

  collectionStateEl.textContent = "Dans l'etagere"
  collectionButtonEl.textContent = 'Mettre a jour'
  collectionButtonEl.disabled = false
  if (wishlistButtonEl) {
    wishlistButtonEl.textContent = 'Wishlist'
    wishlistButtonEl.disabled = true
  }
  if (collectionRemoveButtonEl) {
    collectionRemoveButtonEl.hidden = false
    collectionRemoveButtonEl.disabled = false
    collectionRemoveButtonEl.textContent = 'Retirer'
  }
}

async function refreshCollectionStatus(forceRefresh = false) {
  if (!currentGame) {
    return
  }

  try {
    const targetedPayload = await fetchJson(`/api/collection/game/${encodeURIComponent(currentGame.id)}`)
    if (Object.prototype.hasOwnProperty.call(targetedPayload || {}, 'item')) {
      currentCollectionItem = targetedPayload?.item || null
    } else if (typeof CoreApi.fetchCollectionIndex === 'function') {
      const collectionIndex = await CoreApi.fetchCollectionIndex(forceRefresh)
      currentCollectionItem = collectionIndex?.byGameId?.get(currentGame.id) || null
    } else {
      const payload = await fetchJson('/api/collection')
      currentCollectionItem = safeArray(payload.items).find((item) => item.gameId === currentGame.id) || null
    }
    applyCollectionUiState(currentCollectionItem)
    renderCollectionDecisionStrip()
  } catch (error) {
    try {
      if (typeof CoreApi.fetchCollectionIndex === 'function') {
        const collectionIndex = await CoreApi.fetchCollectionIndex(forceRefresh)
        currentCollectionItem = collectionIndex?.byGameId?.get(currentGame.id) || null
      } else {
        const payload = await fetchJson('/api/collection')
        currentCollectionItem = safeArray(payload.items).find((item) => item.gameId === currentGame.id) || null
      }
      applyCollectionUiState(currentCollectionItem)
      renderCollectionDecisionStrip()
    } catch (fallbackError) {
      applyCollectionUiState(null, { error: fallbackError || error })
      renderCollectionDecisionStrip({ error: true })
    }
  }
}

async function handleCollectionAction() {
  if (!currentGame) {
    return
  }

  collectionButtonEl.disabled = true
  if (wishlistButtonEl) {
    wishlistButtonEl.disabled = true
  }
  if (collectionRemoveButtonEl) {
    collectionRemoveButtonEl.disabled = true
  }
  collectionStatusEl.textContent = 'Mise a jour...'

  try {
    const formValues = readCollectionFormValues()
    const listType = currentCollectionItem ? normalizeCollectionListType(currentCollectionItem.list_type) : 'owned'

    if (currentCollectionItem) {
      await fetchJson(`/api/collection/${encodeURIComponent(currentCollectionItem.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formValues,
          list_type: listType === 'wanted' ? 'owned' : listType,
        }),
      })
      collectionStatusEl.textContent = listType === 'wanted' ? "Deplace vers l'etagere." : 'Fiche collection mise a jour.'
    } else {
      await fetchJson('/api/collection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameId: currentGame.id,
          ...formValues,
          list_type: 'owned',
        }),
      })
      collectionStatusEl.textContent = "Ajoute a l'etagere."
      if (window.BAZ) window.BAZ.say('collection_add')
    }

    await refreshCollectionStatus()
  } catch (error) {
    collectionStatusEl.textContent = 'Action collection indisponible pour cette session.'
    applyCollectionUiState(currentCollectionItem)
    renderCollectionDecisionStrip()
  }
}

async function handleMarkForSale() {
  if (!currentCollectionItem) return
  const btn = document.getElementById('action-mark-for-sale-btn')
  if (btn) { btn.disabled = true; btn.textContent = '...' }
  try {
    await fetchJson(`/api/collection/${encodeURIComponent(currentCollectionItem.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list_type: 'for_sale' }),
    })
    await refreshCollectionStatus()
  } catch (_err) {
    if (btn) { btn.disabled = false; btn.textContent = 'MARQUER A VENDRE' }
  }
}

async function handleWishlistAction() {
  if (!currentGame || !wishlistButtonEl) {
    return
  }

  const listType = currentCollectionItem ? normalizeCollectionListType(currentCollectionItem.list_type) : null
  if (listType === 'wanted') {
    collectionStatusEl.textContent = 'Deja en wishlist.'
    return
  }
  if (listType === 'owned' || listType === 'for_sale') {
    collectionStatusEl.textContent = 'Deja enregistre.'
    return
  }

  collectionButtonEl.disabled = true
  wishlistButtonEl.disabled = true
  if (collectionRemoveButtonEl) {
    collectionRemoveButtonEl.disabled = true
  }
  collectionStatusEl.textContent = 'Ajout...'

  try {
    const formValues = readCollectionFormValues()
    await fetchJson('/api/collection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gameId: currentGame.id,
        condition: formValues.condition,
        notes: formValues.notes,
        personal_note: formValues.personal_note,
        list_type: 'wanted',
      }),
    })

    collectionStatusEl.textContent = 'Ajoute a la wishlist.'
    if (window.BAZ) window.BAZ.say('collection_add')
    await refreshCollectionStatus()
  } catch (error) {
    collectionStatusEl.textContent = 'Action wishlist indisponible pour cette session.'
    applyCollectionUiState(currentCollectionItem)
    renderCollectionDecisionStrip()
  }
}

async function handleCollectionRemove() {
  if (!currentCollectionItem) {
    return
  }

  const listType = normalizeCollectionListType(currentCollectionItem.list_type)
  const targetLabel = listType === 'wanted'
    ? 'de votre wishlist'
    : listType === 'for_sale'
      ? 'de votre liste a vendre'
      : 'de votre etagere'

  if (!window.confirm(`Retirer "${currentGame?.title || 'ce jeu'}" ${targetLabel} ?`)) {
    return
  }

  collectionButtonEl.disabled = true
  if (wishlistButtonEl) {
    wishlistButtonEl.disabled = true
  }
  if (collectionRemoveButtonEl) {
    collectionRemoveButtonEl.disabled = true
  }
  collectionStatusEl.textContent = 'Suppression...'

  try {
    await fetchJson(`/api/collection/${encodeURIComponent(currentCollectionItem.id)}`, {
      method: 'DELETE',
    })
    collectionStatusEl.textContent = 'Retire.'
    await refreshCollectionStatus()
  } catch (error) {
    collectionStatusEl.textContent = 'Suppression indisponible pour cette session.'
    applyCollectionUiState(currentCollectionItem)
    renderCollectionDecisionStrip()
  }
}

function setContributionFeedback(message, isError = false) {
  if (!contribFeedbackEl) {
    return
  }

  contribFeedbackEl.classList.remove('hidden', 'is-error', 'is-success')
  contribFeedbackEl.classList.add(isError ? 'is-error' : 'is-success')
  contribFeedbackEl.textContent = message
}

async function handleContributionSubmit() {
  if (!currentGame) {
    setContributionFeedback('Impossible de soumettre sans fiche chargee.', true)
    return
  }

  const reportedPrice = Number(contribPriceEl?.value || 0)

  contribSubmitEl.disabled = true
  setContributionFeedback('Envoi en cours...')

  try {
    const payload = {
      item_id: currentGame.id,
      condition: contribConditionEl?.value || 'Loose',
      reported_price: reportedPrice,
      context: contribContextEl?.value || 'autre',
      date_estimated: contribDateEl?.value || null,
      text_raw: contribNoteEl?.value?.trim() || null,
    }

    await fetchJson(`/api/games/${encodeURIComponent(currentGame.id)}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    setContributionFeedback('Merci pour votre contribution !')
    contribPriceEl.value = ''
    contribDateEl.value = ''
    contribNoteEl.value = ''
  } catch (error) {
    setContributionFeedback(error.message, true)
  } finally {
    contribSubmitEl.disabled = false
  }
}

function syncRelatedShellVisibility() {
  if (!relatedShellEl || !relatedContentEl) {
    return
  }

  relatedShellEl.hidden = relatedContentEl.children.length === 0
}

function removeRelatedModule(moduleId) {
  if (!relatedContentEl) {
    return
  }

  relatedContentEl.querySelector(`[data-related-module="${moduleId}"]`)?.remove()
  syncRelatedShellVisibility()
}

function upsertRelatedModule(moduleId, title, copy, bodyHtml) {
  if (!relatedContentEl) {
    return
  }

  let moduleEl = relatedContentEl.querySelector(`[data-related-module="${moduleId}"]`)
  if (!moduleEl) {
    moduleEl = document.createElement('section')
    moduleEl.className = 'related-module'
    moduleEl.dataset.relatedModule = moduleId
    relatedContentEl.appendChild(moduleEl)
  }

  moduleEl.innerHTML = `
    <div class="related-module-head">
      <div>
        <h3>${escapeHtml(title)}</h3>
        ${copy ? `<p class="related-module-copy">${escapeHtml(copy)}</p>` : ''}
      </div>
    </div>
    <div class="related-module-body">${bodyHtml}</div>
  `

  syncRelatedShellVisibility()
}

function extractSeries(title) {
  const normalized = String(title || '')
    .replace(/[:\-]/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\b(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\b/gi, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) {
    return ''
  }

  const words = normalized.split(' ').filter(Boolean)
  while (words.length && ['super', 'the', 'new'].includes(words[0].toLowerCase())) {
    words.shift()
  }

  if (words.length >= 2) {
    const compound = `${words[0].toLowerCase()} ${words[1].toLowerCase()}`
    if (['final fantasy', 'dragon quest', 'mega man', 'metal gear'].includes(compound)) {
      return `${words[0]} ${words[1]}`
    }
  }

  return words[0] || ''
}

function renderRelatedMetascore(score) {
  if (window.RetroDexMetascore?.renderBadge) {
    return window.RetroDexMetascore.renderBadge(score, 'micro').outerHTML
  }

  const value = Number(score)
  return Number.isFinite(value) && value > 0
    ? `<span class="related-metascore-fallback">${Math.round(value)}</span>`
    : buildEmptyStateHtml('Non note')
}

function normalizeRelatedText(value) {
  return String(value || '').trim().toLowerCase()
}

function getRelatedText(candidate) {
  return [
    candidate?.developerCompany?.name,
    candidate?.developer,
    candidate?.publisherCompany?.name,
    candidate?.publisher,
    candidate?.console,
  ]
    .map(normalizeRelatedText)
    .filter(Boolean)
    .join(' | ')
}

function getRelatedFallbackQuery(game) {
  const anchors = [
    game?.developerCompany?.name,
    game?.developer,
    game?.publisherCompany?.name,
    game?.publisher,
    game?.console,
  ]

  for (const anchor of anchors) {
    const value = String(anchor || '').trim()
    if (!value) {
      continue
    }

    const lower = value.toLowerCase()
    if (['studio inconnu', 'publisher inconnu', 'n/a', 'undefined', 'unknown'].includes(lower)) {
      continue
    }

    return value
  }

  return ''
}

function scoreRelatedCandidate(candidate, game, options = {}) {
  const title = String(candidate.title || '').toLowerCase()
  const currentTitle = String(game.title || '').toLowerCase()
  const normalizedSeries = normalizeRelatedText(options.series)
  const normalizedQuery = normalizeRelatedText(options.query)
  const spinOffKeywords = ['party', 'kart', 'golf', 'tennis', 'tactics', 'legend', 'revenant', '& luigi', 'paper mario']

  let total = 0

  if (normalizedSeries) {
    if (title.startsWith(normalizedSeries)) total += 20
    if (currentTitle.startsWith('super mario') && title.startsWith('super mario')) total += 40
    if (spinOffKeywords.some((keyword) => title.includes(keyword))) total -= 25
  }

  if (normalizedQuery) {
    const relationText = getRelatedText(candidate)
    if (relationText.includes(normalizedQuery)) total += 20
    if (title.includes(normalizedQuery)) total += 10
  }

  if (String(candidate.console || '').toLowerCase() === String(game.console || '').toLowerCase()) {
    total += 15
  }

  total -= Math.abs(title.length - currentTitle.length) * 0.1
  return total
}

function collectRelatedCandidates(items, game, options = {}) {
  const normalizedSeries = normalizeRelatedText(options.series)
  const normalizedQuery = normalizeRelatedText(options.query)
  const requireSeriesMatch = Boolean(options.requireSeriesMatch)

  return safeArray(items)
    .filter((item) => item.id !== game.id)
    .filter((item) => {
      const title = String(item.title || '').toLowerCase()
      if (requireSeriesMatch && normalizedSeries) {
        return title.includes(normalizedSeries)
      }

      if (normalizedQuery) {
        const relationText = getRelatedText(item)
        return relationText.includes(normalizedQuery) || title.includes(normalizedQuery)
      }

      return true
    })
    .sort((left, right) => scoreRelatedCandidate(right, game, options) - scoreRelatedCandidate(left, game, options))
    .slice(0, 4)
}

function renderRelatedPrices(current, related, options = {}) {
  upsertRelatedModule(
    'franchise-versions',
    options.title || 'Meme franchise | autres versions',
    options.copy || '',
    `
        <div class="compare-table">
          <div class="compare-row compare-header">
            <span>Titre</span>
            <span>Ann?e</span>
            <span>Console</span>
            <span>Meta</span>
            <span>Rarete</span>
          </div>
          <div class="compare-row current">
            <span>${escapeHtml(current.title)}</span>
            <span>${escapeHtml(current.year || 'n/a')}</span>
            <span>${escapeHtml(current.console || 'n/a')}</span>
            <span class="compare-score-cell">${renderRelatedMetascore(current.metascore)}</span>
            <span class="rarity-badge rarity-${escapeHtml(rarityClass(current.rarity))}">${escapeHtml(current.rarity || 'COMMON')}</span>
          </div>
          ${related.map((game) => `
            <div class="compare-row clickable" onclick="window.location='/game-detail.html?id=${encodeURIComponent(game.id)}'">
              <span>${escapeHtml(game.title)}</span>
              <span>${escapeHtml(game.year || 'n/a')}</span>
              <span>${escapeHtml(game.console || 'n/a')}</span>
              <span class="compare-score-cell">${renderRelatedMetascore(game.metascore)}</span>
              <span class="rarity-badge rarity-${escapeHtml(rarityClass(game.rarity))}">${escapeHtml(game.rarity || 'COMMON')}</span>
            </div>
          `).join('')}
        </div>
    `
  )
}

async function loadRelatedGames(game) {
  removeRelatedModule('franchise-versions')

  const series = extractSeries(game?.title)
  let related = []
  let relatedTitle = 'Meme franchise | autres versions'
  let relatedCopy = ''
  try {
    if (series && series.length >= 3) {
      const data = await fetchJson(`/api/games?q=${encodeURIComponent(series)}&limit=50`)
      related = collectRelatedCandidates(data.items, game, {
        series,
        query: series,
        requireSeriesMatch: true,
      })
    }

    if (related.length < 2) {
      const fallbackQuery = getRelatedFallbackQuery(game)
      if (fallbackQuery) {
        const fallbackData = await fetchJson(`/api/games?q=${encodeURIComponent(fallbackQuery)}&limit=25`)
        const fallbackRelated = collectRelatedCandidates(fallbackData.items, game, {
          query: fallbackQuery,
          requireSeriesMatch: false,
        })
        const relaxedFallback = fallbackRelated.length ? fallbackRelated : collectRelatedCandidates(fallbackData.items, game, {
          requireSeriesMatch: false,
        })

        const merged = new Map()
        for (const candidate of [...related, ...relaxedFallback]) {
          if (candidate?.id && !merged.has(candidate.id)) {
            merged.set(candidate.id, candidate)
          }
        }

        related = Array.from(merged.values()).slice(0, 4)
        if (related.length && series && series.length >= 3) {
          relatedTitle = 'Lecture prolongee | connexions proches'
          relatedCopy = `Fallback sur ${fallbackQuery}`
        } else if (related.length) {
          relatedTitle = `Lecture prolongee | ${fallbackQuery}`
        }
      }
    }

    if (related.length) {
      renderRelatedPrices(game, related, { title: relatedTitle, copy: relatedCopy })
    }
  } catch (error) {
    console.warn('[RetroDex] Related franchise lookup failed:', error.message)
  }
}

async function loadSimilar(gameId) {
  removeRelatedModule('similar-games')

  try {
    const data = await fetchJson(`/api/games/${encodeURIComponent(gameId)}/similar`)
    if (!data.ok || !safeArray(data.games).length) {
      return
    }

    upsertRelatedModule(
      'similar-games',
      'Jeux similaires',
      '',
      `
        <div id="similar-grid">
          ${safeArray(data.games).map((game) => `
            <a class="game-card" href="/game-detail.html?id=${encodeURIComponent(game.id)}">
              ${buildGameCardCoverHtml(game)}
              <div class="game-card-body">
                <div class="game-card-title">${escapeHtml(game.title)}</div>
                ${buildGameCardMeta(game.console || '', game.year || '') ? `<div class="game-card-meta">${buildGameCardMeta(game.console || '', game.year || '')}</div>` : ''}
              </div>
            </a>
          `).join('')}
        </div>
      `
    )
  } catch (error) {
    console.warn('Similar games load failed:', error.message)
  }
}

function normalizeHistoryPayload(data) {
  if (data?.series) {
    return data
  }

  const periods = [
    { id: '1m', label: '1M', days: 30 },
    { id: '6m', label: '6M', days: 180 },
    { id: '1y', label: '1Y', days: 365 },
    { id: 'all', label: 'ALL', days: null },
  ]

  function parseCompatDate(value) {
    if (!value) {
      return null
    }

    if (/^\d{4}-\d{2}$/.test(String(value))) {
      return `${value}-01`
    }

    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
  }

  function filterCompatPoints(points, days) {
    if (!days || !points.length) {
      return [...points]
    }

    const latestDate = new Date(`${points[points.length - 1].date}T00:00:00Z`)
    if (Number.isNaN(latestDate.getTime())) {
      return [...points]
    }

    const cutoff = new Date(latestDate.getTime() - days * 24 * 60 * 60 * 1000)
    return points.filter((point) => {
      const pointDate = new Date(`${point.date}T00:00:00Z`)
      return !Number.isNaN(pointDate.getTime()) && pointDate >= cutoff
    })
  }

  function buildCompatPeriodStats(points) {
    return periods.reduce((acc, period) => {
      const scopedPoints = filterCompatPoints(points, period.days)
      const values = scopedPoints.map((point) => point.value)
      const firstPoint = scopedPoints[0] || null
      const lastPoint = scopedPoints[scopedPoints.length - 1] || null
      const variationValue = scopedPoints.length >= 2 ? lastPoint.value - firstPoint.value : null
      const variationPct = scopedPoints.length >= 2 && firstPoint.value > 0
        ? Math.round(((variationValue / firstPoint.value) * 100) * 10) / 10
        : null

      acc[period.id] = {
        points_count: scopedPoints.length,
        has_history: scopedPoints.length > 0,
        has_variation: scopedPoints.length >= 2,
        min_value: values.length ? Math.min(...values) : null,
        max_value: values.length ? Math.max(...values) : null,
        first_date: firstPoint?.date || null,
        last_date: lastPoint?.date || null,
        first_value: firstPoint?.value ?? null,
        last_value: lastPoint?.value ?? null,
        variation_value: variationValue,
        variation_pct: variationPct,
      }

      return acc
    }, {})
  }

  const historyRows = safeArray(data?.history)
  const series = {}
  const availableSeries = []
  const missingSeries = []

  PRICE_HISTORY_STATES.forEach((state) => {
    const points = historyRows
      .map((point) => {
        const date = parseCompatDate(point?.month || point?.date)
        const value = Number(point?.[state.key])
        if (!date || !Number.isFinite(value) || value <= 0) {
          return null
        }

        return {
          date,
          value,
          source: null,
          confidence_pct: null,
          context: null,
        }
      })
      .filter(Boolean)

    const currentPrice = Number(data?.currentPrices?.[state.key])
    const hasCurrentPrice = Number.isFinite(currentPrice) && currentPrice > 0

    series[state.key] = {
      key: state.key,
      label: state.label,
      condition: state.condition,
      available: points.length > 0,
      points,
      periods: buildCompatPeriodStats(points),
      current_price: hasCurrentPrice ? currentPrice : null,
      current_price_source: hasCurrentPrice ? 'reference_fallback' : 'unavailable',
      last_observation: points.length
        ? {
            date: points[points.length - 1].date,
            value: points[points.length - 1].value,
            source: points[points.length - 1].source,
            confidence_pct: null,
            context: null,
          }
        : hasCurrentPrice
          ? {
              date: null,
              value: currentPrice,
              source: 'reference_fallback',
              confidence_pct: null,
              context: null,
            }
          : null,
      confidence_pct: null,
      source_label: points.length ? 'Historique de compatibilite' : hasCurrentPrice ? 'Reference de compatibilite' : 'Sans historique',
    }

    if (points.length) {
      availableSeries.push(state.key)
    } else {
      missingSeries.push(state.key)
    }
  })

  return {
    ...data,
    periods,
    series,
    availableSeries,
    missingSeries,
    hasAnyHistory: availableSeries.length > 0,
    sourceNotice: data?.sourceNotice || 'Compatibilite historique activee pour les historiques de prix.',
  }
}

async function updatePriceTimestamp(gameId) {
  try {
    const response = await fetch(`/api/games/${encodeURIComponent(gameId)}/price-history`)
    if (!response.ok) return
    const data = await response.json()
    const lastDate = data?.series?.loose?.last_observation?.date
    const el = document.getElementById('price-timestamp')
    if (!el || !lastDate) return
    const formatted = String(lastDate).slice(0, 10)
    el.textContent = `Prix mis a jour le : ${formatted}`
    el.hidden = false
  } catch (err) {
    console.warn('[RetroDex] updatePriceTimestamp failed:', err.message)
  }
}

async function loadPriceHistory(gameId) {
  const response = await fetch(`/api/games/${encodeURIComponent(gameId)}/price-history`)
  if (!response.ok) {
    return
  }

  const data = normalizeHistoryPayload(await response.json())
  const sectionEl = detailShellEl?.querySelector('.price-history') || document.querySelector('.price-history')
  const headingEl = sectionEl?.querySelector('h3')
  const legendEl = sectionEl?.querySelector('.chart-toggle')
  const periodsEl = sectionEl?.querySelector('.period-selector')
  const chartContainerEl = sectionEl?.querySelector('.chart-container')
  const metricsEl = sectionEl?.querySelector('.price-stats-row')
  const svg = document.getElementById('price-chart')
  const labelsEl = document.getElementById('chart-labels')

  if (!sectionEl || !legendEl || !periodsEl || !chartContainerEl || !metricsEl || !svg || !labelsEl) {
    return
  }

  if (headingEl) {
    headingEl.textContent = 'Comparer les etats'
  }

  let noteEl = document.getElementById('price-history-note')
  if (!noteEl) {
    noteEl = document.createElement('div')
    noteEl.id = 'price-history-note'
    noteEl.className = 'price-history-note'
    chartContainerEl.insertAdjacentElement('afterend', noteEl)
  }

  let tooltipEl = document.getElementById('price-history-tooltip')
  if (!tooltipEl) {
    tooltipEl = document.createElement('div')
    tooltipEl.id = 'price-history-tooltip'
    tooltipEl.className = 'price-history-tooltip'
    tooltipEl.hidden = true
    chartContainerEl.appendChild(tooltipEl)
  }

  const periods = safeArray(data.periods)
  const periodMap = new Map(periods.map((period) => [period.id, period]))
  let activePeriodId = periodMap.has(DEFAULT_PRICE_HISTORY_PERIOD) ? DEFAULT_PRICE_HISTORY_PERIOD : (periods[0]?.id || 'all')
  const visibleSeries = new Set(safeArray(data.availableSeries))

  function getSeries(stateKey) {
    return data.series?.[stateKey] || {
      key: stateKey,
      label: stateKey.toUpperCase(),
      available: false,
      points: [],
      periods: {},
      current_price: null,
      current_price_source: 'unavailable',
      last_observation: null,
      confidence_pct: null,
      source_label: 'Sans historique',
    }
  }

  function getPeriod(periodId = activePeriodId) {
    return periodMap.get(periodId) || periods[0] || { id: 'all', label: 'ALL', days: null }
  }

  function parseObservationDate(value) {
    if (!value) {
      return null
    }

    const parsed = new Date(`${value}T00:00:00Z`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  function filterPoints(points, periodId = activePeriodId) {
    const sourcePoints = safeArray(points)
    const period = getPeriod(periodId)
    if (!period.days || !sourcePoints.length) {
      return sourcePoints
    }

    const latestDate = parseObservationDate(sourcePoints[sourcePoints.length - 1].date)
    if (!latestDate) {
      return sourcePoints
    }

    const cutoff = new Date(latestDate.getTime() - period.days * 24 * 60 * 60 * 1000)
    return sourcePoints.filter((point) => {
      const pointDate = parseObservationDate(point.date)
      return pointDate ? pointDate >= cutoff : false
    })
  }

  function formatHistoryDate(value, short = false) {
    const parsed = parseObservationDate(value)
    if (!parsed) {
      return 'Date inconnue'
    }

    return new Intl.DateTimeFormat('fr-FR', short
      ? { month: 'short', year: '2-digit', timeZone: 'UTC' }
      : { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }
    ).format(parsed)
  }

  function formatVariation(value) {
    const number = Number(value)
    if (!Number.isFinite(number)) {
      return 'n/a'
    }

    return `${number > 0 ? '+' : ''}${number.toFixed(1)}%`
  }

  function formatObservationSummary(observation) {
    if (observation?.value == null) {
      return 'Aucune observation'
    }

    if (!observation.date) {
      return `Reference courante | ${formatPrice(observation.value)}`
    }

    return `${formatHistoryDate(observation.date)} | ${formatPrice(observation.value)}`
  }

  function trendLabel(series, state) {
    if (series.available) {
      return {
        text: state.label,
        className: data.trend?.[state.key] || 'stable',
      }
    }

    if (series.current_price != null) {
      return {
        text: `${state.label} REF`,
        className: 'is-muted',
      }
    }

    return {
      text: `${state.label} N/A`,
      className: 'is-muted',
    }
  }

  function buildVisibleEntries() {
    return PRICE_HISTORY_STATES
      .filter((state) => visibleSeries.has(state.key))
      .map((state) => {
        const series = getSeries(state.key)
        return {
          ...state,
          series,
          points: filterPoints(series.points, activePeriodId),
        }
      })
      .filter((entry) => entry.points.length)
  }

  function hideTooltip() {
    tooltipEl.hidden = true
  }

  function showTooltip(target, event) {
    const stateLabel = target.dataset.stateLabel || 'Etat'
    const date = target.dataset.date || ''
    const value = Number(target.dataset.value)
    const source = target.dataset.source || ''
    const confidence = Number(target.dataset.confidence)
    const sourceLabel = source === 'editorial'
      ? 'vente editoriale'
      : source === 'community'
        ? 'observation communautaire'
        : source === 'retrodex_index'
          ? 'indice RetroDex'
          : source

    tooltipEl.innerHTML = `
      <div class="price-history-tooltip-title">${escapeHtml(stateLabel)}</div>
      <div>${escapeHtml(formatHistoryDate(date))}</div>
      <div>${formatPriceHtml(value)}</div>
      <div class="price-history-tooltip-copy">
        ${escapeHtml(sourceLabel || 'source inconnue')}
        ${Number.isFinite(confidence) && confidence > 0 ? ` | ${escapeHtml(`${Math.round(confidence)}% confiance`)}` : ''}
      </div>
    `

    const rect = chartContainerEl.getBoundingClientRect()
    const left = event?.clientX != null ? event.clientX - rect.left : Number(target.dataset.left || 0)
    const top = event?.clientY != null ? event.clientY - rect.top : Number(target.dataset.top || 0)

    tooltipEl.style.left = `${left}px`
    tooltipEl.style.top = `${Math.max(18, top)}px`
    tooltipEl.hidden = false
  }

  function syncTrendBadges() {
    PRICE_HISTORY_STATES.forEach((state) => {
      const badge = document.getElementById(`trend-${state.key}`)
      if (!badge) {
        return
      }

      const { text, className } = trendLabel(getSeries(state.key), state)
      badge.textContent = text
      badge.classList.remove('up', 'down', 'stable', 'is-muted')
      if (className) {
        badge.classList.add(className)
      }
    })
  }

  function renderLegend() {
    const hasAnyChartData = PRICE_HISTORY_STATES.some((state) => getSeries(state.key).points.length > 0)
    legendEl.hidden = !hasAnyChartData

    if (!hasAnyChartData) {
      legendEl.innerHTML = ''
      return
    }

    legendEl.innerHTML = PRICE_HISTORY_STATES.map((state) => {
      const series = getSeries(state.key)
      return `
        <button
          type="button"
          class="chart-btn history-legend-btn ${visibleSeries.has(state.key) ? 'active' : ''} ${series.available ? '' : 'is-disabled'}"
          data-state-key="${escapeHtml(state.key)}"
          ${series.available ? '' : 'disabled'}
        >
          <span class="history-legend-swatch" style="--state-color:${state.color}"></span>
          ${escapeHtml(state.label)}
        </button>
      `
    }).join('')

    legendEl.querySelectorAll('[data-state-key]').forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.dataset.stateKey
        if (!key) {
          return
        }

        if (visibleSeries.has(key)) {
          visibleSeries.delete(key)
        } else {
          visibleSeries.add(key)
        }

        refreshHistory()
      })
    })
  }

  function renderPeriods() {
    const hasAnyChartData = PRICE_HISTORY_STATES.some((state) => getSeries(state.key).points.length > 0)
    periodsEl.hidden = !hasAnyChartData

    if (!hasAnyChartData) {
      periodsEl.innerHTML = ''
      return
    }

    periodsEl.innerHTML = periods.map((period) => `
      <button
        type="button"
        class="period-btn ${period.id === activePeriodId ? 'active' : ''}"
        data-period-id="${escapeHtml(period.id)}"
      >
        ${escapeHtml(period.label)}
      </button>
    `).join('')

    periodsEl.querySelectorAll('[data-period-id]').forEach((button) => {
      button.addEventListener('click', () => {
        activePeriodId = button.dataset.periodId || DEFAULT_PRICE_HISTORY_PERIOD
        refreshHistory()
      })
    })
  }

  function syncMarketSummary() {
    const lastSaleEl = document.getElementById('market-last-sale')
    const seriesEl = document.getElementById('market-series')
    const depthEl = document.getElementById('market-depth')
    const periodEl = document.getElementById('market-period')
    const statusEl = document.getElementById('market-status')
    const period = getPeriod(activePeriodId)
    const observedEntries = PRICE_HISTORY_STATES
      .map((state) => ({ state, series: getSeries(state.key) }))
      .filter((entry) => entry.series.points.length > 0)
    const latestObservation = observedEntries
      .map((entry) => ({
        stateLabel: entry.state.label,
        observation: entry.series.last_observation,
      }))
      .filter((entry) => entry.observation?.value != null)
      .sort((a, b) => {
        const aDate = parseObservationDate(a.observation?.date)?.getTime() || 0
        const bDate = parseObservationDate(b.observation?.date)?.getTime() || 0
        return bDate - aDate
      })[0] || null
    const totalPoints = observedEntries.reduce((sum, entry) => sum + entry.series.points.length, 0)
    const activeSeries = PRICE_HISTORY_STATES
      .filter((state) => visibleSeries.has(state.key) && getSeries(state.key).points.length > 0)
      .map((state) => state.label.toUpperCase())

    if (lastSaleEl) {
      lastSaleEl.textContent = latestObservation
        ? `${formatPrice(latestObservation.observation.value)} | ${formatHistoryDate(latestObservation.observation.date)}`
        : 'Non indexe'
    }

    if (seriesEl) {
      seriesEl.textContent = activeSeries.length ? activeSeries.join(' | ') : 'REFERENCE'
    }

    if (depthEl) {
      depthEl.textContent = totalPoints ? formatCount(totalPoints, 'obs.', 'obs.') : '0 obs.'
    }

    if (periodEl) {
      periodEl.textContent = period.label || 'ALL'
    }

    if (statusEl) {
      statusEl.textContent = data.hasAnyHistory ? 'OBSERVED' : 'REFERENCE'
      statusEl.classList.toggle('is-alert', !data.hasAnyHistory)
    }

    if (headingEl) {
      headingEl.textContent = `Trace prix | ${period.label || 'ALL'}`
    }
  }

  function renderMetrics() {
    const period = getPeriod(activePeriodId)
    metricsEl.classList.add('history-state-grid')
    metricsEl.innerHTML = PRICE_HISTORY_STATES.map((state) => {
      const series = getSeries(state.key)
      const stats = series.periods?.[activePeriodId] || {}
      const status = series.available ? 'OBSERVED' : series.current_price != null ? 'REFERENCE' : 'NO DATA'
      const variationClass = Number(stats.variation_pct) > 0
        ? 'is-up'
        : Number(stats.variation_pct) < 0
          ? 'is-down'
          : 'is-neutral'

      return `
        <article class="history-state-card ${series.available ? '' : 'is-muted'} ${visibleSeries.has(state.key) ? 'is-visible' : ''}">
          <div class="history-state-head">
            <span class="history-state-name">
              <span class="history-legend-swatch" style="--state-color:${state.color}"></span>
              ${escapeHtml(state.label)}
            </span>
            <span class="history-state-status">${escapeHtml(status)}</span>
          </div>
          <div class="history-state-metric-grid">
            <div class="history-state-metric">
              <span class="stat-label">Actuel</span>
              <span class="stat-value">${formatPriceHtml(series.current_price)}</span>
            </div>
            <div class="history-state-metric">
              <span class="stat-label">Var. ${escapeHtml(period.label)}</span>
              <span class="stat-value history-variation ${variationClass}">
                ${escapeHtml(stats.has_variation ? formatVariation(stats.variation_pct) : 'n/a')}
              </span>
            </div>
            <div class="history-state-metric history-state-metric-wide">
              <span class="stat-label">Derniere obs.</span>
              <span class="history-state-note">${escapeHtml(formatObservationSummary(series.last_observation))}</span>
            </div>
          </div>
          <div class="history-state-footer">
            ${escapeHtml(series.source_label || 'Sans historique')}
            ${Number.isFinite(Number(series.confidence_pct)) && Number(series.confidence_pct) > 0
              ? ` | ${escapeHtml(`${Math.round(Number(series.confidence_pct))}% confiance`)}`
              : ''}
          </div>
        </article>
      `
    }).join('')
  }

  function renderNote(visibleEntries) {
    if (!data.hasAnyHistory) {
      noteEl.textContent = 'Historique observe indisponible pour ce jeu. Les references par etat restent affichees ci-dessous.'
      return
    }

    if (!visibleSeries.size) {
      noteEl.textContent = 'Activez au moins un etat pour comparer les observations disponibles.'
      return
    }

    if (!visibleEntries.length) {
      noteEl.textContent = `Aucune observation datee sur ${getPeriod(activePeriodId).label}.`
      return
    }

    if (safeArray(data.missingSeries).length) {
      const missingLabels = PRICE_HISTORY_STATES
        .filter((state) => safeArray(data.missingSeries).includes(state.key))
        .map((state) => state.label)
        .join(', ')

      noteEl.textContent = `Series indisponibles: ${missingLabels}. ${data.sourceNotice || ''}`.trim()
      return
    }

    noteEl.textContent = data.sourceNotice || ''
  }

  function renderChart() {
    const visibleEntries = buildVisibleEntries()
    const width = 600
    const height = 180
    const padLeft = 38
    const padRight = 14
    const padTop = 16
    const padBottom = 28

    hideTooltip()
    renderNote(visibleEntries)

    if (!visibleEntries.length) {
      svg.innerHTML = `
        <text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#5a8a5a" font-size="12">
          ${escapeHtml(data.hasAnyHistory ? 'Aucune observation visible sur cette periode.' : 'Historique observe indisponible.')}
        </text>
      `
      labelsEl.innerHTML = ''
      return
    }

    const chartPoints = visibleEntries.flatMap((entry) => entry.points
      .map((point) => {
        const date = parseObservationDate(point.date)
        return date ? {
          ...point,
          timestamp: date.getTime(),
          stateKey: entry.key,
          stateLabel: entry.label,
          color: entry.color,
        } : null
      })
      .filter(Boolean))

    if (!chartPoints.length) {
      svg.innerHTML = `
        <text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#5a8a5a" font-size="12">
          Aucune observation exploitable pour cette periode.
        </text>
      `
      labelsEl.innerHTML = ''
      return
    }

    const timestamps = chartPoints.map((point) => point.timestamp)
    const values = chartPoints.map((point) => point.value)
    const minTimestamp = Math.min(...timestamps)
    const maxTimestamp = Math.max(...timestamps)
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const valuePadding = Math.max((maxValue - minValue) * 0.14, 2)
    const safeMinValue = Math.max(0, minValue - valuePadding)
    const safeMaxValue = maxValue + valuePadding
    const valueRange = safeMaxValue - safeMinValue || 1
    const timeRange = maxTimestamp - minTimestamp || 1

    const xFor = (timestamp) => (
      maxTimestamp === minTimestamp
        ? width / 2
        : padLeft + ((timestamp - minTimestamp) / timeRange) * (width - padLeft - padRight)
    )
    const yFor = (value) => height - padBottom - ((value - safeMinValue) / valueRange) * (height - padTop - padBottom)

    const guideValues = [safeMinValue, safeMinValue + valueRange / 2, safeMaxValue]
    const guideMarkup = guideValues.map((value) => {
      const y = yFor(value)
      return `
        <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="#142714" stroke-width="1" />
        <text x="${padLeft - 6}" y="${y + 4}" text-anchor="end" fill="#3f6a3f" font-size="10">${escapeHtml(formatPrice(value, '', currentGame?.priceCurrency))}</text>
      `
    }).join('')

    const seriesMarkup = visibleEntries.map((entry) => {
      const linePoints = entry.points
        .map((point) => {
          const date = parseObservationDate(point.date)
          return date ? `${xFor(date.getTime())},${yFor(point.value)}` : null
        })
        .filter(Boolean)
        .join(' ')

      const circles = entry.points.map((point) => {
        const date = parseObservationDate(point.date)
        if (!date) {
          return ''
        }

        const cx = xFor(date.getTime())
        const cy = yFor(point.value)
        return `
          <circle
            class="price-history-point"
            cx="${cx}"
            cy="${cy}"
            r="4"
            fill="${entry.color}"
            stroke="#091109"
            stroke-width="1.5"
            tabindex="0"
            data-left="${cx}"
            data-top="${cy}"
            data-state-label="${escapeHtml(entry.label)}"
            data-date="${escapeHtml(point.date)}"
            data-value="${escapeHtml(String(point.value))}"
            data-source="${escapeHtml(point.source || '')}"
            data-confidence="${escapeHtml(String(point.confidence_pct ?? ''))}"
          />
        `
      }).join('')

      return `
        ${entry.points.length > 1 ? `<polyline points="${linePoints}" fill="none" stroke="${entry.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" />` : ''}
        ${circles}
      `
    }).join('')

    svg.innerHTML = `
      <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${height - padBottom}" stroke="#1a3a1a" stroke-width="1" />
      <line x1="${padLeft}" y1="${height - padBottom}" x2="${width - padRight}" y2="${height - padBottom}" stroke="#1a3a1a" stroke-width="1" />
      ${guideMarkup}
      ${seriesMarkup}
    `

    const axisLabelDates = maxTimestamp === minTimestamp
      ? [minTimestamp]
      : [0, 0.33, 0.66, 1].map((ratio) => minTimestamp + Math.round(timeRange * ratio))

    labelsEl.innerHTML = axisLabelDates
      .map((timestamp) => {
        const date = new Date(timestamp)
        const iso = Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
        return `<span class="chart-label">${escapeHtml(formatHistoryDate(iso, true))}</span>`
      })
      .join('')

    svg.querySelectorAll('.price-history-point').forEach((pointEl) => {
      pointEl.addEventListener('mouseenter', (event) => showTooltip(pointEl, event))
      pointEl.addEventListener('mousemove', (event) => showTooltip(pointEl, event))
      pointEl.addEventListener('mouseleave', hideTooltip)
      pointEl.addEventListener('focus', () => showTooltip(pointEl))
      pointEl.addEventListener('blur', hideTooltip)
    })
  }

  function refreshHistory() {
    renderLegend()
    renderPeriods()
    syncTrendBadges()
    syncMarketSummary()
    renderMetrics()
    renderChart()
  }

  refreshHistory()
}

// BAZ anecdotes
async function loadBazAnecdotes(gameId) {
  const shellEl = document.getElementById('baz-anecdote-shell')
  const introEl = document.getElementById('baz-intro')
  const textEl = document.getElementById('baz-text')
  const sourceEl = document.getElementById('baz-source')
  const nextBtn = document.getElementById('baz-next')
  if (!shellEl || !textEl) return

  try {
    const data = await fetchJson(`/api/games/${encodeURIComponent(gameId)}/anecdotes`)
    const anecdotes = Array.isArray(data.anecdotes) ? data.anecdotes.filter((a) => a.anecdote_text) : []

    if (!anecdotes.length) return

    let index = 0

    function render() {
      const a = anecdotes[index]
      if (introEl) introEl.textContent = a.baz_intro || ''
      textEl.textContent = a.anecdote_text
      if (sourceEl) sourceEl.textContent = a.source ? `Source : ${a.source}` : ''
    }

    render()
    shellEl.hidden = false
    if (window.BAZ && window.bazMemory) {
      var _bm = window.bazMemory.load()
      if (!_bm.anecdotesSeen[gameId]) {
        _bm.anecdotesSeen[gameId] = true
        window.bazMemory.save()
        setTimeout(function () { window.BAZ.say('game_enriched', 3000) }, 3000)
      }
    }

    if (anecdotes.length > 1 && nextBtn) {
      nextBtn.hidden = false
      nextBtn.addEventListener('click', () => {
        index = (index + 1) % anecdotes.length
        render()
      })
    }
  } catch (_) {
    // Silent — no anecdote is fine
  }
}

// Game price evolution mini-chart
async function loadGameEvolution(gameId) {
  var shellEl = document.getElementById('game-evolution')
  var svgEl = document.getElementById('game-evolution-svg')
  var summaryEl = document.getElementById('game-evolution-summary')
  if (!shellEl || !svgEl) return

  try {
    var data = await fetchJson('/api/games/' + encodeURIComponent(gameId) + '/snapshots')
    var snapshots = Array.isArray(data.snapshots) ? data.snapshots : []
    if (snapshots.length < 2) return

    var w = svgEl.clientWidth || 300
    var h = 80
    var padL = 4, padR = 4, padT = 4, padB = 14
    var chartW = w - padL - padR, chartH = h - padT - padB

    var values = snapshots.map(function (s) { return Number(s.loose_price) || 0 })
    var dates = snapshots.map(function (s) { return s.snapshot_date })
    var minV = Math.min.apply(null, values) * 0.9
    var maxV = Math.max.apply(null, values) * 1.1 || 1

    var points = values.map(function (v, i) {
      return {
        x: padL + (i / (values.length - 1)) * chartW,
        y: padT + chartH - ((v - minV) / (maxV - minV)) * chartH,
      }
    })

    var polyline = points.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1) }).join(' ')
    var fill = padL + ',' + (padT + chartH) + ' ' + polyline + ' ' + (padL + chartW) + ',' + (padT + chartH)

    svgEl.setAttribute('viewBox', '0 0 ' + w + ' ' + h)
    svgEl.innerHTML =
      '<polygon points="' + fill + '" fill="var(--accent)" opacity="0.1" />' +
      '<polyline points="' + polyline + '" fill="none" stroke="var(--accent)" stroke-width="1.5" />' +
      '<text x="' + padL + '" y="' + (h - 1) + '" fill="var(--text-muted)" font-size="8" font-family="var(--font-ui)">' + (dates[0] || '').slice(5) + '</text>' +
      '<text x="' + (w - padR) + '" y="' + (h - 1) + '" fill="var(--text-muted)" font-size="8" font-family="var(--font-ui)" text-anchor="end">' + (dates[dates.length - 1] || '').slice(5) + '</text>'

    var first = values[0], last = values[values.length - 1]
    var delta = last - first, sign = delta >= 0 ? '+' : ''
    summaryEl.textContent = snapshots.length + ' jours · loose ' + sign + Math.round(delta) + ' (' + (delta >= 0 ? '+' : '') + ((delta / (first || 1)) * 100).toFixed(1) + '%)'

    shellEl.style.display = ''
  } catch (_) {}
}

async function loadArchive(gameId) {
  try {
    const data = await fetchJson(`/api/games/${encodeURIComponent(gameId)}/archive`)
    if (!data.ok) {
      currentArchiveData = null
      renderEditorialContent()
      return
    }

    currentArchiveData = data
    renderEditorialContent()
  } catch (e) {
    currentArchiveData = null
    renderEditorialContent()
    console.warn('[RetroDex] loadArchive failed:', e.message)
  }
}

async function loadPage() {
  const gameId = getGameId()
  currentGameDetailData = null
  currentArchiveData = null
  currentEncyclopediaData = null
  currentRenderedDetailTabs = new Set()
  if (currentFullDetailSchedule) {
    window.clearTimeout(currentFullDetailSchedule)
    currentFullDetailSchedule = null
  }
  buildCatalogueBackLink()
  showSkeleton()
  const slowTimer = window.setTimeout(() => {
    if (heroEl) {
      heroEl.innerHTML = '<div class="loading-card">Chargement lent... la fiche reste en cours de lecture.</div>'
    }
    if (collectionStateEl) {
      collectionStateEl.textContent = 'Lecture lente.'
    }
    runtimeMonitor?.mark('slow-load', { gameId })
  }, 5000)

  if (!gameId) {
    heroEl.innerHTML = '<div class="loading-card">Aucun identifiant de jeu fourni.</div>'
    window.clearTimeout(slowTimer)
    return
  }

  try {
    currentGame = await fetchJson(`/api/games/${encodeURIComponent(gameId)}`)
    runtimeMonitor?.mark('primary-game-loaded', { gameId: currentGame?.id || gameId })
    updateSeoMeta(currentGame)

    if (breadcrumbTitleEl) {
      breadcrumbTitleEl.textContent = (currentGame.title || '').toUpperCase().substring(0, 30) || '--'
    }

    renderHeroSection(currentGame)
    renderProvenance(currentGame)
    renderDetailContentStatus()
    window.clearTimeout(slowTimer)
    updatePriceTimestamp(currentGame.id)
    loadPriceHistory(currentGame.id)

    const preferredIllustrationPromise = getPreferredIllustrationPath(currentGame)

    const coverImgEl = document.getElementById('game-cover-img')
    if (coverImgEl) {
      coverImgEl.alt = (currentGame.title || 'Game') + ' cover'
      const coverUrl = currentGame.coverImage || currentGame.cover_url || ''
      const fallbackCover = coverUrl
        || generateCoverPlaceholder(currentGame.title, currentGame.rarity, currentGame.consoleData?.name || currentGame.console)
      coverImgEl.src = fallbackCover
      coverImgEl.addEventListener('error', () => {
        if (coverImgEl.src !== coverUrl && coverUrl) {
          coverImgEl.src = coverUrl
          return
        }

        coverImgEl.src = generateCoverPlaceholder(currentGame.title, currentGame.rarity, currentGame.consoleData?.name || currentGame.console)
      }, { once: true })

      preferredIllustrationPromise
        .then((preferredIllustration) => {
          if (preferredIllustration) {
            coverImgEl.src = preferredIllustration
          }
        })
        .catch(() => {})
    }

    if (currentGame.tagline) {
      const taglineShellEl = document.getElementById('game-tagline-shell')
      const taglineEl = document.getElementById('game-tagline')
      if (taglineEl && taglineShellEl) {
        taglineEl.textContent = currentGame.tagline
        taglineShellEl.hidden = false
      }
    }

    const franchisePromise = loadFranchise(currentGame)
    renderSummary(currentGame)
    renderStats(currentGame)
    loadRetrodexIndex(currentGame.id).catch((err) => console.error('[game-detail] loadRetrodexIndex unhandled', err))
    loadGameRegions(currentGame.id).catch((err) => console.error('[game-detail] loadGameRegions unhandled', err))
    collectionButtonEl.addEventListener('click', handleCollectionAction)
    wishlistButtonEl?.addEventListener('click', handleWishlistAction)
    collectionRemoveButtonEl?.addEventListener('click', handleCollectionRemove)
    const collectionStatusPromise = refreshCollectionStatus()
    const similarPromise = loadSimilar(currentGame.id)
    const relatedPromise = loadRelatedGames(currentGame)
    const detailLoaded = await loadGameDetailData(currentGame.id)
    if (!detailLoaded) {
      runtimeMonitor?.mark('detail-fallback')
      await Promise.allSettled([
        loadEncyclopedia(currentGame.id),
        loadArchive(currentGame.id),
      ])
    }
    renderDetailContentStatus()
    loadBazAnecdotes(currentGame.id)
    loadGameEvolution(currentGame.id)
    await Promise.allSettled([
      franchisePromise,
      collectionStatusPromise,
      similarPromise,
      relatedPromise,
    ])
    runtimeMonitor?.success({
      gameId: currentGame?.id || gameId,
      detailLoaded,
    })
  } catch (error) {
    heroEl.innerHTML = '<div class="loading-card">Impossible de charger la fiche pour cette session.</div>'
    statsRowEl.innerHTML = ''
    collectionStateEl.textContent = 'Fiche indisponible.'
    collectionButtonEl.disabled = true
    collectionButtonEl.textContent = 'Indisponible'
    if (wishlistButtonEl) {
      wishlistButtonEl.disabled = true
      wishlistButtonEl.textContent = 'Indisponible'
    }
    if (collectionRemoveButtonEl) {
      collectionRemoveButtonEl.hidden = true
      collectionRemoveButtonEl.disabled = true
    }
    if (editorialShellEl) editorialShellEl.hidden = true
    if (relatedShellEl) relatedShellEl.hidden = true
    runtimeMonitor?.fail(error)
  } finally {
    window.clearTimeout(slowTimer)
  }
}

async function hydrateFullGameDetailData(gameId, requestId) {
  const slowTimer = window.setTimeout(() => {
    if (requestId !== currentDetailHydrationRequest || !editorialShellEl || !editorialContentEl) {
      return
    }

    editorialShellEl.hidden = false
    if (!String(editorialContentEl.innerHTML || '').trim()) {
      editorialContentEl.innerHTML = '<div class="detail-empty-state">Lecture detaillee plus lente... la fiche principale reste disponible.</div>'
    }
    runtimeMonitor?.mark('detail-full-slow', { gameId })
  }, 3500)

  try {
    runtimeMonitor?.mark('detail-full-request', { gameId })
    const data = await fetchJson(`/api/games/${encodeURIComponent(gameId)}/detail?scope=full`)
    if (!data.ok || requestId !== currentDetailHydrationRequest) {
      return
    }

    const activeTab = editorialContentEl?.querySelector('.detail-editorial-tab.active')?.dataset.tab || null
    currentGameDetailData = data
    renderEditorialContent()
    if (activeTab) {
      activateEditorialTab(activeTab)
    }
    runtimeMonitor?.mark('detail-full-ready', { gameId, tabCount: Array.isArray(data.tabs) ? data.tabs.length : 0 })
  } catch (error) {
    if (requestId === currentDetailHydrationRequest) {
      console.warn('[RetroDex] detail full hydration failed:', error.message)
      runtimeMonitor?.mark('detail-full-failed', { gameId, message: error.message })
    }
  } finally {
    window.clearTimeout(slowTimer)
  }
}

function setAccordionState(sectionEl, expanded) {
  if (!sectionEl) {
    return
  }

  const toggleEl = sectionEl.querySelector('.detail-accordion-toggle')
  const contentEl = sectionEl.querySelector('.detail-accordion-content')
  if (!toggleEl || !contentEl) {
    return
  }

  sectionEl.classList.toggle('is-open', expanded)
  toggleEl.setAttribute('aria-expanded', expanded ? 'true' : 'false')
  // Indicator is handled by CSS ::before on .detail-accordion-indicator
  contentEl.hidden = !expanded
}

function isAccordionContentEmpty(contentEl) {
  if (!contentEl) return true
  // Check if the content has any visible text or non-empty child elements
  const text = (contentEl.textContent || '').replace(/[\s\-]+/g, '').trim()
  if (!text) return true
  // Check for placeholder-only content (all children are empty/hidden)
  const visibleChildren = Array.from(contentEl.children).filter(function (el) {
    if (el.hidden) return false
    var t = (el.textContent || '').replace(/[\s\-]+/g, '').trim()
    return t.length > 0
  })
  return visibleChildren.length === 0
}

function initDetailAccordions() {
  // Sections that get populated by async fetch — never hide at init
  const asyncSections = ['editorial-shell', 'related-shell', 'price-history-shell']

  document.querySelectorAll('.detail-accordion').forEach((sectionEl) => {
    const toggleEl = sectionEl.querySelector('.detail-accordion-toggle')
    if (!toggleEl || toggleEl.dataset.bound === 'true') {
      return
    }

    toggleEl.dataset.bound = 'true'

    // Hide static sections with empty content (not async, not collection)
    const contentEl = sectionEl.querySelector('.detail-accordion-content')
    if (!asyncSections.includes(sectionEl.id)
        && sectionEl.id !== 'collection-shell'
        && isAccordionContentEmpty(contentEl)) {
      sectionEl.hidden = true
      return
    }

    const defaultOpen = asyncSections.slice(0, 2).includes(sectionEl.id)
    setAccordionState(sectionEl, defaultOpen)
    toggleEl.addEventListener('click', () => {
      const expanded = toggleEl.getAttribute('aria-expanded') === 'true'
      setAccordionState(sectionEl, !expanded)
    })
  })
}

window.handleMarkForSale = handleMarkForSale

initDetailAccordions()
loadPage()
contribSubmitEl?.addEventListener('click', handleContributionSubmit)

