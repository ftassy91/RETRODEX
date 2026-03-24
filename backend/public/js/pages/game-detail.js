'use strict'

const CoreFormat = window.RetroDexFormat || {}
const CoreApi = window.RetroDexApi || {}
const CoreState = window.RetroDexState || {}

const heroEl = document.getElementById('hero')
const summaryEl = document.getElementById('summary')
const statsRowEl = document.getElementById('stats-row')
const collectionStateEl = document.getElementById('collection-state')
const collectionCurrentMetaEl = document.getElementById('collection-current-meta')
const collectionButtonEl = document.getElementById('collection-button')
const wishlistButtonEl = document.getElementById('wishlist-button')
const collectionRemoveButtonEl = document.getElementById('collection-remove-button')
const collectionFormEl = document.getElementById('collection-form')
const collectionConditionEl = document.getElementById('collection-condition')
const collectionPricePaidEl = document.getElementById('collection-price-paid')
const collectionPurchaseDateEl = document.getElementById('collection-purchase-date')
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
const HUB_IMAGE_VERSION = '20260323b'
let hubImageManifestPromise = null

const PRICE_HISTORY_STATES = [
  { key: 'loose', label: 'Loose', condition: 'Loose', color: '#9bbc0f' },
  { key: 'cib', label: 'CIB', condition: 'CIB', color: '#f1c45c' },
  { key: 'mint', label: 'Mint', condition: 'Mint', color: '#7fb0ff' },
]

const DEFAULT_PRICE_HISTORY_PERIOD = '1y'

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

function formatPrice(value, fallback = '--') {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? `$${Math.round(number)}` : fallback
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
    <text x="80" y="122" text-anchor="middle" font-family="BigBlueTerminal" font-size="7" fill="#365136">ARCHIVE SLOT</text>
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

function getGameId() {
  if (typeof CoreState.getParam === 'function') {
    return CoreState.getParam('id')
  }

  return new URLSearchParams(window.location.search).get('id') || ''
}

function truncateMetaDescription(value, maxLength = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (text.length <= maxLength) return text

  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
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
    || `${game.title || 'Ce jeu rétro'} sur ${game.console || 'console inconnue'}${game.year ? ` (${game.year})` : ''}. Prix, rareté et encyclopédie RetroDex.`
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

  const ids = [game?.id, game?.slug].filter(Boolean)
  for (const id of ids) {
    const entry = manifest.find((item) => item && item.game_id === id)
    if (entry?.file) {
      return `/assets/hub_pixel_art/${entry.file}?v=${HUB_IMAGE_VERSION}`
    }
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
  summaryEl.innerHTML = `
    <div class="skeleton skeleton-line-full"></div>
    <div class="skeleton skeleton-line-full"></div>
    <div class="skeleton skeleton-line-medium"></div>
  `
  statsRowEl.innerHTML = `
    <div class="skeleton skeleton-line-full"></div>
    <div class="skeleton skeleton-line-full"></div>
    <div class="skeleton skeleton-line-full"></div>
    <div class="skeleton skeleton-line-full"></div>
  `

  if (editorialShellEl) {
    editorialShellEl.hidden = true
  }

  if (relatedShellEl) {
    relatedShellEl.hidden = true
  }
}

function renderHeroSection(game) {
  const visibleGenre = game.genre && game.genre !== 'Other' ? game.genre : ''
  heroEl.innerHTML = `
    <div class="detail-hero-shell">
      <div class="detail-hero-status">
        <span class="detail-kicker">ARCHIVE ENTRY</span>
        <span class="detail-status-copy">collector record | market signal | editorial memory</span>
      </div>

      <div class="hero-grid detail-hero-grid">
        <section class="game-header detail-identity-panel">
          <div class="game-header-main">
            <div class="game-cover-slot">
              <div class="game-cover-container">
                <img id="game-cover-img" src="" alt="${escapeHtml(game.title || '')}" width="160" height="160" />
              </div>
              <div class="game-cover-caption">ARCHIVE SLOT | COVER ART</div>
            </div>

            <div class="game-header-copy">
              <div class="detail-kicker">GAME FILE</div>
              <h1 class="hero-title page-title">${escapeHtml(game.title)}</h1>

              <div class="game-tagline-shell" id="game-tagline-shell" hidden>
                <span class="detail-inline-label">Collector note</span>
                <div class="game-tagline" id="game-tagline"></div>
              </div>

              <div class="hero-meta game-badges game-meta">
                <span class="pill">${escapeHtml(game.console || 'Console inconnue')}</span>
                <span class="pill">${escapeHtml(game.year || 'n/a')}</span>
                ${visibleGenre ? `<span class="pill">${escapeHtml(visibleGenre)}</span>` : ''}
                <span class="rarity-badge rarity-${escapeHtml(rarityClass(game.rarity))}">${escapeHtml(game.rarity || 'COMMON')}</span>
              </div>

              <div class="game-meta-cluster">
                <div class="game-meta-row">
                  <span class="meta-key">PLATFORM</span>
                  <a class="console-link meta-value-link" href="/consoles.html?platform=${encodeURIComponent(game.console || '')}">
                    ${escapeHtml(game.console || 'Console inconnue')} ->
                  </a>
                </div>
                <div class="game-meta-row">
                  <span class="meta-key">YEAR</span>
                  <span class="meta-value">${escapeHtml(game.year || 'n/a')}</span>
                </div>
                <div class="game-meta-row">
                  <span class="meta-key">DEVELOPER</span>
                  <span class="meta-value">${escapeHtml(game.developer || 'studio inconnu')}</span>
                </div>
                ${game.publisher ? `
                  <div class="game-meta-row">
                    <span class="meta-key">PUBLISHER</span>
                    <span class="meta-value">${escapeHtml(game.publisher)}</span>
                  </div>
                ` : ''}
              </div>

              <div class="surface-signal-grid detail-identity-signal-grid">
                <div class="surface-signal-card">
                  <span class="surface-signal-label">Plateforme</span>
                  <span class="surface-signal-value">${escapeHtml(game.console || 'n/a')}</span>
                </div>
                <div class="surface-signal-card">
                  <span class="surface-signal-label">Annee</span>
                  <span class="surface-signal-value">${escapeHtml(game.year || 'n/a')}</span>
                </div>
                <div class="surface-signal-card">
                  <span class="surface-signal-label">Metascore</span>
                  <span class="surface-signal-value">${escapeHtml(game.metascore || 'n/a')}</span>
                </div>
                <div class="surface-signal-card">
                  <span class="surface-signal-label">Loose</span>
                  <span class="surface-signal-value is-alert">${escapeHtml(formatPrice(game.loosePrice, 'n/a'))}</span>
                </div>
              </div>

              <div class="surface-action-row detail-hero-actions">
                <a class="terminal-action-link" href="#price-history-section">Ouvrir price trace -></a>
                <a class="terminal-action-link" href="/stats.html?q=${encodeURIComponent(game.title || '')}">Ouvrir RetroMarket -></a>
                <a class="terminal-action-link" href="/encyclopedia.html?game=${encodeURIComponent(game.id || '')}">Ouvrir dossier -></a>
              </div>

              <div id="game-relations" class="game-relations"></div>
            </div>
          </div>
        </section>

        <aside class="price-panel detail-market-panel">
          <div class="detail-kicker">MARKET / TRUST</div>
          <p class="market-panel-copy">Valeur par condition, niveau de confiance et fraicheur des donnees.</p>
          <div class="surface-signal-grid detail-market-price-grid">
            <div class="surface-signal-card">
              <span class="surface-signal-label">Loose</span>
              <span class="surface-signal-value is-alert">${escapeHtml(formatPrice(game.loosePrice, 'n/a'))}</span>
            </div>
            <div class="surface-signal-card">
              <span class="surface-signal-label">CIB</span>
              <span class="surface-signal-value">${escapeHtml(formatPrice(game.cibPrice, 'n/a'))}</span>
            </div>
            <div class="surface-signal-card">
              <span class="surface-signal-label">Mint</span>
              <span class="surface-signal-value">${escapeHtml(formatPrice(game.mintPrice, 'n/a'))}</span>
            </div>
          </div>
          <div class="surface-chip-row">
            <span class="surface-chip is-hot">${escapeHtml(game.rarity || 'ARCHIVE')}</span>
            <span class="surface-chip">${visibleGenre ? escapeHtml(visibleGenre) : 'genre n/a'}</span>
            <span class="surface-chip">graphe 1M | 6M | 1A | 10A</span>
          </div>
          <div class="surface-signal-grid is-five detail-market-summary-grid">
            <div class="surface-signal-card">
              <span class="surface-signal-label">Derniere vente</span>
              <span class="surface-signal-value" id="market-last-sale">--</span>
            </div>
            <div class="surface-signal-card">
              <span class="surface-signal-label">Series</span>
              <span class="surface-signal-value" id="market-series">--</span>
            </div>
            <div class="surface-signal-card">
              <span class="surface-signal-label">Profondeur</span>
              <span class="surface-signal-value" id="market-depth">--</span>
            </div>
            <div class="surface-signal-card">
              <span class="surface-signal-label">Fenetre</span>
              <span class="surface-signal-value" id="market-period">1A</span>
            </div>
            <div class="surface-signal-card">
              <span class="surface-signal-label">Statut</span>
              <span class="surface-signal-value" id="market-status">REFERENCE</span>
            </div>
          </div>
          <div class="surface-action-row detail-market-actions">
            <a class="terminal-action-link" href="#price-history-section">Aller au graphe -></a>
            <a class="terminal-action-link" href="/stats.html?q=${encodeURIComponent(game.title || '')}">Voir signaux marche -></a>
          </div>
          <div id="market-metascore" class="market-metascore"></div>
          <div id="retrodex-index" class="index-insufficient">Chargement de l'indice RetroDex...</div>
        </aside>
      </div>

      <section class="price-history" id="price-history-section">
        <div class="detail-section-head compact">
          <div>
            <div class="detail-kicker">PRICE TRACE</div>
            <h3>Price trace | 1A</h3>
            <p class="price-history-copy">Lecture par condition sur la fenetre active. Utilisez les onglets pour comparer le signal marche et la profondeur des ventes.</p>
          </div>
        </div>
        <div class="trend-row">
          <span class="trend-badge" id="trend-loose">Loose --</span>
          <span class="trend-badge" id="trend-cib">CIB --</span>
          <span class="trend-badge" id="trend-mint">Mint --</span>
        </div>
        <div class="chart-toggle">
          <button class="chart-btn active" data-type="mint">Mint</button>
          <button class="chart-btn" data-type="cib">CIB</button>
          <button class="chart-btn" data-type="loose">Loose</button>
        </div>
        <div class="period-selector">
          <button class="period-btn" data-period="30">1M</button>
          <button class="period-btn" data-period="180">6M</button>
          <button class="period-btn active" data-period="365">1A</button>
          <button class="period-btn" data-period="3650">10A</button>
        </div>
        <div class="chart-container">
          <svg id="price-chart" viewBox="0 0 600 160" preserveAspectRatio="none"></svg>
          <div class="chart-labels" id="chart-labels"></div>
        </div>
        <div class="price-stats-row">
          <div class="price-stat">
            <span class="stat-label">12M MIN</span>
            <span class="stat-value" id="stat-min">--</span>
          </div>
          <div class="price-stat">
            <span class="stat-label">12M MAX</span>
            <span class="stat-value" id="stat-max">--</span>
          </div>
          <div class="price-stat">
            <span class="stat-label">VARIATION</span>
            <span class="stat-value" id="stat-variation">--</span>
          </div>
        </div>
      </section>
    </div>
  `
}

function confidenceClass(value) {
  const pct = Number(value) || 0
  if (pct >= 70) return 'confidence-high'
  if (pct >= 30) return 'confidence-mid'
  return 'confidence-low'
}

function getTrustMeta(value) {
  const pct = Number(value) || 0
  if (pct >= 80) return { tier: 'T1', label: 'VERIFIE' }
  if (pct >= 60) return { tier: 'T2', label: 'FIABLE' }
  if (pct >= 30) return { tier: 'T3', label: 'INDICATIF' }
  if (pct >= 10) return { tier: 'T4', label: 'ESTIME' }
  return { tier: 'T0', label: 'INCONNU' }
}

function getFreshnessLabel(value) {
  const freshness = String(value || '').toLowerCase()
  if (freshness === 'recent') return 'signal recent'
  if (freshness === 'aging') return 'signal en veille'
  if (freshness === 'stale') return 'signal vieillissant'
  return 'signal ancien'
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
    return formattedDate
      ? `${sourcesEditorial} ventes reelles | derniere: ${formattedDate}`
      : `${sourcesEditorial} ventes reelles`
  }

  if ((Number(confidence) || 0) === 15) {
    return 'estimation statistique - aucune vente verifiee'
  }

  return 'aucune donnee - contribuez un prix'
}

function formatIndexRange(low, high) {
  const lowNumber = Number(low)
  const highNumber = Number(high)
  if (!Number.isFinite(lowNumber) || !Number.isFinite(highNumber) || lowNumber <= 0 || highNumber <= 0) {
    return 'n/a'
  }

  return `$${Math.round(lowNumber)} - $${Math.round(highNumber)}`
}

async function loadRetrodexIndex(gameId) {
  const indexEl = document.getElementById('retrodex-index')
  if (!indexEl) {
    return
  }

  try {
    const payload = await fetchJson(`/api/index/${encodeURIComponent(gameId)}`)
    const entries = safeArray(payload.index)
    const hasUsableIndex = entries.some((entry) => (Number(entry.index_value) || 0) > 0)

    if (!entries.length || !hasUsableIndex) {
      indexEl.className = 'index-insufficient'
      indexEl.textContent = 'Donnees insuffisantes - contribuez un prix'
      return
    }

    const orderedEntries = ['Loose', 'CIB', 'Mint'].map((condition) =>
      entries.find((entry) => entry.condition === condition) || { condition }
    )
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
        <span class="index-primary-value">${escapeHtml(formatPrice(primaryEntry.index_value))}</span>
        <span class="index-primary-meta">${escapeHtml(primaryEntry.condition || 'n/a')} | ${escapeHtml(formatIndexRange(primaryEntry.range_low, primaryEntry.range_high))}</span>
      </div>
      <div class="trust-header">
        <span class="trust-badge trust-${trustMeta.tier}">TIER ${trustMeta.tier} | ${trustMeta.label}</span>
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
            <span class="value">${escapeHtml(formatPrice(entry.index_value))}</span>
            <span class="range">${escapeHtml(formatIndexRange(entry.range_low, entry.range_high))}</span>
          </div>
        `).join('')}
      </div>
    `
  } catch (_error) {
    indexEl.className = 'index-insufficient'
    indexEl.textContent = 'Donnees insuffisantes - contribuez un prix'
  }
}

function activateEditorialTab(tabId) {
  editorialContentEl.querySelectorAll('.detail-editorial-tab').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tabId)
  })

  editorialContentEl.querySelectorAll('.detail-editorial-panel').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tabId
  })
}

async function loadEncyclopedia(gameId) {
  if (!editorialShellEl || !editorialContentEl) {
    return
  }

  try {
    const data = await fetchJson(`/api/games/${gameId}/encyclopedia`)
    if (!data.ok) {
      editorialShellEl.hidden = true
      return
    }

    const sections = []
    const synopsis = String(data.synopsis || '').trim()
    const devTeam = safeArray(data.dev_team)
    const anecdotes = safeArray(data.dev_anecdotes)
    const cheatCodes = safeArray(data.cheat_codes)

    if (synopsis) {
      sections.push({
        id: 'synopsis',
        label: 'SYNOPSIS',
        html: `<div class="encyclo-text editorial-prose">${formatMultilineHtml(synopsis)}</div>`,
      })
    }

    if (devTeam.length) {
      sections.push({
        id: 'team',
        label: 'EQUIPE',
        html: devTeam.map((member) => `
          <div class="encyclo-team-row">
            <span class="team-role">${escapeHtml(member.role || 'Role inconnu')}</span>
            <span class="team-name">${escapeHtml(member.name || 'Nom inconnu')}</span>
            ${member.note ? `<span class="team-note">${escapeHtml(member.note)}</span>` : ''}
          </div>
        `).join(''),
      })
    }

    if (anecdotes.length) {
      sections.push({
        id: 'anecdotes',
        label: 'ANECDOTES',
        html: anecdotes.map((item, index) => `
          <div class="encyclo-anecdote">
            <div class="anecdote-title">${escapeHtml(item.title || `Anecdote ${index + 1}`)}</div>
            <div class="anecdote-text">${formatMultilineHtml(item.text || item)}</div>
          </div>
        `).join(''),
      })
    }

    if (cheatCodes.length) {
      sections.push({
        id: 'codes',
        label: 'CODES',
        html: cheatCodes.map((code) => `
          <div class="encyclo-cheat-row">
            <span class="cheat-name">${escapeHtml(code.label || code.name || 'Code')}</span>
            <span class="cheat-code">${escapeHtml(code.code || code.value || '--')}</span>
            <span class="cheat-effect">${escapeHtml(code.effect || 'Effet non documente')}</span>
          </div>
        `).join(''),
      })
    }

    if (!sections.length) {
      editorialShellEl.hidden = true
      editorialContentEl.innerHTML = ''
      return
    }

    editorialShellEl.hidden = false
    editorialContentEl.innerHTML = `
      <div class="editorial-intro">
        <div class="detail-inline-label">From signal to memory</div>
        <p class="detail-section-copy">
          La cote et la confiance donnent le contexte. L'encyclopedie commence ici.
        </p>
      </div>
      <div class="detail-editorial-tabs">
        ${sections.map((section, index) => `
          <button type="button" class="detail-editorial-tab ${index === 0 ? 'active' : ''}" data-tab="${section.id}">
            ${section.label}
          </button>
        `).join('')}
      </div>
      <div class="detail-editorial-panels">
        ${sections.map((section, index) => `
          <section class="detail-editorial-panel" data-panel="${section.id}" ${index === 0 ? '' : 'hidden'}>
            ${section.html}
          </section>
        `).join('')}
      </div>
    `

    editorialContentEl.querySelectorAll('.detail-editorial-tab').forEach((button) => {
      button.addEventListener('click', () => activateEditorialTab(button.dataset.tab))
    })
  } catch (error) {
    editorialShellEl.hidden = true
    editorialContentEl.innerHTML = ''
    console.warn('Encyclopedia load failed:', error.message)
  }
}

async function loadFranchise(gameId) {
  try {
    const data = await fetchJson(`/api/games/${gameId}/franchise`)
    if (!data.ok || !data.franchise) {
      return
    }

    const relationsEl = document.getElementById('game-relations')
    if (!relationsEl) {
      return
    }

    const franchise = data.franchise
    relationsEl.innerHTML = `
      <a class="terminal-action-link franchise-link" href="/franchises.html?slug=${encodeURIComponent(franchise.slug)}">
        FRANCHISE | ${escapeHtml(franchise.name)} (${escapeHtml(franchise.first_game || 'n/a')}-${escapeHtml(franchise.last_game || 'n/a')}) ->
      </a>
    `
  } catch (_error) {}
}

function renderSummary(game) {
  const summary = String(game.summary || game.synopsis || '').trim()
  summaryEl.innerHTML = summary
    ? formatMultilineHtml(summary)
    : 'Aucun resume editorial disponible.'
}

function renderStats(game) {
  const stats = [
    { label: 'Plateforme', value: game.console },
    { label: 'Annee', value: game.year },
    { label: 'Genre', value: game.genre && game.genre !== 'Other' ? game.genre : '' },
    { label: 'Rarete', value: game.rarity },
    { label: 'Developpeur', value: game.developer },
    { label: 'Editeur', value: game.publisher },
    { label: 'Metascore', value: '__METASCORE__', id: 'stat-metascore' },
    { label: 'Slug', value: game.slug },
  ].filter((entry) => entry.value != null && String(entry.value).trim() !== '')

  statsRowEl.innerHTML = stats.map(({ label, value, id }) => `
    <div class="stat-cell">
      <span class="label">${escapeHtml(label)}</span>
      <span class="value"${id ? ` id="${id}"` : ''}>${value === '__METASCORE__' ? '--' : escapeHtml(value)}</span>
    </div>
  `).join('')

  const statMeta = document.getElementById('stat-metascore')
  if (statMeta && window.RetroDexMetascore) {
    if (game.metascore) {
      const color = window.RetroDexMetascore.getColor(game.metascore)
      const label = window.RetroDexMetascore.getLabel(game.metascore)
      statMeta.textContent = `${game.metascore} | ${label}`
      statMeta.style.color = color
    } else {
      statMeta.textContent = 'N/A'
      statMeta.style.color = '#333333'
    }
  }
}

function populateCollectionForm(item) {
  if (collectionConditionEl) {
    collectionConditionEl.value = item?.condition || 'Loose'
  }
  if (collectionPricePaidEl) {
    collectionPricePaidEl.value = item?.price_paid != null ? String(item.price_paid) : ''
  }
  if (collectionPurchaseDateEl) {
    collectionPurchaseDateEl.value = item?.purchase_date || ''
  }
  if (collectionNotesEl) {
    collectionNotesEl.value = getCollectionNote(item)
  }
}

function readCollectionFormValues() {
  const condition = collectionConditionEl?.value || 'Loose'
  const rawPrice = String(collectionPricePaidEl?.value || '').trim()
  const price_paid = rawPrice ? Number(rawPrice) : null
  const purchase_date = String(collectionPurchaseDateEl?.value || '').trim() || null
  const notes = String(collectionNotesEl?.value || '').trim() || null

  if (rawPrice && (!Number.isFinite(price_paid) || price_paid <= 0)) {
    throw new Error('Prix d achat invalide.')
  }

  if (purchase_date && !/^\d{4}-\d{2}-\d{2}$/.test(purchase_date)) {
    throw new Error('Date d achat invalide.')
  }

  return {
    condition,
    price_paid,
    purchase_date,
    notes,
    personal_note: notes,
  }
}

function buildCollectionMeta(item, listType) {
  if (!item) {
    return ''
  }

  const fragments = [
    `<span class="condition-badge condition-${escapeHtml(conditionClass(item.condition))}">${escapeHtml(item.condition || 'Loose')}</span>`,
  ]

  if (listType === 'wanted') {
    fragments.push('<span class="collection-note-text">Wishlist</span>')
  } else if (listType === 'for_sale') {
    fragments.push('<span class="collection-note-text">Liste a vendre</span>')
  }

  if (item.price_paid != null) {
    fragments.push(`<span class="collection-note-text">Paye ${escapeHtml(formatPrice(item.price_paid))}</span>`)
  }

  if (item.purchase_date) {
    fragments.push(`<span class="collection-note-text">Achete le ${escapeHtml(item.purchase_date)}</span>`)
  }

  const note = getCollectionNote(item)
  if (note) {
    fragments.push(`<span class="collection-note-text">${escapeHtml(note)}</span>`)
  }

  return fragments.join('')
}

function applyCollectionUiState(item, options = {}) {
  if (options.error) {
    collectionStateEl.textContent = `Impossible de charger la collection (${options.error.message}).`
    collectionCurrentMetaEl.innerHTML = ''
    collectionFormEl.hidden = false
    collectionButtonEl.disabled = true
    if (wishlistButtonEl) {
      wishlistButtonEl.disabled = true
      wishlistButtonEl.textContent = 'Wishlist indisponible'
    }
    if (collectionRemoveButtonEl) {
      collectionRemoveButtonEl.hidden = true
      collectionRemoveButtonEl.disabled = true
    }
    populateCollectionForm(null)
    return
  }

  collectionFormEl.hidden = false
  populateCollectionForm(item)

  if (!item) {
    collectionStateEl.textContent = "Ce jeu n'est pas encore dans vos listes."
    collectionCurrentMetaEl.innerHTML = ''
    collectionButtonEl.textContent = 'Ajouter a ma collection'
    collectionButtonEl.disabled = false
    if (wishlistButtonEl) {
      wishlistButtonEl.textContent = 'Ajouter a ma wishlist'
      wishlistButtonEl.disabled = false
    }
    if (collectionRemoveButtonEl) {
      collectionRemoveButtonEl.hidden = true
      collectionRemoveButtonEl.disabled = true
      collectionRemoveButtonEl.textContent = 'Retirer'
    }
    return
  }

  const listType = normalizeCollectionListType(item.list_type)
  collectionCurrentMetaEl.innerHTML = buildCollectionMeta(item, listType)

  if (listType === 'wanted') {
    collectionStateEl.textContent = 'Dans votre wishlist'
    collectionButtonEl.textContent = 'Ajouter a ma collection'
    collectionButtonEl.disabled = false
    if (wishlistButtonEl) {
      wishlistButtonEl.textContent = 'Dans ma wishlist'
      wishlistButtonEl.disabled = true
    }
    if (collectionRemoveButtonEl) {
      collectionRemoveButtonEl.hidden = false
      collectionRemoveButtonEl.disabled = false
      collectionRemoveButtonEl.textContent = 'Retirer de ma wishlist'
    }
    return
  }

  if (listType === 'for_sale') {
    collectionStateEl.textContent = 'Dans votre liste a vendre'
    collectionButtonEl.textContent = 'Enregistrer les modifications'
    collectionButtonEl.disabled = false
    if (wishlistButtonEl) {
      wishlistButtonEl.textContent = 'Deja suivi'
      wishlistButtonEl.disabled = true
    }
    if (collectionRemoveButtonEl) {
      collectionRemoveButtonEl.hidden = false
      collectionRemoveButtonEl.disabled = false
      collectionRemoveButtonEl.textContent = 'Retirer de ma liste'
    }
    return
  }

  collectionStateEl.textContent = 'Dans votre collection'
  collectionButtonEl.textContent = 'Enregistrer les modifications'
  collectionButtonEl.disabled = false
  if (wishlistButtonEl) {
    wishlistButtonEl.textContent = 'Deja en collection'
    wishlistButtonEl.disabled = true
  }
  if (collectionRemoveButtonEl) {
    collectionRemoveButtonEl.hidden = false
    collectionRemoveButtonEl.disabled = false
    collectionRemoveButtonEl.textContent = 'Retirer de ma collection'
  }
}

async function refreshCollectionStatus() {
  if (!currentGame) {
    return
  }

  try {
    const payload = await fetchJson('/api/collection')
    currentCollectionItem = safeArray(payload.items).find((item) => item.gameId === currentGame.id) || null
    applyCollectionUiState(currentCollectionItem)
  } catch (error) {
    applyCollectionUiState(null, { error })
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
      collectionStatusEl.textContent = listType === 'wanted'
        ? 'Jeu deplace dans votre collection.'
        : 'Fiche collection mise a jour.'
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
      collectionStatusEl.textContent = 'Jeu ajoute a votre collection.'
    }

    await refreshCollectionStatus()
  } catch (error) {
    collectionStatusEl.textContent = `Erreur collection: ${error.message}`
    applyCollectionUiState(currentCollectionItem)
  }
}

async function handleWishlistAction() {
  if (!currentGame || !wishlistButtonEl) {
    return
  }

  const listType = currentCollectionItem ? normalizeCollectionListType(currentCollectionItem.list_type) : null
  if (listType === 'wanted') {
    collectionStatusEl.textContent = 'Ce jeu est deja dans votre wishlist.'
    return
  }
  if (listType === 'owned' || listType === 'for_sale') {
    collectionStatusEl.textContent = 'Ce jeu existe deja dans vos listes.'
    return
  }

  collectionButtonEl.disabled = true
  wishlistButtonEl.disabled = true
  if (collectionRemoveButtonEl) {
    collectionRemoveButtonEl.disabled = true
  }
  collectionStatusEl.textContent = 'Ajout a la wishlist...'

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

    collectionStatusEl.textContent = 'Jeu ajoute a votre wishlist.'
    await refreshCollectionStatus()
  } catch (error) {
    collectionStatusEl.textContent = `Erreur wishlist: ${error.message}`
    applyCollectionUiState(currentCollectionItem)
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
      : 'de votre collection'

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
    collectionStatusEl.textContent = 'Jeu retire.'
    await refreshCollectionStatus()
  } catch (error) {
    collectionStatusEl.textContent = `Erreur suppression: ${error.message}`
    applyCollectionUiState(currentCollectionItem)
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

    await fetchJson('/api/reports', {
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
        <div class="detail-kicker">SECONDARY PATH</div>
        <h3>${escapeHtml(title)}</h3>
      </div>
      ${copy ? `<p class="detail-section-copy">${escapeHtml(copy)}</p>` : ''}
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

function renderRelatedPrices(current, related) {
  upsertRelatedModule(
    'franchise-versions',
    'Meme franchise | autres versions',
    'Comparaison rapide avec les variantes les plus proches.',
    `
      <div class="compare-table">
        <div class="compare-row compare-header">
          <span>Titre</span>
          <span>Console</span>
          <span>Loose</span>
          <span>Mint</span>
          <span>Rarete</span>
        </div>
        <div class="compare-row current">
          <span>${escapeHtml(current.title)}</span>
          <span>${escapeHtml(current.console || 'n/a')}</span>
          <span>${escapeHtml(formatPrice(current.loosePrice))}</span>
          <span>${escapeHtml(formatPrice(current.mintPrice))}</span>
          <span class="rarity-badge rarity-${escapeHtml(rarityClass(current.rarity))}">${escapeHtml(current.rarity || 'COMMON')}</span>
        </div>
        ${related.map((game) => `
          <div class="compare-row clickable" onclick="window.location='/game-detail.html?id=${encodeURIComponent(game.id)}'">
            <span>${escapeHtml(game.title)}</span>
            <span>${escapeHtml(game.console || 'n/a')}</span>
            <span>${escapeHtml(formatPrice(game.loosePrice))}</span>
            <span>${escapeHtml(formatPrice(game.mintPrice))}</span>
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
  if (!series || series.length < 3) {
    return
  }

  try {
    const data = await fetchJson(`/api/games?q=${encodeURIComponent(series)}&limit=50`)
    const normalizedSeries = series.toLowerCase()
    const currentTitle = String(game.title || '').toLowerCase()
    const spinOffKeywords = ['party', 'kart', 'golf', 'tennis', 'tactics', 'legend', 'revenant', '& luigi', 'paper mario']
    const related = safeArray(data.items)
      .filter((item) => item.id !== game.id)
      .filter((item) => String(item.title || '').toLowerCase().includes(normalizedSeries))
      .sort((left, right) => {
        const score = (candidate) => {
          const title = String(candidate.title || '').toLowerCase()
          let total = 0
          if (title.startsWith(normalizedSeries)) total += 20
          if (currentTitle.startsWith('super mario') && title.startsWith('super mario')) total += 40
          if (String(candidate.console || '').toLowerCase() === String(game.console || '').toLowerCase()) total += 15
          if (spinOffKeywords.some((keyword) => title.includes(keyword))) total -= 25
          total -= Math.abs(title.length - currentTitle.length) * 0.1
          return total
        }

        return score(right) - score(left)
      })
      .slice(0, 4)

    if (related.length < 2) {
      return
    }

    renderRelatedPrices(game, related)
  } catch (error) {
    console.warn('[RetroDex] Related franchise lookup failed:', error.message)
  }
}

async function loadSimilar(gameId) {
  removeRelatedModule('similar-games')

  try {
    const data = await fetchJson(`/api/games/${gameId}/similar`)
    if (!data.ok || !safeArray(data.games).length) {
      return
    }

    upsertRelatedModule(
      'similar-games',
      'Jeux similaires',
      'Exploration secondaire basee sur le genre, la periode et la proximite de catalogue.',
      `
        <div id="similar-grid">
          ${safeArray(data.games).map((game) => `
            <div class="similar-item" onclick="window.location='/game-detail.html?id=${encodeURIComponent(game.id)}'">
              <div class="similar-title">${escapeHtml(game.title)}</div>
              <div class="similar-meta">${escapeHtml(game.console || 'n/a')} | ${escapeHtml(game.year || 'n/a')}</div>
              <div class="similar-price">${escapeHtml(formatPrice(game.loosePrice))}</div>
            </div>
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
      return `Reference courante | ${formatPrice(observation.value, 'n/a')}`
    }

    return `${formatHistoryDate(observation.date)} | ${formatPrice(observation.value, 'n/a')}`
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
      <div>${escapeHtml(formatPrice(value, 'n/a'))}</div>
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
        ? `${formatPrice(latestObservation.observation.value, 'n/a')} | ${formatHistoryDate(latestObservation.observation.date)}`
        : '--'
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
      headingEl.textContent = `Price trace | ${period.label || 'ALL'}`
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
              <span class="stat-value">${escapeHtml(formatPrice(series.current_price, 'n/a'))}</span>
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
        <text x="${padLeft - 6}" y="${y + 4}" text-anchor="end" fill="#3f6a3f" font-size="10">$${Math.round(value)}</text>
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

async function loadPage() {
  const gameId = getGameId()
  buildCatalogueBackLink()
  showSkeleton()

  if (!gameId) {
    heroEl.innerHTML = '<div class="loading-card">Aucun identifiant de jeu fourni.</div>'
    summaryEl.textContent = 'Impossible de charger cette fiche sans identifiant.'
    return
  }

  try {
    currentGame = await fetchJson(`/api/games/${encodeURIComponent(gameId)}`)
    updateSeoMeta(currentGame)

    if (breadcrumbTitleEl) {
      breadcrumbTitleEl.textContent = (currentGame.title || '').toUpperCase().substring(0, 30) || '--'
    }

    renderHeroSection(currentGame)

    const coverImgEl = document.getElementById('game-cover-img')
    if (coverImgEl) {
      coverImgEl.alt = currentGame.title || ''
      const preferredIllustration = await getPreferredIllustrationPath(currentGame)
      coverImgEl.src = preferredIllustration
        || currentGame.cover_url
        || generateCoverPlaceholder(currentGame.title, currentGame.rarity, currentGame.console)
      coverImgEl.addEventListener('error', () => {
        if (coverImgEl.src !== currentGame.cover_url && currentGame.cover_url) {
          coverImgEl.src = currentGame.cover_url
          return
        }

        coverImgEl.src = generateCoverPlaceholder(currentGame.title, currentGame.rarity, currentGame.console)
      }, { once: true })
    }

    if (currentGame.tagline) {
      const taglineShellEl = document.getElementById('game-tagline-shell')
      const taglineEl = document.getElementById('game-tagline')
      if (taglineEl && taglineShellEl) {
        taglineEl.textContent = currentGame.tagline
        taglineShellEl.hidden = false
      }
    }

    await loadFranchise(currentGame.id)
    await loadRetrodexIndex(currentGame.id)
    renderSummary(currentGame)
    renderStats(currentGame)
    collectionButtonEl.addEventListener('click', handleCollectionAction)
    wishlistButtonEl?.addEventListener('click', handleWishlistAction)
    collectionRemoveButtonEl?.addEventListener('click', handleCollectionRemove)
    await refreshCollectionStatus()
    await loadEncyclopedia(currentGame.id)
    await loadSimilar(currentGame.id)
    await loadPriceHistory(currentGame.id)
    await loadRelatedGames(currentGame)
  } catch (error) {
    heroEl.innerHTML = `<div class="loading-card">Impossible de charger la fiche (${escapeHtml(error.message)}).</div>`
    summaryEl.textContent = 'Erreur de chargement.'
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
  }
}

loadPage()
contribSubmitEl?.addEventListener('click', handleContributionSubmit)
