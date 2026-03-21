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
const collectionFormEl = document.getElementById('collection-form')
const collectionConditionEl = document.getElementById('collection-condition')
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

function formatPrice(value, fallback = '—') {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? `$${Math.round(number)}` : fallback
}

function formatMultilineHtml(value, fallback = '—') {
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
    <text x="80" y="76" text-anchor="middle" font-family="monospace" font-size="42" font-weight="bold" fill="#00ff66" opacity="0.82">${initials || '?'}</text>
    <text x="80" y="100" text-anchor="middle" font-family="monospace" font-size="9" fill="#486648">${platformLabel}</text>
    <text x="80" y="122" text-anchor="middle" font-family="monospace" font-size="7" fill="#365136">ARCHIVE SLOT</text>
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

function getGameId() {
  if (typeof CoreState.getParam === 'function') {
    return CoreState.getParam('id')
  }

  return new URLSearchParams(window.location.search).get('id') || ''
}

function buildCatalogueBackLink() {
  const params = new URLSearchParams(window.location.search)
  params.delete('id')
  const query = params.toString()
  catalogBackLinkEl.href = query ? `/games-list.html?${query}` : '/games-list.html'
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
  heroEl.innerHTML = `
    <div class="detail-hero-shell">
      <div class="detail-hero-status">
        <span class="detail-kicker">ARCHIVE ENTRY</span>
        <span class="detail-status-copy">collector record · market signal · editorial memory</span>
      </div>

      <div class="hero-grid detail-hero-grid">
        <section class="game-header detail-identity-panel">
          <div class="game-header-main">
            <div class="game-cover-slot">
              <div class="game-cover-container">
                <img id="game-cover-img" src="" alt="${escapeHtml(game.title || '')}" width="160" height="160" />
              </div>
              <div class="game-cover-caption">ARCHIVE SLOT · COVER ART</div>
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
                <span class="pill">${escapeHtml(game.genre || 'Genre inconnu')}</span>
                <span class="rarity-badge rarity-${escapeHtml(rarityClass(game.rarity))}">${escapeHtml(game.rarity || 'COMMON')}</span>
              </div>

              <div class="game-meta-cluster">
                <div class="game-meta-row">
                  <span class="meta-key">PLATFORM</span>
                  <a class="console-link meta-value-link" href="/consoles.html?platform=${encodeURIComponent(game.console || '')}">
                    ${escapeHtml(game.console || 'Console inconnue')} &rarr;
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

              <div id="game-relations" class="game-relations"></div>
            </div>
          </div>
        </section>

        <aside class="price-panel detail-market-panel">
          <div class="detail-kicker">MARKET / TRUST</div>
          <p class="market-panel-copy">Valeur par condition, niveau de confiance et fraicheur des donnees.</p>
          <div id="retrodex-index" class="index-insufficient">Chargement de l'indice RetroDex...</div>
        </aside>
      </div>

      <section class="price-history">
        <div class="detail-section-head compact">
          <div>
            <div class="detail-kicker">PRICE TRACE</div>
            <h3>Historique des prix · 12 mois</h3>
          </div>
        </div>
        <div class="trend-row">
          <span class="trend-badge" id="trend-loose">Loose —</span>
          <span class="trend-badge" id="trend-cib">CIB —</span>
          <span class="trend-badge" id="trend-mint">Mint —</span>
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
            <span class="stat-value" id="stat-min">—</span>
          </div>
          <div class="price-stat">
            <span class="stat-label">12M MAX</span>
            <span class="stat-value" id="stat-max">—</span>
          </div>
          <div class="price-stat">
            <span class="stat-label">VARIATION</span>
            <span class="stat-value" id="stat-variation">—</span>
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
      ? `${sourcesEditorial} ventes reelles · derniere : ${formattedDate}`
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
    return '—'
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
        <span class="index-primary-meta">${escapeHtml(primaryEntry.condition || '—')} · ${escapeHtml(formatIndexRange(primaryEntry.range_low, primaryEntry.range_high))}</span>
      </div>
      <div class="trust-header">
        <span class="trust-badge trust-${trustMeta.tier}">TIER ${trustMeta.tier} · ${trustMeta.label}</span>
        <span class="trust-source">${escapeHtml(trustSource)}</span>
      </div>
      <div class="trust-support-row">
        <span class="trust-freshness">${escapeHtml(getFreshnessLabel(freshest))}</span>
        <span class="index-sources">${sourcesEditorial} ventes · 0 listings · ${sourcesCommunity} contributions</span>
      </div>
      <div class="index-prices">
        ${orderedEntries.map((entry) => `
          <div class="index-condition ${entry.condition === primaryEntry.condition ? 'is-primary' : ''}">
            <span class="label">${escapeHtml(entry.condition || '—')}</span>
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
            <span class="cheat-code">${escapeHtml(code.code || code.value || '—')}</span>
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
        FRANCHISE · ${escapeHtml(franchise.name)} (${escapeHtml(franchise.first_game || '—')}→${escapeHtml(franchise.last_game || '—')}) →
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
    ['Plateforme', game.console],
    ['Annee', game.year],
    ['Genre', game.genre],
    ['Rarete', game.rarity],
    ['Developpeur', game.developer],
    ['Editeur', game.publisher],
    ['Metascore', game.metascore],
    ['Slug', game.slug],
  ].filter(([, value]) => value != null && String(value).trim() !== '')

  statsRowEl.innerHTML = stats.map(([label, value]) => `
    <div class="stat-cell">
      <span class="label">${escapeHtml(label)}</span>
      <span class="value">${escapeHtml(value)}</span>
    </div>
  `).join('')
}

async function refreshCollectionStatus() {
  if (!currentGame) {
    return
  }

  try {
    const payload = await fetchJson('/api/collection')
    currentCollectionItem = safeArray(payload.items).find((item) => item.gameId === currentGame.id) || null

    if (currentCollectionItem) {
      collectionStateEl.textContent = 'Dans votre collection ✓'
      collectionCurrentMetaEl.innerHTML = `
        <span class="condition-badge condition-${escapeHtml(conditionClass(currentCollectionItem.condition))}">
          ${escapeHtml(currentCollectionItem.condition || 'Loose')}
        </span>
        ${currentCollectionItem.notes ? `<span class="collection-note-text">${escapeHtml(currentCollectionItem.notes)}</span>` : ''}
      `
      collectionFormEl.hidden = true
      collectionButtonEl.textContent = 'Retirer'
      collectionButtonEl.disabled = false
    } else {
      collectionStateEl.textContent = "Ce jeu n'est pas encore dans votre collection."
      collectionCurrentMetaEl.innerHTML = ''
      collectionFormEl.hidden = false
      collectionButtonEl.textContent = 'Ajouter a ma collection'
      collectionButtonEl.disabled = false
    }
  } catch (error) {
    collectionStateEl.textContent = `Impossible de charger la collection (${error.message}).`
    collectionCurrentMetaEl.innerHTML = ''
    collectionFormEl.hidden = false
    collectionButtonEl.disabled = true
  }
}

async function handleCollectionAction() {
  if (!currentGame) {
    return
  }

  collectionButtonEl.disabled = true
  collectionStatusEl.textContent = 'Mise a jour...'

  try {
    if (currentCollectionItem) {
      await fetchJson(`/api/collection/${encodeURIComponent(currentCollectionItem.id)}`, {
        method: 'DELETE',
      })
      collectionStatusEl.textContent = 'Jeu retire de votre collection.'
    } else {
      const condition = collectionConditionEl?.value || 'Loose'
      const notes = collectionNotesEl?.value?.trim() || null
      await fetchJson('/api/collection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameId: currentGame.id,
          condition,
          notes,
        }),
      })
      collectionStatusEl.textContent = 'Jeu ajoute a votre collection.'
    }

    await refreshCollectionStatus()
  } catch (error) {
    collectionStatusEl.textContent = `Erreur collection: ${error.message}`
    collectionButtonEl.disabled = false
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
    'Meme franchise · autres versions',
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
              <div class="similar-meta">${escapeHtml(game.console || '—')} · ${escapeHtml(game.year || '—')}</div>
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

async function loadPriceHistory(gameId) {
  const response = await fetch(`/api/games/${encodeURIComponent(gameId)}/price-history`)
  if (!response.ok) {
    return
  }

  const data = await response.json()

  ;['loose', 'cib', 'mint'].forEach((type) => {
    const badge = document.getElementById(`trend-${type}`)
    if (!badge) {
      return
    }

    const trend = data.trend?.[type] || 'stable'
    badge.textContent = type.toUpperCase()
    badge.classList.remove('up', 'down', 'stable')
    badge.classList.add(trend)
  })

  let activeType = 'mint'
  let activePeriodDays = 365

  function monthToDate(value) {
    const [year, month] = String(value || '').split('-').map((part) => Number.parseInt(part, 10))
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      return null
    }

    return new Date(Date.UTC(year, Math.max(0, month - 1), 1))
  }

  function filterHistory(periodDays) {
    const history = safeArray(data.history)
    if (!history.length) {
      return []
    }

    const latestDate = monthToDate(history[history.length - 1].month)
    if (!latestDate) {
      return history
    }

    const cutoff = new Date(latestDate.getTime() - periodDays * 24 * 60 * 60 * 1000)
    const filtered = history.filter((entry) => {
      const entryDate = monthToDate(entry.month)
      return entryDate ? entryDate >= cutoff : false
    })

    return filtered.length ? filtered : []
  }

  function drawChart(type) {
    const filteredHistory = filterHistory(activePeriodDays)
    const prices = filteredHistory.map((entry) => Number(entry[type]) || 0)
    const svg = document.getElementById('price-chart')
    const labels = document.getElementById('chart-labels')
    const statMinEl = document.getElementById('stat-min')
    const statMaxEl = document.getElementById('stat-max')
    const variationEl = document.getElementById('stat-variation')

    if (!svg || !labels || !statMinEl || !statMaxEl || !variationEl) {
      return
    }

    if (!prices.length) {
      svg.innerHTML = `
        <text x="300" y="84" text-anchor="middle" fill="#5a8a5a" font-size="13">
          Aucune vente sur cette periode
        </text>
      `
      labels.innerHTML = ''
      statMinEl.textContent = '—'
      statMaxEl.textContent = '—'
      variationEl.textContent = '—'
      variationEl.style.color = ''
      return
    }

    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const range = max - min || 1
    const width = 600
    const height = 160
    const pad = 10
    const denominator = Math.max(prices.length - 1, 1)

    const points = prices.map((price, index) => {
      const x = prices.length === 1 ? width / 2 : pad + (index / denominator) * (width - pad * 2)
      const y = height - pad - ((price - min) / range) * (height - pad * 2)
      return `${x},${y}`
    }).join(' ')

    svg.innerHTML = `
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#1a3a1a" stroke-width="1"/>
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#1a3a1a" stroke-width="1"/>
      <polygon points="${pad},${height - pad} ${points} ${width - pad},${height - pad}" fill="#0a1a0a" opacity="0.6"/>
      <polyline points="${points}" fill="none" stroke="#9bbc0f" stroke-width="2" stroke-linejoin="round"/>
      ${prices.map((price, index) => {
        const x = prices.length === 1 ? width / 2 : pad + (index / denominator) * (width - pad * 2)
        const y = height - pad - ((price - min) / range) * (height - pad * 2)
        return `<circle cx="${x}" cy="${y}" r="3" fill="#9bbc0f"/>`
      }).join('')}
      <text x="${pad + 4}" y="${height - pad - 4}" fill="#306230" font-size="10">$${min}</text>
      <text x="${pad + 4}" y="${pad + 12}" fill="#9bbc0f" font-size="10">$${max}</text>
    `

    const labelStep = filteredHistory.length > 6 ? Math.ceil(filteredHistory.length / 4) : 1
    labels.innerHTML = filteredHistory
      .filter((_, index) => index % labelStep === 0 || index === filteredHistory.length - 1)
      .map((entry) => `<span class="chart-label">${entry.month}</span>`)
      .join('')

    const oldest = prices[0] || 1
    const variation = oldest ? (((prices[prices.length - 1] - oldest) / oldest) * 100).toFixed(1) : '0.0'

    statMinEl.textContent = `$${min}`
    statMaxEl.textContent = `$${max}`
    variationEl.textContent = `${variation > 0 ? '+' : ''}${variation}%`
    variationEl.style.color = variation > 0 ? '#9bbc0f' : variation < 0 ? '#e85555' : '#8bac0f'
  }

  drawChart(activeType)

  document.querySelectorAll('.chart-btn').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.chart-btn').forEach((item) => item.classList.remove('active'))
      button.classList.add('active')
      activeType = button.dataset.type
      drawChart(activeType)
    })
  })

  document.querySelectorAll('.period-btn').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach((item) => item.classList.remove('active'))
      button.classList.add('active')
      activePeriodDays = Number.parseInt(button.dataset.period || '365', 10) || 365
      drawChart(activeType)
    })
  })
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
    document.title = `RetroDex - ${currentGame.title}`

    if (breadcrumbTitleEl) {
      breadcrumbTitleEl.textContent = (currentGame.title || '').toUpperCase().substring(0, 30) || '—'
    }

    renderHeroSection(currentGame)

    const coverImgEl = document.getElementById('game-cover-img')
    if (coverImgEl) {
      coverImgEl.alt = currentGame.title || ''
      coverImgEl.src = currentGame.cover_url
        ? currentGame.cover_url
        : generateCoverPlaceholder(currentGame.title, currentGame.rarity, currentGame.console)
      coverImgEl.addEventListener('error', () => {
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
    if (editorialShellEl) editorialShellEl.hidden = true
    if (relatedShellEl) relatedShellEl.hidden = true
  }
}

loadPage()
contribSubmitEl?.addEventListener('click', handleContributionSubmit)
