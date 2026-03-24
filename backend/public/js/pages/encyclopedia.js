'use strict'

const {
  escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;'),
  safeJSON = (value, fallback) => {
    if (!value) return fallback
    if (Array.isArray(value)) return value
    if (typeof value === 'object') return value

    try {
      return JSON.parse(value)
    } catch (_) {
      return fallback
    }
  },
  initials = (label) => String(label || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'RD',
  renderConsoleIllustration: sharedRenderConsoleIllustration = async () => null,
} = window.RetroDexConsoleUi || {}

let activeFilter = 'all'
let activeMode = 'games'
let activeItem = null
let allGames = []
let allFranchises = []
let allConsoles = []
const hardwarePreferredPlatforms = new Set([
  'game boy',
  'super nintendo',
  'sega genesis',
  'playstation',
  'nintendo 64',
  'game boy advance',
  'sega saturn',
  'nes',
])

const urlParams = new URLSearchParams(window.location.search)
const preselectedGame = urlParams.get('game')
const preselectedConsole = urlParams.get('console')
const requestedDexQuery = urlParams.get('q') || ''

const countEl = document.getElementById('encyclo-count')
const dexSearchInputEl = document.getElementById('dex-search-input')
const dexSearchCountEl = document.getElementById('dex-search-count')
const filtersEl = document.getElementById('encyclo-filters')
const modeTabsEl = document.getElementById('encyclo-mode-tabs')
const gamesSectionEl = document.getElementById('encyclo-games-section')
const franchisesSectionEl = document.getElementById('encyclo-franchises-section')
const consolesSectionEl = document.getElementById('encyclo-consoles-section')
const gamesContainerEl = document.getElementById('games-list-container')
const franchisesContainerEl = document.getElementById('franchises-list-container')
const consolesContainerEl = document.getElementById('consoles-list-container')
const franchisesHeadingEl = document.querySelector('.encyclo-franchises-heading')
const detailPanelEl = document.getElementById('encyclo-detail-panel')
let dexSearchTimer = null

function coverageBadges(game) {
  const badges = []
  if (game.synopsis) badges.push('SYN')
  if (safeJSON(game.dev_anecdotes, []).length) badges.push('ANE')
  if (safeJSON(game.dev_team, []).length) badges.push('EQP')
  if (safeJSON(game.cheat_codes, []).length) badges.push('COD')
  return badges
}

function updateCount() {
  const total = allGames.length + allFranchises.length + allConsoles.length
  countEl.textContent = `${allGames.length} jeux | ${allFranchises.length} franchises | ${allConsoles.length} consoles | ${total} entrees`
}

function formatCurrency(value) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? `$${Math.round(amount)}` : 'n/a'
}

function syncDexQueryToUrl(query) {
  const nextParams = new URLSearchParams(window.location.search)
  if (query) nextParams.set('q', query)
  else nextParams.delete('q')
  const nextUrl = `${window.location.pathname}${nextParams.toString() ? `?${nextParams.toString()}` : ''}`
  window.history.replaceState({}, '', nextUrl)
}

async function loadDexIndex(query = '') {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  params.set('limit', query ? '250' : '1000')

  const response = await fetch(`/api/dex/search?${params.toString()}`)
  const payload = await response.json()

  if (!response.ok || !payload.ok) {
    throw new Error('Dex search unavailable')
  }

  allGames = payload.items || []
  if (dexSearchCountEl) {
    dexSearchCountEl.textContent = query
      ? `${allGames.length} entree(s) editoriales`
      : `${allGames.length} jeux editoriaux`
  }
}

function setActiveRow(rowEl) {
  document.querySelectorAll('.encyclo-list-row').forEach((row) => row.classList.remove('active'))
  if (rowEl) rowEl.classList.add('active')
}

function getFilteredGames() {
  if (activeFilter === 'synopsis') {
    return allGames.filter((game) => Boolean(game.synopsis))
  }
  if (activeFilter === 'anecdotes') {
    return allGames.filter((game) => safeJSON(game.dev_anecdotes, []).length > 0)
  }
  if (activeFilter === 'team') {
    return allGames.filter((game) => safeJSON(game.dev_team, []).length > 0)
  }
  if (activeFilter === 'codes') {
    return allGames.filter((game) => safeJSON(game.cheat_codes, []).length > 0)
  }
  if (activeFilter === 'franchise') {
    return []
  }
  return allGames
}

function syncModeView() {
  const gamesActive = activeMode === 'games'
  const franchisesActive = activeMode === 'franchises'
  const consolesActive = activeMode === 'consoles'

  if (modeTabsEl) {
    modeTabsEl.querySelectorAll('[data-mode]').forEach((button) => {
      button.classList.toggle('active', button.dataset.mode === activeMode)
    })
  }

  if (filtersEl) {
    filtersEl.hidden = !gamesActive
  }

  if (gamesSectionEl) gamesSectionEl.hidden = !gamesActive
  if (franchisesSectionEl) franchisesSectionEl.hidden = !franchisesActive
  if (consolesSectionEl) consolesSectionEl.hidden = !consolesActive
}

window.switchEncycloTab = function switchEncycloTab(tabName) {
  document.querySelectorAll('.encyclo-tab-content').forEach((panel) => {
    panel.hidden = true
  })

  document.querySelectorAll('.encyclo-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === tabName)
  })

  const target = document.getElementById(`tab-${tabName}`)
  if (target) target.hidden = false
}

function renderGamesList(games) {
  gamesContainerEl.innerHTML = ''

  if (!games.length) {
    gamesContainerEl.innerHTML = '<div class="encyclo-empty">Aucune entree jeu pour ce filtre actif.</div>'
    return
  }

  games.forEach((game) => {
    const row = document.createElement('button')
    row.type = 'button'
    row.className = 'encyclo-list-row'
    row.dataset.id = game.id
    row.innerHTML = `
      <span class="encyclo-list-row-head">
        <span class="encyclo-row-title">${escapeHtml(game.title)}</span>
      </span>
      <span class="encyclo-row-meta">${escapeHtml(game.console || 'Console inconnue')} &middot; ${escapeHtml(game.year || 'n/a')}</span>
      <span class="encyclo-row-badges">
        ${coverageBadges(game).map((badge) => `<span class="encyclo-badge">${badge}</span>`).join('')}
      </span>
    `
    const headEl = row.querySelector('.encyclo-list-row-head')
    if (headEl && window.RetroDexAssets && game.console) {
      headEl.prepend(window.RetroDexAssets.createSupportImg(game.console, 16))
    }
    if (headEl && game.metascore && window.RetroDexMetascore?.renderBadge) {
      const metaBadge = window.RetroDexMetascore.renderBadge(game.metascore, 'micro')
      metaBadge.title = `Metascore : ${game.metascore}/100`
      headEl.appendChild(metaBadge)
    }
    row.addEventListener('click', () => loadGameDetail(game.id, row))
    gamesContainerEl.appendChild(row)
  })
}

function renderFranchisesList(franchises) {
  franchisesContainerEl.innerHTML = ''

  if (!franchises.length) {
    if (franchisesHeadingEl) franchisesHeadingEl.hidden = true
    franchisesContainerEl.innerHTML = '<div class="encyclo-empty">Aucune franchise disponible.</div>'
    return
  }

  if (franchisesHeadingEl) franchisesHeadingEl.hidden = false

  franchises.forEach((franchise) => {
    const row = document.createElement('button')
    row.type = 'button'
    row.className = 'encyclo-list-row is-franchise'
    row.dataset.slug = franchise.slug
    row.innerHTML = `
      <span class="encyclo-row-title">${escapeHtml(franchise.name)}</span>
      <span class="encyclo-row-meta">${escapeHtml(franchise.first_game || 'n/a')} &rarr; ${escapeHtml(franchise.last_game || 'n/a')} &middot; ${escapeHtml(franchise.developer || 'Studio inconnu')}</span>
      <span class="encyclo-row-badges">
        <span class="encyclo-badge encyclo-badge-franchise">FRANCHISE</span>
      </span>
    `
    row.addEventListener('click', () => loadFranchiseDetail(franchise.slug, row))
    franchisesContainerEl.appendChild(row)
  })
}

function renderConsolesList(consoles) {
  consolesContainerEl.innerHTML = ''

  if (!consoles.length) {
    consolesContainerEl.innerHTML = '<div class="encyclo-empty">Aucune console disponible.</div>'
    return
  }

  consoles.forEach((consoleItem) => {
    const row = document.createElement('button')
    row.type = 'button'
    row.className = 'encyclo-list-row is-franchise'
    row.dataset.consoleId = consoleItem.id
    row.innerHTML = `
      <span class="encyclo-row-title">${escapeHtml(consoleItem.title)}</span>
      <span class="encyclo-row-meta">${escapeHtml(consoleItem.manufacturer || 'Archive')} &middot; ${escapeHtml(consoleItem.year || 'n/a')} &middot; ${escapeHtml(consoleItem.gamesCount || 0)} jeux</span>
      <span class="encyclo-row-badges">
        <span class="encyclo-badge encyclo-badge-franchise">CONSOLE</span>
      </span>
    `
    row.addEventListener('click', () => loadConsoleDetail(consoleItem.id, row))
    consolesContainerEl.appendChild(row)
  })
}

function gamePanelMarkup(game, encyclopedia) {
  const anecdotes = safeJSON(encyclopedia.dev_anecdotes || game.dev_anecdotes, [])
  const team = safeJSON(encyclopedia.dev_team || game.dev_team, [])
  const codes = safeJSON(encyclopedia.cheat_codes || game.cheat_codes, [])
  const synopsis = encyclopedia.synopsis || game.synopsis || ''
  const tagline = game.tagline || ''
  const rarity = String(game.rarity || 'ARCHIVE')
  const metascore = game.metascore || encyclopedia.metascore || null
  const modulesCount = coverageBadges(game).length
  const genre = game.genre && game.genre !== 'Other' ? game.genre : ''

  return `
    <div class="encyclo-panel-header">
      <div class="encyclo-panel-cover">
        ${game.cover_url
          ? `<img src="${escapeHtml(game.cover_url)}" alt="${escapeHtml(game.title || 'Cover')}" width="96" height="96" onerror="this.style.display='none'; this.nextElementSibling.hidden=false">`
          : ''
        }
        <div class="encyclo-cover-placeholder"${game.cover_url ? ' hidden' : ''}>${escapeHtml(initials(game.title))}</div>
        <div class="encyclo-cover-caption">ARCHIVE SLOT</div>
      </div>

      <div class="encyclo-panel-info">
        <div class="detail-kicker">GAME ENTRY</div>
        <div class="encyclo-panel-title">${escapeHtml(game.title || 'Jeu')}</div>
        <div class="encyclo-panel-meta">${escapeHtml(game.console || 'Console inconnue')} &middot; ${escapeHtml(game.year || 'n/a')} &middot; ${escapeHtml(game.developer || 'Studio inconnu')}</div>
        <div class="surface-signal-grid is-compact">
          <div class="surface-signal-card">
            <span class="surface-signal-label">Metascore</span>
            <span class="surface-signal-value">${metascore ? escapeHtml(metascore) : 'n/a'}</span>
          </div>
          <div class="surface-signal-card">
            <span class="surface-signal-label">Loose</span>
            <span class="surface-signal-value is-alert">${escapeHtml(formatCurrency(game.loosePrice))}</span>
          </div>
          <div class="surface-signal-card">
            <span class="surface-signal-label">Rarete</span>
            <span class="surface-signal-value">${escapeHtml(rarity)}</span>
          </div>
          <div class="surface-signal-card">
            <span class="surface-signal-label">Couverture</span>
            <span class="surface-signal-value is-muted">${escapeHtml(`${modulesCount} modules`)}</span>
          </div>
        </div>
        <div class="surface-chip-row">
          ${genre ? `<span class="surface-chip is-primary">${escapeHtml(genre)}</span>` : ''}
          <span class="surface-chip">${escapeHtml(game.console || 'Console')}</span>
          ${metascore ? `<span class="surface-chip is-hot">MS ${escapeHtml(metascore)}</span>` : '<span class="surface-chip">NO SCORE</span>'}
        </div>
        ${tagline ? `<div class="encyclo-panel-tagline">${escapeHtml(tagline)}</div>` : ''}
        <div class="surface-action-row encyclo-panel-links">
          <a href="/game-detail.html?id=${encodeURIComponent(game.id)}" class="encyclo-panel-link terminal-action-link">Ouvrir la fiche complete &rarr;</a>
          <a href="/game-detail.html?id=${encodeURIComponent(game.id)}#price-history-section" class="encyclo-panel-link terminal-action-link">Ouvrir price trace &rarr;</a>
          <a href="/stats.html?q=${encodeURIComponent(game.title || '')}" class="encyclo-panel-link terminal-action-link">Voir la valeur RetroMarket &rarr;</a>
        </div>
      </div>
    </div>

    <div class="encyclo-reading-transition">
      <div class="detail-kicker">EDITORIAL MEMORY</div>
      <div class="encyclo-reading-transition-copy">
        Signal collector, puis lecture longue : synopsis, equipe, anecdotes et codes.
      </div>
    </div>

    <div class="encyclo-tabs">
      <button class="encyclo-tab active" data-tab="synopsis" type="button" onclick="switchEncycloTab('synopsis')">SYNOPSIS</button>
      ${team.length ? '<button class="encyclo-tab" data-tab="team" type="button" onclick="switchEncycloTab(\'team\')">EQUIPE</button>' : ''}
      ${anecdotes.length ? '<button class="encyclo-tab" data-tab="anecdotes" type="button" onclick="switchEncycloTab(\'anecdotes\')">ANECDOTES</button>' : ''}
      ${codes.length ? '<button class="encyclo-tab" data-tab="codes" type="button" onclick="switchEncycloTab(\'codes\')">CODES</button>' : ''}
    </div>

    <section class="encyclo-tab-content" id="tab-synopsis">
      ${synopsis
        ? `<p class="encyclo-synopsis-text">${escapeHtml(synopsis)}</p>`
        : '<div class="encyclo-empty">Aucun synopsis disponible dans cette entree.</div>'
      }
    </section>

    <section class="encyclo-tab-content" id="tab-team" hidden>
      ${team.map((member) => `
        <div class="encyclo-team-row">
          <span class="team-role">${escapeHtml(member.role || 'Role')}</span>
          <span class="team-name">${escapeHtml(member.name || 'Nom inconnu')}</span>
          ${member.note ? `<span class="team-note">${escapeHtml(member.note)}</span>` : ''}
        </div>
      `).join('') || '<div class="encyclo-empty">Aucune equipe documentee.</div>'}
    </section>

    <section class="encyclo-tab-content" id="tab-anecdotes" hidden>
      ${anecdotes.map((anecdote, index) => `
        <article class="encyclo-anecdote-block">
          <div class="encyclo-anecdote-title">${escapeHtml(anecdote.title || `Anecdote ${index + 1}`)}</div>
          <div class="encyclo-anecdote-text">${escapeHtml(anecdote.text || anecdote)}</div>
        </article>
      `).join('') || '<div class="encyclo-empty">Aucune anecdote disponible.</div>'}
    </section>

    <section class="encyclo-tab-content" id="tab-codes" hidden>
      ${codes.map((code) => `
        <article class="encyclo-code-block">
          <div class="encyclo-code-label">${escapeHtml(code.label || code.title || 'Code')}</div>
          <div class="encyclo-code-value">${escapeHtml(code.code || code.value || code)}</div>
          ${code.effect ? `<div class="encyclo-code-effect">${escapeHtml(code.effect)}</div>` : ''}
        </article>
      `).join('') || '<div class="encyclo-empty">Aucun code disponible.</div>'}
    </section>
  `
}

function franchisePanelMarkup(franchise) {
  const timeline = safeJSON(franchise.timeline, [])
  const trivia = safeJSON(franchise.trivia, [])

  return `
    <div class="encyclo-panel-header is-franchise">
      <div class="encyclo-panel-cover">
        <div class="encyclo-cover-placeholder">${escapeHtml(initials(franchise.name))}</div>
        <div class="encyclo-cover-caption">SERIES ARCHIVE</div>
      </div>

      <div class="encyclo-panel-info">
        <div class="detail-kicker">FRANCHISE ENTRY</div>
        <div class="encyclo-panel-title">${escapeHtml(franchise.name || 'Franchise')}</div>
        <div class="encyclo-panel-meta">${escapeHtml(franchise.first_game || 'n/a')} &rarr; ${escapeHtml(franchise.last_game || 'n/a')} &middot; ${escapeHtml(franchise.developer || 'Studio inconnu')}</div>
        <div class="encyclo-panel-signals">
          <span class="encyclo-panel-rarity encyclo-badge-franchise">FRANCHISE</span>
          <span class="encyclo-panel-signal">${timeline.length} reperes</span>
        </div>
        <a href="/franchises.html?slug=${encodeURIComponent(franchise.slug || '')}" class="encyclo-panel-link terminal-action-link">Ouvrir la fiche complete &rarr;</a>
      </div>
    </div>

    <div class="encyclo-reading-transition">
      <div class="detail-kicker">SERIES MEMORY</div>
      <div class="encyclo-reading-transition-copy">
        Histoire courte, timeline, puis anecdotes de licence.
      </div>
    </div>

    <div class="encyclo-tabs">
      <button class="encyclo-tab active" data-tab="synopsis" type="button" onclick="switchEncycloTab('synopsis')">HISTOIRE</button>
      ${timeline.length ? '<button class="encyclo-tab" data-tab="timeline" type="button" onclick="switchEncycloTab(\'timeline\')">TIMELINE</button>' : ''}
      ${trivia.length ? '<button class="encyclo-tab" data-tab="anecdotes" type="button" onclick="switchEncycloTab(\'anecdotes\')">ANECDOTES</button>' : ''}
    </div>

    <section class="encyclo-tab-content" id="tab-synopsis">
      <p class="encyclo-synopsis-text">${escapeHtml(franchise.description || 'Aucune histoire disponible.')}</p>
      ${franchise.legacy ? `<p class="encyclo-synopsis-text is-secondary">${escapeHtml(franchise.legacy)}</p>` : ''}
    </section>

    <section class="encyclo-tab-content" id="tab-timeline" hidden>
      ${timeline.map((item) => `
        <article class="timeline-row">
          <span class="timeline-year">${escapeHtml(item.year || 'n/a')}</span>
          <span class="timeline-title">${escapeHtml(item.title || 'Repere')}</span>
          <span class="timeline-desc">${escapeHtml(item.description || '')}</span>
        </article>
      `).join('') || '<div class="encyclo-empty">Aucune timeline disponible.</div>'}
    </section>

    <section class="encyclo-tab-content" id="tab-anecdotes" hidden>
      ${trivia.map((item) => `
        <article class="encyclo-anecdote-block">
          <div class="encyclo-anecdote-title">${escapeHtml(item.title || 'Anecdote')}</div>
          <div class="encyclo-anecdote-text">${escapeHtml(item.text || '')}</div>
        </article>
      `).join('') || '<div class="encyclo-empty">Aucune anecdote disponible.</div>'}
    </section>
  `
}

function listMarkup(items, emptyMessage) {
  if (!items?.length) {
    return `<div class="encyclo-empty">${escapeHtml(emptyMessage)}</div>`
  }

  return `<ul class="console-bullet-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
}

function relatedConsolesMarkup(consoles) {
  if (!consoles?.length) {
    return '<div class="encyclo-empty">Aucune console voisine a afficher.</div>'
  }

  return `
    <div class="console-chip-list">
      ${consoles.map((entry) => `
        <button type="button" class="console-chip-link" data-console-jump="${escapeHtml(entry.id)}">
          <span>${escapeHtml(entry.name)}</span>
          <small>${escapeHtml(entry.release_year || 'n/a')}</small>
        </button>
      `).join('')}
    </div>
  `
}

function notableGamesMarkup(notableGames) {
  if (!notableGames?.length) {
    return '<div class="encyclo-empty">Aucun titre notable mappe.</div>'
  }

  return `
    <div class="console-chip-list">
      ${notableGames.map((entry) => entry.game
        ? `<a class="console-chip-link" href="/game-detail.html?id=${encodeURIComponent(entry.game.id)}"><span>${escapeHtml(entry.title)}</span><small>${escapeHtml(entry.game.year || '')}</small></a>`
        : `<span class="console-chip-link is-static"><span>${escapeHtml(entry.title)}</span><small>non mappe</small></span>`
      ).join('')}
    </div>
  `
}

async function renderConsoleIllustration(consoleInfo) {
  const svg = await sharedRenderConsoleIllustration(consoleInfo, {
    withMedia: false,
    showLabel: false,
  })
  if (!svg) {
    return `<div class="encyclo-cover-placeholder">${escapeHtml(initials(consoleInfo.title || consoleInfo.name))}</div>`
  }

  return svg
}

async function consolePanelMarkup(payload) {
  const consoleInfo = payload.console || {}
  const encyclopedia = payload.encyclopedia || {}
  const technicalSpecs = encyclopedia.technical_specs || {}
  const illustration = await renderConsoleIllustration(consoleInfo)

  return `
    <div class="encyclo-panel-header is-franchise is-console">
      <div class="encyclo-panel-cover encyclo-panel-cover--console">
        ${illustration}
        <div class="encyclo-cover-caption">HARDWARE ARCHIVE</div>
      </div>

      <div class="encyclo-panel-info encyclo-panel-info--console">
        <div class="detail-kicker">CONSOLE ENTRY</div>
        <div class="encyclo-panel-title">${escapeHtml(encyclopedia.name || consoleInfo.title || 'Console')}</div>
        <div class="encyclo-panel-meta">${escapeHtml(encyclopedia.manufacturer || consoleInfo.manufacturer || 'Archive')} &middot; ${escapeHtml(encyclopedia.release_year || consoleInfo.year || 'n/a')} &middot; ${escapeHtml(encyclopedia.generation || consoleInfo.platform || 'Archive')}</div>
        <div class="encyclo-panel-signals">
          <span class="encyclo-panel-rarity encyclo-badge-franchise">CONSOLE</span>
          <span class="encyclo-panel-signal">${escapeHtml(consoleInfo.gamesCount || 0)} jeux</span>
        </div>
        <a href="/consoles.html?platform=${encodeURIComponent(consoleInfo.platform || consoleInfo.title || '')}" class="encyclo-panel-link terminal-action-link">Ouvrir la fiche hardware complete &rarr;</a>
      </div>
    </div>

    <div class="encyclo-reading-transition">
      <div class="detail-kicker">HARDWARE MEMORY</div>
      <div class="encyclo-reading-transition-copy">
        Contexte, equipe, fiche technique, marche et impact culturel.
      </div>
    </div>

    <div class="encyclo-tabs">
      <button class="encyclo-tab active" data-tab="overview" type="button" onclick="switchEncycloTab('overview')">OVERVIEW</button>
      <button class="encyclo-tab" data-tab="development" type="button" onclick="switchEncycloTab('development')">DEVELOPMENT</button>
      <button class="encyclo-tab" data-tab="specs" type="button" onclick="switchEncycloTab('specs')">SPECS</button>
      <button class="encyclo-tab" data-tab="legacy" type="button" onclick="switchEncycloTab('legacy')">LEGACY</button>
      <button class="encyclo-tab" data-tab="anecdotes" type="button" onclick="switchEncycloTab('anecdotes')">ANECDOTES</button>
    </div>

    <section class="encyclo-tab-content" id="tab-overview">
      <p class="encyclo-synopsis-text">${escapeHtml(encyclopedia.overview || 'Aucun overview disponible.')}</p>
      <div class="console-subsection-label">Consoles voisines</div>
      ${relatedConsolesMarkup(payload.relatedConsoles || [])}
    </section>

    <section class="encyclo-tab-content" id="tab-development" hidden>
      <div class="console-copy-stack">
        <p><strong>Contexte.</strong> ${escapeHtml(encyclopedia.development?.context || 'Non documente.')}</p>
        <p><strong>Objectifs.</strong> ${escapeHtml(encyclopedia.development?.goals || 'Non documente.')}</p>
        <p><strong>Contraintes.</strong> ${escapeHtml(encyclopedia.development?.challenges || 'Non documente.')}</p>
        <p><strong>Choix techniques.</strong> ${escapeHtml(encyclopedia.development?.technical_choices || 'Non documente.')}</p>
      </div>
      ${encyclopedia.team?.length ? `
        <div class="console-subsection-label">Equipe cle</div>
        <div class="console-team-list">
          ${encyclopedia.team.map((member) => `
            <article class="console-team-card">
              <div class="console-team-name">${escapeHtml(member.name || 'Equipe')}</div>
              <div class="console-team-role">${escapeHtml(member.role || 'Role')}</div>
              <p>${escapeHtml(member.note || '')}</p>
            </article>
          `).join('')}
        </div>
      ` : ''}
    </section>

    <section class="encyclo-tab-content" id="tab-specs" hidden>
      <div class="console-spec-grid">
        <div class="console-spec-card"><span>CPU</span><strong>${escapeHtml(technicalSpecs.cpu || 'n/a')}</strong></div>
        <div class="console-spec-card"><span>GPU</span><strong>${escapeHtml(technicalSpecs.gpu || 'n/a')}</strong></div>
        <div class="console-spec-card"><span>Memoire</span><strong>${escapeHtml(technicalSpecs.memory || 'n/a')}</strong></div>
        <div class="console-spec-card"><span>Media</span><strong>${escapeHtml(technicalSpecs.media || 'n/a')}</strong></div>
      </div>
      ${listMarkup(technicalSpecs.notable_features || [], 'Aucune caracteristique notable.')}
    </section>

    <section class="encyclo-tab-content" id="tab-legacy" hidden>
      <div class="console-copy-stack">
        <p><strong>Positionnement.</strong> ${escapeHtml(encyclopedia.market?.positioning || 'Non documente.')}</p>
        <p><strong>Succes.</strong> ${escapeHtml(encyclopedia.market?.success || 'Non documente.')}</p>
        <p><strong>Impact.</strong> ${escapeHtml(encyclopedia.legacy?.impact || 'Non documente.')}</p>
      </div>
      <div class="console-subsection-label">Innovations</div>
      ${listMarkup(encyclopedia.legacy?.innovations || [], 'Aucune innovation renseignee.')}
      <div class="console-subsection-label">Jeux notables</div>
      ${notableGamesMarkup(payload.notableGames || [])}
    </section>

    <section class="encyclo-tab-content" id="tab-anecdotes" hidden>
      ${listMarkup(encyclopedia.anecdotes || [], 'Aucune anecdote disponible.')}
    </section>
  `
}

async function loadGameDetail(gameId, rowEl) {
  activeItem = { type: 'game', id: gameId }
  setActiveRow(rowEl)
  detailPanelEl.innerHTML = '<div class="encyclo-loading">Chargement...</div>'

  try {
    const [gamePayload, encyclopediaPayload] = await Promise.all([
      fetch(`/api/games/${encodeURIComponent(gameId)}`).then((response) => response.json()),
      fetch(`/api/games/${encodeURIComponent(gameId)}/encyclopedia`)
        .then((response) => response.json())
        .catch(() => ({})),
    ])

    const game = gamePayload.game || gamePayload
    const encyclopedia = encyclopediaPayload.data || encyclopediaPayload
    detailPanelEl.innerHTML = gamePanelMarkup(game, encyclopedia)
    window.switchEncycloTab('synopsis')
  } catch (_) {
    detailPanelEl.innerHTML = '<div class="encyclo-loading">Lecture indisponible pour cette entree.</div>'
  }
}

async function loadFranchiseDetail(slug, rowEl) {
  activeItem = { type: 'franchise', slug }
  setActiveRow(rowEl)
  detailPanelEl.innerHTML = '<div class="encyclo-loading">Chargement...</div>'

  try {
    const payload = await fetch(`/api/franchises/${encodeURIComponent(slug)}`).then((response) => response.json())
    const franchise = payload.franchise || payload
    detailPanelEl.innerHTML = franchisePanelMarkup(franchise)
    window.switchEncycloTab('synopsis')
  } catch (_) {
    detailPanelEl.innerHTML = '<div class="encyclo-loading">Lecture indisponible pour cette franchise.</div>'
  }
}

async function loadConsoleDetail(consoleId, rowEl) {
  activeItem = { type: 'console', id: consoleId }
  setActiveRow(rowEl)
  detailPanelEl.innerHTML = '<div class="encyclo-loading">Chargement...</div>'

  try {
    const payload = await fetch(`/api/consoles/${encodeURIComponent(consoleId)}`).then((response) => response.json())
    detailPanelEl.innerHTML = await consolePanelMarkup(payload)
    detailPanelEl.querySelectorAll('[data-console-jump]').forEach((button) => {
      button.addEventListener('click', () => {
        activeMode = 'consoles'
        syncModeView()
        restoreSelection()
        const targetRow = document.querySelector(`.encyclo-list-row[data-console-id="${button.dataset.consoleJump}"]`)
        if (targetRow) {
          targetRow.click()
        }
      })
    })
    window.switchEncycloTab('overview')
  } catch (_) {
    detailPanelEl.innerHTML = '<div class="encyclo-loading">Lecture indisponible pour cette console.</div>'
  }
}

function restoreSelection() {
  if (activeMode === 'games') {
    const filteredGames = getFilteredGames()

    if (activeItem?.type === 'game') {
      const row = document.querySelector(`.encyclo-list-row[data-id="${activeItem.id}"]`)
      if (row) return loadGameDetail(activeItem.id, row)
    }

    if (preselectedGame) {
      const row = document.querySelector(`.encyclo-list-row[data-id="${preselectedGame}"]`)
      if (row) return loadGameDetail(preselectedGame, row)
    }

    const firstRow = document.querySelector('.encyclo-list-row[data-id]')
    if (firstRow && filteredGames[0]) {
      return loadGameDetail(filteredGames[0].id, firstRow)
    }
  }

  if (activeMode === 'franchises') {
    if (activeItem?.type === 'franchise') {
      const row = document.querySelector(`.encyclo-list-row[data-slug="${activeItem.slug}"]`)
      if (row) return loadFranchiseDetail(activeItem.slug, row)
    }

    const firstRow = document.querySelector('.encyclo-list-row[data-slug]')
    if (firstRow && allFranchises[0]) {
      return loadFranchiseDetail(allFranchises[0].slug, firstRow)
    }
  }

  if (activeMode === 'consoles') {
    if (activeItem?.type === 'console') {
      const row = document.querySelector(`.encyclo-list-row[data-console-id="${activeItem.id}"]`)
      if (row) return loadConsoleDetail(activeItem.id, row)
    }

    if (preselectedConsole) {
      const match = allConsoles.find((item) =>
        String(item.id) === preselectedConsole ||
        String(item.platform).toLowerCase() === String(preselectedConsole).toLowerCase() ||
        String(item.title).toLowerCase() === String(preselectedConsole).toLowerCase()
      )
      if (match) {
        const row = document.querySelector(`.encyclo-list-row[data-console-id="${match.id}"]`)
        if (row) return loadConsoleDetail(match.id, row)
      }
    }

    const preferredConsole = allConsoles.find((item) =>
      hardwarePreferredPlatforms.has(String(item.platform || item.title || '').toLowerCase())
    ) || allConsoles[0]
    const firstRow = preferredConsole
      ? document.querySelector(`.encyclo-list-row[data-console-id="${preferredConsole.id}"]`)
      : document.querySelector('.encyclo-list-row[data-console-id]')
    if (firstRow && preferredConsole) {
      return loadConsoleDetail(preferredConsole.id, firstRow)
    }
  }

  detailPanelEl.innerHTML = '<div class="encyclo-placeholder">Aucune entree disponible pour ce mode actif.</div>'
}

function renderActiveMode() {
  syncModeView()

  if (activeMode === 'games') {
    renderGamesList(getFilteredGames())
  } else if (activeMode === 'franchises') {
    renderFranchisesList(allFranchises)
  } else if (activeMode === 'consoles') {
    renderConsolesList(allConsoles)
  }

  restoreSelection()
}

function bindFilters() {
  document.querySelectorAll('.encyclo-filters .filter-btn').forEach((button) => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.filter || 'all'
      document.querySelectorAll('.encyclo-filters .filter-btn').forEach((other) => {
        other.classList.toggle('active', other === button)
      })

      if (activeFilter === 'franchise') {
        activeMode = 'franchises'
      } else {
        activeMode = 'games'
      }

      renderActiveMode()
    })
  })
}

function bindModeTabs() {
  if (!modeTabsEl) return

  modeTabsEl.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      activeMode = button.dataset.mode || 'games'
      if (activeMode === 'games' && activeFilter === 'franchise') {
        activeFilter = 'all'
        document.querySelectorAll('.encyclo-filters .filter-btn').forEach((other) => {
          other.classList.toggle('active', other.dataset.filter === 'all')
        })
      }
      renderActiveMode()
    })
  })
}

function bindDexSearch() {
  if (!dexSearchInputEl) return

  dexSearchInputEl.value = requestedDexQuery
  dexSearchInputEl.addEventListener('input', () => {
    window.clearTimeout(dexSearchTimer)
    dexSearchTimer = window.setTimeout(async () => {
      const query = String(dexSearchInputEl.value || '').trim()
      syncDexQueryToUrl(query)

      try {
        await loadDexIndex(query)
        if (activeMode === 'games') {
          renderActiveMode()
        } else {
          updateCount()
        }
      } catch (_error) {
        if (dexSearchCountEl) dexSearchCountEl.textContent = 'Recherche indisponible'
      }
    }, 200)
  })
}

async function init() {
  try {
    const [franchisesPayload, consolesPayload] = await Promise.all([
      fetch('/api/franchises').then((response) => response.json()),
      fetch('/api/consoles').then((response) => response.json()),
    ])
    await loadDexIndex(requestedDexQuery)

    allFranchises = franchisesPayload.items || franchisesPayload.franchises || []
    allConsoles = consolesPayload.consoles || []

    bindFilters()
    bindModeTabs()
    bindDexSearch()
    updateCount()

    if (preselectedConsole) {
      activeMode = 'consoles'
    } else if (activeFilter === 'franchise') {
      activeMode = 'franchises'
    } else {
      activeMode = 'games'
    }

    renderActiveMode()
  } catch (_) {
    countEl.textContent = 'Backend hors ligne'
    detailPanelEl.innerHTML = '<div class="encyclo-loading">Archive indisponible.</div>'
  }
}

init()
