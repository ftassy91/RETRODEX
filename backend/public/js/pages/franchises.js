'use strict'

const countEl = document.getElementById('franchise-count')
const listEl = document.getElementById('franchise-list')
const detailEl = document.getElementById('franchise-detail')
const searchEl = document.getElementById('franchise-search')
const listMetaEl = document.getElementById('franchise-list-meta')

const requestedSlug = new URLSearchParams(window.location.search).get('slug') || ''

let allFranchises = []
let filteredFranchises = []
let selectedSlug = ''
let activeTab = 'overview'

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function toArray(value) {
  return Array.isArray(value) ? value : []
}

function formatYears(item) {
  const first = item?.first_game
  const last = item?.last_game
  if (first && last) return `${first} -> ${last}`
  if (first) return `${first}`
  if (last) return `${last}`
  return '-'
}

function timelineBadgeLabel(type) {
  return String(type || 'release').replaceAll('_', ' ')
}

function timelineBadgeClass(type) {
  return `timeline-badge timeline-badge-${String(type || 'release').replaceAll(/[^a-z_]/gi, '')}`
}

function teamEventLabel(type) {
  if (type === 'joined') return '[REJOINT]'
  if (type === 'left') return '[QUITTE]'
  if (type === 'changed_role') return '[EVOLUTION]'
  return `[${String(type || '-').toUpperCase()}]`
}

function teamEventClass(type) {
  if (type === 'joined') return 'team-event team-event-joined'
  if (type === 'left') return 'team-event team-event-left'
  if (type === 'changed_role') return 'team-event team-event-changed'
  return 'team-event'
}

function buildArchiveCode(value) {
  const initials = String(value || 'RDX')
    .split(/[\s/-]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((chunk) => chunk[0])
    .join('')
    .toUpperCase()
  return initials || 'RDX'
}

function signalCardMarkup(label, value, accentClass = '') {
  return `
    <div class="surface-signal-card${accentClass ? ` ${accentClass}` : ''}">
      <span class="surface-signal-label">${escapeHtml(label)}</span>
      <span class="surface-signal-value${accentClass === 'is-hot' ? ' is-hot' : value === 'n/a' ? ' is-muted' : ''}">${escapeHtml(value || 'n/a')}</span>
    </div>
  `
}

function buildListItem(item) {
  return `
    <button class="franchise-list-item${item.slug === selectedSlug ? ' selected' : ''}" data-slug="${escapeHtml(item.slug)}" type="button">
      <div class="franchise-item-marker">></div>
      <div class="franchise-item-copy">
        <div class="franchise-name">${escapeHtml(item.name)}</div>
        <div class="franchise-years">${escapeHtml(formatYears(item))}</div>
        <div class="franchise-list-developer">${escapeHtml(item.developer || 'Studio inconnu')}</div>
      </div>
    </button>
  `
}

function setListMeta(label) {
  if (listMetaEl) {
    listMetaEl.textContent = label
  }
}

function franchiseEmptyMarkup(title, copy) {
  return `
    <div class="franchise-detail-empty terminal-empty-state">
      <div class="terminal-empty-title">${escapeHtml(title)}</div>
      <div class="terminal-empty-copy">${escapeHtml(copy)}</div>
    </div>
  `
}

function franchiseListEmptyMarkup(title, copy) {
  return `
    <div class="franchise-list-empty terminal-empty-state">
      <div class="terminal-empty-title">${escapeHtml(title)}</div>
      <div class="terminal-empty-copy">${escapeHtml(copy)}</div>
    </div>
  `
}

function renderList(items) {
  if (!items.length) {
    listEl.innerHTML = franchiseListEmptyMarkup('Aucun dossier', 'Aucun dossier ne correspond a cette requete.')
    setListMeta('Aucun resultat')
    return
  }

  listEl.innerHTML = items.map(buildListItem).join('')
  setListMeta(`${items.length} franchise(s) visibles`)

  listEl.querySelectorAll('.franchise-list-item').forEach((node) => {
    node.addEventListener('click', () => {
      loadFranchise(node.dataset.slug).catch(() => {
        detailEl.innerHTML = franchiseEmptyMarkup('Erreur de chargement', 'Le dossier n a pas pu etre relu depuis l archive.')
      })
    })
  })
}

function markSelected(slug) {
  selectedSlug = slug
  listEl.querySelectorAll('.franchise-list-item').forEach((node) => {
    node.classList.toggle('selected', node.dataset.slug === slug)
  })
}

function filterFranchises() {
  const query = String(searchEl?.value || '').trim().toLowerCase()
  if (!query) {
    filteredFranchises = [...allFranchises]
  } else {
    filteredFranchises = allFranchises.filter((item) => {
      const haystack = [
        item.name,
        item.slug,
        item.developer,
        item.publisher,
        item.description,
        item.first_game,
        item.last_game,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }

  renderList(filteredFranchises)

  if (!filteredFranchises.length) {
    detailEl.innerHTML = franchiseEmptyMarkup('Index vide', 'Aucun dossier ne correspond a cette requete. Affinez l index query.')
    return
  }

  if (!filteredFranchises.some((item) => item.slug === selectedSlug)) {
    loadFranchise(filteredFranchises[0].slug).catch(() => {
      detailEl.innerHTML = franchiseEmptyMarkup('Erreur de chargement', 'Le dossier n a pas pu etre relu depuis l archive.')
    })
  } else {
    markSelected(selectedSlug)
  }
}

function switchDetailTab(tabName) {
  activeTab = tabName
  detailEl.querySelectorAll('.franchise-detail-tab').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tabName)
  })
  detailEl.querySelectorAll('.franchise-tab-panel').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tabName
  })
}

function bindDetailTabs() {
  detailEl.querySelectorAll('.franchise-detail-tab').forEach((button) => {
    button.addEventListener('click', () => switchDetailTab(button.dataset.tab))
  })
}

function renderOverviewPanel(franchise, genres, platforms) {
  return `
    <section class="franchise-tab-panel" data-panel="overview">
      <div class="franchise-section">
        <div class="section-label">APERCU</div>
        <p class="franchise-description franchise-description-lead surface-summary-copy">${escapeHtml(franchise.description || 'Aucune description disponible.')}</p>
        <div class="surface-chip-row">
          ${genres.length ? genres.slice(0, 4).map((genre) => `<span class="surface-chip is-primary">${escapeHtml(genre)}</span>`).join('') : '<span class="surface-chip">ARCHIVE</span>'}
          ${platforms.length ? platforms.slice(0, 4).map((platform) => `<span class="surface-chip">${escapeHtml(platform)}</span>`).join('') : ''}
        </div>
        <div class="franchise-platforms surface-identity-meta">Plateformes : ${platforms.length ? escapeHtml(platforms.join(', ')) : 'Non documente'}</div>
      </div>
      <div class="franchise-section">
        <div class="section-label">HERITAGE</div>
        <div class="franchise-legacy surface-summary-copy">${escapeHtml(franchise.legacy || 'Aucun heritage documente.')}</div>
      </div>
    </section>
  `
}

function renderTimelinePanel(timeline) {
  return `
    <section class="franchise-tab-panel" data-panel="timeline" hidden>
      <div class="franchise-section">
        <div class="section-label">TIMELINE</div>
        <div class="timeline-list">
          ${timeline.length ? timeline.map((entry) => `
            <div class="timeline-row">
              <div class="timeline-year">${escapeHtml(entry.year || '-')}</div>
              <div class="timeline-main">
                <div class="timeline-title">${escapeHtml(entry.title || '-')}</div>
                <div class="timeline-platform">${escapeHtml(entry.platform || '-')}</div>
                <div class="timeline-description">${escapeHtml(entry.description || '-')}</div>
              </div>
              <span class="${timelineBadgeClass(entry.event_type)}">${escapeHtml(timelineBadgeLabel(entry.event_type))}</span>
            </div>
          `).join('') : franchiseEmptyMarkup('Timeline vide', 'Aucune timeline disponible pour cette franchise.')}
        </div>
      </div>
    </section>
  `
}

function renderTeamPanel(teamChanges) {
  return `
    <section class="franchise-tab-panel" data-panel="team" hidden>
      <div class="franchise-section">
        <div class="section-label">EQUIPE</div>
        ${teamChanges.length ? `
          <div class="team-table">
            <div class="team-row team-row-head">
              <div class="team-cell">Annee</div>
              <div class="team-cell">Nom</div>
              <div class="team-cell">Role</div>
              <div class="team-cell">Evenement</div>
              <div class="team-cell">Note</div>
            </div>
            ${teamChanges.map((entry) => `
              <div class="team-row">
                <div class="team-cell">${escapeHtml(entry.year || '-')}</div>
                <div class="team-cell team-name">${escapeHtml(entry.name || '-')}</div>
                <div class="team-cell">${escapeHtml(entry.role || '-')}</div>
                <div class="team-cell"><span class="${teamEventClass(entry.event)}">${escapeHtml(teamEventLabel(entry.event))}</span></div>
                <div class="team-cell">${escapeHtml(entry.note || '-')}</div>
              </div>
            `).join('')}
          </div>
        ` : franchiseEmptyMarkup('Equipe non documentee', 'Aucun changement d equipe documente pour cette franchise.')}
      </div>
    </section>
  `
}

function renderTriviaPanel(trivia) {
  return `
    <section class="franchise-tab-panel" data-panel="anecdotes" hidden>
      <div class="franchise-section">
        <div class="section-label">ANECDOTES</div>
        ${trivia.length ? trivia.map((entry) => `
          <div class="encyclo-anecdote">
            <div class="anecdote-title">${escapeHtml(entry.title || '-')}</div>
            <div class="anecdote-text">${escapeHtml(entry.text || '-')}</div>
          </div>
        `).join('') : franchiseEmptyMarkup('Aucune anecdote', 'Aucune anecdote disponible pour cette franchise.')}
      </div>
    </section>
  `
}

function renderGamesPanel(games) {
  return `
    <section class="franchise-tab-panel" data-panel="games" hidden>
      <div class="franchise-section" id="franchise-linked-games">
        <div class="section-label">JEUX LIES</div>
        ${games.length ? `
          <div class="franchise-games-list">
            ${games.map((game) => `
              <a class="franchise-game-row" href="/game-detail.html?id=${encodeURIComponent(game.id)}">
                <span class="franchise-game-title">${escapeHtml(game.title)}</span>
                <span class="franchise-game-meta">${escapeHtml(game.platform || '-')} | ${escapeHtml(game.year || '-')}</span>
              </a>
            `).join('')}
          </div>
        ` : franchiseEmptyMarkup('Jeux indisponibles', 'Aucun jeu lie en base pour cette franchise.')}
      </div>
    </section>
  `
}

function renderGamesPanelRm1(games) {
  return `
    <section class="franchise-tab-panel" data-panel="games" hidden>
      <div class="franchise-section" id="franchise-linked-games">
        <div class="section-label">JEUX LIES</div>
        ${games.length ? `
          <div class="franchise-games-list">
            ${games.map((game) => `
              <a class="franchise-game-row rm1-franchise-game-row" href="/game-detail.html?id=${encodeURIComponent(game.id)}">
                <span class="franchise-game-main">
                  <span class="franchise-game-title">${escapeHtml(game.title)}</span>
                  <span class="franchise-game-meta">${escapeHtml(game.platform || '-')} | ${escapeHtml(game.year || '-')}</span>
                </span>
                <span class="surface-chip">FICHE</span>
              </a>
            `).join('')}
          </div>
        ` : franchiseEmptyMarkup('Jeux indisponibles', 'Aucun jeu lie en base pour cette franchise.')}
      </div>
    </section>
  `
}

function buildDetailMarkup(franchise, games) {
  const genres = toArray(franchise.genres)
  const platforms = toArray(franchise.platforms)
  const timeline = toArray(franchise.timeline)
  const teamChanges = toArray(franchise.team_changes)
  const trivia = toArray(franchise.trivia)
  const archiveCode = buildArchiveCode(franchise.name)
  const period = formatYears(franchise)
  const chipMarkup = [
    ...genres.slice(0, 3).map((genre) => `<span class="surface-chip is-primary">${escapeHtml(genre)}</span>`),
    ...platforms.slice(0, 3).map((platform) => `<span class="surface-chip">${escapeHtml(platform)}</span>`),
  ].join('')

  return `
    <div class="franchise-panel">
      <section class="franchise-panel-header">
        <div class="franchise-archive-slot">
          <span class="franchise-archive-code">${escapeHtml(archiveCode)}</span>
          <span class="franchise-archive-caption">ARCHIVE FILE</span>
        </div>

        <div class="franchise-panel-main">
          <div class="franchise-panel-kicker">COLLECTOR DOSSIER</div>
          <h2 class="detail-title">${escapeHtml(franchise.name)}</h2>
          <div class="franchise-years-line surface-identity-meta">${escapeHtml(period)} | ${escapeHtml(franchise.developer || 'Inconnu')} | ${escapeHtml(franchise.publisher || 'Inconnu')}</div>

          <div class="surface-signal-grid franchise-overview-grid">
            ${signalCardMarkup('Periode', period)}
            ${signalCardMarkup('Studio', franchise.developer || 'Inconnu')}
            ${signalCardMarkup('Jeux lies', String(games.length), games.length ? 'is-hot' : '')}
          </div>

          <div class="surface-chip-row">
            ${chipMarkup || '<span class="surface-chip">ARCHIVE</span>'}
          </div>

          <div class="surface-action-row franchise-action-row">
            <a class="franchise-action-link" href="/search.html?q=${encodeURIComponent(franchise.name)}&ctx=retrodex">RECHERCHER CETTE FRANCHISE</a>
            <a class="franchise-action-link" href="/search.html?q=${encodeURIComponent(franchise.name)}">OUVRIR LA RECHERCHE TRANSVERSE</a>
            ${games.length ? '<button type="button" class="franchise-action-link button-link" data-tab-jump="games">VOIR LES JEUX LIES</button>' : ''}
          </div>
        </div>
      </section>

      <div class="franchise-detail-tabs">
        <button type="button" class="franchise-detail-tab active" data-tab="overview">APERCU</button>
        <button type="button" class="franchise-detail-tab" data-tab="timeline">TIMELINE</button>
        <button type="button" class="franchise-detail-tab" data-tab="team">EQUIPE</button>
        <button type="button" class="franchise-detail-tab" data-tab="anecdotes">ANECDOTES</button>
        <button type="button" class="franchise-detail-tab" data-tab="games">JEUX</button>
      </div>

      <div class="franchise-detail-body">
        ${renderOverviewPanel(franchise, genres, platforms)}
        ${renderTimelinePanel(timeline)}
        ${renderTeamPanel(teamChanges)}
        ${renderTriviaPanel(trivia)}
        ${renderGamesPanelRm1(games)}
      </div>
    </div>
  `
}

async function loadFranchise(slug) {
  markSelected(slug)
  activeTab = 'overview'
  const targetUrl = slug ? `/franchises.html?slug=${encodeURIComponent(slug)}` : '/franchises.html'
  window.history.replaceState({}, '', targetUrl)
  detailEl.innerHTML = franchiseEmptyMarkup('Chargement', 'Lecture du dossier et des jeux lies.')

  const [detailRes, gamesRes] = await Promise.all([
    fetch(`/api/franchises/${encodeURIComponent(slug)}`),
    fetch(`/api/franchises/${encodeURIComponent(slug)}/games`),
  ])

  const detailData = await detailRes.json()
  const gamesData = await gamesRes.json()

  if (!detailRes.ok || !detailData.ok) {
    detailEl.innerHTML = franchiseEmptyMarkup('Dossier indisponible', 'Ce dossier n est pas disponible dans l archive.')
    return
  }

  const franchise = detailData.franchise
  const games = gamesRes.ok && gamesData.ok ? toArray(gamesData.games) : []

  detailEl.innerHTML = buildDetailMarkup(franchise, games)
  bindDetailTabs()
  switchDetailTab(activeTab)

  detailEl.querySelectorAll('[data-tab-jump]').forEach((button) => {
    button.addEventListener('click', () => switchDetailTab(button.dataset.tabJump))
  })
}

async function loadFranchises() {
  const response = await fetch('/api/franchises')
  const data = await response.json()

  if (!response.ok || !data.ok) {
    countEl.textContent = 'Impossible de charger les franchises'
    detailEl.innerHTML = franchiseEmptyMarkup('Erreur de chargement', 'Impossible de charger les franchises depuis l archive.')
    return
  }

  allFranchises = toArray(data.items || data.franchises)
  filteredFranchises = [...allFranchises]
  countEl.textContent = `${data.count || allFranchises.length} licences indexees`
  renderList(filteredFranchises)

  if (!allFranchises.length) {
    detailEl.innerHTML = franchiseEmptyMarkup('Archive vide', 'Aucune franchise indexee dans la base active.')
    return
  }

  const initialFranchise = allFranchises.find((item) => item.slug === requestedSlug) || allFranchises[0]
  await loadFranchise(initialFranchise.slug)
}

if (searchEl) {
  searchEl.addEventListener('input', filterFranchises)
  searchEl.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      searchEl.value = ''
      filterFranchises()
      searchEl.blur()
    }
  })
}

document.addEventListener('keydown', (event) => {
  const activeTag = event.target?.tagName
  if (event.key === '/' && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
    event.preventDefault()
    searchEl?.focus()
    searchEl?.select()
  }
})

loadFranchises().catch(() => {
  countEl.textContent = 'Impossible de charger les franchises'
  detailEl.innerHTML = franchiseEmptyMarkup('Archive indisponible', 'Le dossier n a pas pu etre charge.')
})

