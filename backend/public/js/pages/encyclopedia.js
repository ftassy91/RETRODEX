'use strict'

let activeFilter = 'all'
let activeItem = null
let allGames = []
let allFranchises = []

const urlParams = new URLSearchParams(window.location.search)
const preselectedGame = urlParams.get('game')

const countEl = document.getElementById('encyclo-count')
const gamesContainerEl = document.getElementById('games-list-container')
const franchisesContainerEl = document.getElementById('franchises-list-container')
const franchisesHeadingEl = document.querySelector('.encyclo-franchises-heading')
const detailPanelEl = document.getElementById('encyclo-detail-panel')

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function safeJSON(value, fallback) {
  if (!value) return fallback
  if (Array.isArray(value)) return value
  if (typeof value === 'object') return value

  try {
    return JSON.parse(value)
  } catch (_) {
    return fallback
  }
}

function coverageBadges(game) {
  const badges = []
  if (game.synopsis) badges.push('SYN')
  if (safeJSON(game.dev_anecdotes, []).length) badges.push('ANE')
  if (safeJSON(game.dev_team, []).length) badges.push('EQP')
  if (safeJSON(game.cheat_codes, []).length) badges.push('COD')
  return badges
}

function updateCount() {
  const total = allGames.length + allFranchises.length
  countEl.textContent = `${allGames.length} jeux | ${allFranchises.length} franchises | ${total} entrees`
}

function setActiveRow(rowEl) {
  document.querySelectorAll('.encyclo-list-row').forEach((row) => row.classList.remove('active'))
  if (rowEl) rowEl.classList.add('active')
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
    gamesContainerEl.innerHTML = '<div class="encyclo-empty">Aucun jeu pour ce filtre.</div>'
    return
  }

  games.forEach((game) => {
    const row = document.createElement('button')
    row.type = 'button'
    row.className = 'encyclo-list-row'
    row.dataset.id = game.id
    row.innerHTML = `
      <span class="encyclo-row-title">${escapeHtml(game.title)}</span>
      <span class="encyclo-row-meta">${escapeHtml(game.console || 'Console inconnue')} &middot; ${escapeHtml(game.year || 'n/a')}</span>
      <span class="encyclo-row-badges">
        ${coverageBadges(game).map((badge) => `<span class="encyclo-badge">${badge}</span>`).join('')}
      </span>
    `
    row.addEventListener('click', () => loadGameDetail(game.id, row))
    gamesContainerEl.appendChild(row)
  })
}

function renderFranchisesList(franchises) {
  franchisesContainerEl.innerHTML = ''

  if (!franchises.length) {
    franchisesHeadingEl.hidden = true
    franchisesContainerEl.hidden = true
    return
  }

  franchisesHeadingEl.hidden = false
  franchisesContainerEl.hidden = false

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

function initials(label) {
  return String(label || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'RD'
}

function gamePanelMarkup(game, encyclopedia) {
  const anecdotes = safeJSON(encyclopedia.dev_anecdotes || game.dev_anecdotes, [])
  const team = safeJSON(encyclopedia.dev_team || game.dev_team, [])
  const codes = safeJSON(encyclopedia.cheat_codes || game.cheat_codes, [])
  const synopsis = encyclopedia.synopsis || game.synopsis || ''
  const tagline = game.tagline || ''
  const rarity = String(game.rarity || 'ARCHIVE')

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
        <div class="encyclo-panel-meta">${escapeHtml(game.console || 'Console inconnue')} &middot; ${escapeHtml(game.year || 'n/a')}</div>
        <div class="encyclo-panel-signals">
          <span class="encyclo-panel-rarity rarity-${escapeHtml(rarity.toLowerCase())}">${escapeHtml(rarity)}</span>
          <span class="encyclo-panel-signal">${coverageBadges(game).length} modules</span>
        </div>
        ${tagline ? `<div class="encyclo-panel-tagline">${escapeHtml(tagline)}</div>` : ''}
        <a href="/game-detail.html?id=${encodeURIComponent(game.id)}" class="encyclo-panel-link terminal-action-link">Ouvrir la fiche complete &rarr;</a>
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

async function loadGameDetail(gameId, rowEl) {
  activeItem = { type: 'game', id: gameId }
  setActiveRow(rowEl)
  detailPanelEl.innerHTML = '<div class="encyclo-loading">Chargement...</div>'

  try {
    const [gamePayload, encyclopediaPayload] = await Promise.all([
      fetch(`/api/games/${encodeURIComponent(gameId)}`).then((response) => response.json()),
      fetch(`/api/games/${encodeURIComponent(gameId)}/encyclopedia`)
        .then((response) => response.json())
        .catch(() => ({}))
    ])

    const game = gamePayload.game || gamePayload
    const encyclopedia = encyclopediaPayload.data || encyclopediaPayload
    detailPanelEl.innerHTML = gamePanelMarkup(game, encyclopedia)
    window.switchEncycloTab('synopsis')
  } catch (_) {
    detailPanelEl.innerHTML = '<div class="encyclo-loading">Lecture impossible pour cette entree.</div>'
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
    detailPanelEl.innerHTML = '<div class="encyclo-loading">Lecture impossible pour cette franchise.</div>'
  }
}

function restoreSelection(filteredGames, filteredFranchises) {
  if (activeItem?.type === 'game') {
    const row = document.querySelector(`.encyclo-list-row[data-id="${activeItem.id}"]`)
    if (row) {
      loadGameDetail(activeItem.id, row)
      return
    }
  }

  if (activeItem?.type === 'franchise') {
    const row = document.querySelector(`.encyclo-list-row[data-slug="${activeItem.slug}"]`)
    if (row) {
      loadFranchiseDetail(activeItem.slug, row)
      return
    }
  }

  if (preselectedGame) {
    const row = document.querySelector(`.encyclo-list-row[data-id="${preselectedGame}"]`)
    if (row) {
      loadGameDetail(preselectedGame, row)
      return
    }
  }

  const firstGameRow = document.querySelector('.encyclo-list-row[data-id]')
  if (firstGameRow && filteredGames[0]) {
    loadGameDetail(filteredGames[0].id, firstGameRow)
    return
  }

  const firstFranchiseRow = document.querySelector('.encyclo-list-row[data-slug]')
  if (firstFranchiseRow && filteredFranchises[0]) {
    loadFranchiseDetail(filteredFranchises[0].slug, firstFranchiseRow)
    return
  }

  detailPanelEl.innerHTML = '<div class="encyclo-placeholder">Aucune entree disponible pour ce filtre.</div>'
}

function applyFilter(filter) {
  let filteredGames = allGames
  let filteredFranchises = allFranchises

  if (filter === 'synopsis') {
    filteredGames = allGames.filter((game) => Boolean(game.synopsis))
    filteredFranchises = []
  } else if (filter === 'anecdotes') {
    filteredGames = allGames.filter((game) => safeJSON(game.dev_anecdotes, []).length > 0)
    filteredFranchises = []
  } else if (filter === 'team') {
    filteredGames = allGames.filter((game) => safeJSON(game.dev_team, []).length > 0)
    filteredFranchises = []
  } else if (filter === 'codes') {
    filteredGames = allGames.filter((game) => safeJSON(game.cheat_codes, []).length > 0)
    filteredFranchises = []
  } else if (filter === 'franchise') {
    filteredGames = []
    filteredFranchises = allFranchises
  }

  renderGamesList(filteredGames)
  renderFranchisesList(filteredFranchises)
  restoreSelection(filteredGames, filteredFranchises)
}

function bindFilters() {
  document.querySelectorAll('.encyclo-filters .filter-btn').forEach((button) => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.filter || 'all'
      document.querySelectorAll('.encyclo-filters .filter-btn').forEach((other) => {
        other.classList.toggle('active', other === button)
      })
      applyFilter(activeFilter)
    })
  })
}

async function init() {
  try {
    const [gamesPayload, franchisesPayload] = await Promise.all([
      fetch('/api/games?limit=1000&type=game').then((response) => response.json()),
      fetch('/api/franchises').then((response) => response.json())
    ])

    allGames = (gamesPayload.items || []).filter((game) =>
      game.synopsis || game.dev_anecdotes || game.dev_team || game.cheat_codes
    )

    if (allGames.length < 6) {
      const fallbackResponse = await fetch('/games?type=game')
      if (fallbackResponse.ok) {
        const fallbackGames = await fallbackResponse.json()
        allGames = (Array.isArray(fallbackGames) ? fallbackGames : []).filter((game) =>
          game.synopsis || game.dev_anecdotes || game.dev_team || game.cheat_codes
        )
      }
    }

    allFranchises = franchisesPayload.items || franchisesPayload.franchises || []

    bindFilters()
    updateCount()
    applyFilter(activeFilter)
  } catch (_) {
    countEl.textContent = 'Backend hors ligne'
    detailPanelEl.innerHTML = '<div class="encyclo-loading">Archive indisponible.</div>'
  }
}

init()
