'use strict'

const consoleUi = window.RetroDexConsoleUi || {}
const {
  escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;'),
  manufacturerFor = (item) => item?.manufacturer || 'Archive',
  renderConsoleIllustration = async () => null,
  renderMediaAsset = async () => null,
} = consoleUi

const countEl = document.getElementById('console-count')
const gridEl = document.getElementById('consoles-grid')
const detailEl = document.getElementById('console-detail')

let selectedId = null
let selectedPlatform = ''
const hardwarePreferredPlatforms = new Set([
  'game boy',
  'super nintendo',
  'sega genesis',
  'playstation',
  'nintendo 64',
  'game boy advance',
  'sega saturn',
  'nintendo entertainment system',
])

function requestedPlatform() {
  return new URLSearchParams(window.location.search).get('platform') || ''
}

function consoleEmptyMarkup(title, copy) {
  return `
    <div class="console-detail-empty terminal-empty-state">
      <div class="terminal-empty-title">${escapeHtml(title)}</div>
      <div class="terminal-empty-copy">${escapeHtml(copy)}</div>
    </div>
  `
}

function listMarkup(items, emptyMessage) {
  if (!items?.length) {
    return consoleEmptyMarkup('Aucune entree', emptyMessage)
  }

  return `<ul class="console-bullet-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
}

function consoleRowMarkup(item) {
  const manufacturer = manufacturerFor(item)
  const isSelected = item.id === selectedId

  return `
    <a href="/console-detail.html?id=${encodeURIComponent(item.id)}" class="console-row${isSelected ? ' active' : ''}" data-id="${escapeHtml(item.id)}" data-platform="${escapeHtml(item.platform || '')}">
      <span class="console-row-title">${escapeHtml(item.title || item.platform || 'Console')}</span>
      <span class="console-row-meta">${escapeHtml(manufacturer)} | ${escapeHtml(item.year || item.release_year || 'n/a')} | ${escapeHtml(item.gamesCount || 0)} jeux</span>
      <span class="console-row-signal">${escapeHtml(item.generation || item.platform || 'Archive')}</span>
    </a>
  `
}

function accessoryMarkup(accessories) {
  if (!accessories.length) {
    return consoleEmptyMarkup('Accessoires indisponibles', 'Aucun accessoire archive pour ce systeme dans la base active.')
  }

  return accessories.map((item) => `
    <div class="console-accessory-row">
      <a href="/accessories.html" class="console-inline-link">${escapeHtml(item.name || 'Accessoire')}</a>
      <span class="console-accessory-type">${escapeHtml(item.accessory_type || 'other')}</span>
    </div>
  `).join('')
}

async function gamesMarkup(consoleInfo, games) {
  if (!games.length) {
    return consoleEmptyMarkup('Catalogue indisponible', 'Aucun jeu relie a ce systeme dans la base active.')
  }

  const mediaIcon = await renderMediaAsset(consoleInfo, 24)

  return `
    <div class="console-games-list">
      ${games.map((game) => `
        <a class="console-game-row" href="/game-detail.html?id=${encodeURIComponent(game.id)}">
          <span class="console-game-head">
            ${mediaIcon ? `<span class="console-game-media" aria-hidden="true">${mediaIcon.markup}</span>` : ''}
            <span class="console-game-title">${escapeHtml(game.title || 'Jeu')}</span>
          </span>
          <span class="console-game-meta">${escapeHtml(consoleInfo.platform || '')} | ${escapeHtml(game.year || 'n/a')}</span>
        </a>
      `).join('')}
    </div>
    ${Number(consoleInfo.gamesCount || 0) > games.length ? `<div class="console-section-footnote">Apercu limite a ${games.length} jeux sur ${escapeHtml(consoleInfo.gamesCount)} dans la base active.</div>` : ''}
  `
}

function relatedConsolesMarkup(consoles) {
  if (!consoles?.length) {
    return consoleEmptyMarkup('Liens indisponibles', 'Aucune console voisine pertinente a afficher.')
  }

  return `
    <div class="console-chip-list">
      ${consoles.map((entry) => `
        <a class="console-chip-link" href="/consoles.html?platform=${encodeURIComponent(entry.name)}">
          <span>${escapeHtml(entry.name)}</span>
          <small>${escapeHtml(entry.release_year || 'n/a')}</small>
        </a>
      `).join('')}
    </div>
  `
}

function notableGamesMarkup(notableGames) {
  if (!notableGames?.length) {
    return consoleEmptyMarkup('Titres indisponibles', 'Aucun titre notable cartographie automatiquement.')
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

function encyclopediaSectionMarkup({ title, kicker, body, open = true }) {
  return `
    <details class="console-encyclopedia-block"${open ? ' open' : ''}>
      <summary>
        <div class="detail-kicker">${escapeHtml(kicker)}</div>
        <span class="console-encyclopedia-title">${escapeHtml(title)}</span>
      </summary>
      <div class="console-encyclopedia-body">${body}</div>
    </details>
  `
}

async function renderHardwareMarkup(consoleInfo) {
  const svg = await renderConsoleIllustration(consoleInfo, {
    withMedia: false,
    showLabel: false,
  })
  if (svg) {
    return `${svg}<div class="console-detail-slot-caption">TECHNICAL MEMORY VIEW</div>`
  }

  return `
    <div class="console-detail-placeholder">${escapeHtml(String(consoleInfo.title || consoleInfo.platform || 'RD').slice(0, 2).toUpperCase())}</div>
    <div class="console-detail-slot-caption">TECHNICAL MEMORY VIEW</div>
  `
}

async function renderDetail(payload) {
  const consoleInfo = payload.console || {}
  const encyclopedia = payload.encyclopedia || {}
  const games = payload.games || []
  const accessories = payload.accessories || []
  const relatedConsoles = payload.relatedConsoles || []
  const notableGames = payload.notableGames || []
  const manufacturer = manufacturerFor({ ...consoleInfo, manufacturer: encyclopedia.manufacturer })
  const technicalSpecs = encyclopedia.technical_specs || {}
  const hardwareMarkup = await renderHardwareMarkup(consoleInfo)
  const mediaMarkup = await renderMediaAsset(consoleInfo, 64)
  const gamesListMarkup = await gamesMarkup(consoleInfo, games)

  detailEl.innerHTML = `
    <div class="console-detail-hero">
      <div class="console-detail-visuals">
        <div class="console-detail-slot console-detail-slot--hardware">${hardwareMarkup}</div>
        ${mediaMarkup ? `
          <div class="console-media-card">
            <div class="detail-kicker">PRIMARY MEDIA</div>
            <div class="console-media-asset">${mediaMarkup.markup}</div>
            <div class="console-detail-slot-caption">${escapeHtml(mediaMarkup.label)}</div>
          </div>
        ` : ''}
      </div>

      <div class="console-detail-copy">
        <div class="detail-kicker">HARDWARE ENTRY</div>
        <div class="console-detail-title">${escapeHtml(encyclopedia.name || consoleInfo.title || 'Console')}</div>
        <div class="console-detail-meta surface-identity-meta">${escapeHtml(manufacturer)} | ${escapeHtml(encyclopedia.release_year || consoleInfo.year || 'n/a')} | ${escapeHtml(encyclopedia.generation || consoleInfo.platform || 'Archive')}</div>
        <div class="console-detail-signals surface-signal-grid is-compact">
          <div class="surface-signal-card">
            <span class="surface-signal-label">Constructeur</span>
            <span class="surface-signal-value">${escapeHtml(manufacturer)}</span>
          </div>
          <div class="surface-signal-card">
            <span class="surface-signal-label">Sortie</span>
            <span class="surface-signal-value">${escapeHtml(encyclopedia.release_year || consoleInfo.year || 'n/a')}</span>
          </div>
          <div class="surface-signal-card">
            <span class="surface-signal-label">Catalogue</span>
            <span class="surface-signal-value is-hot">${escapeHtml(consoleInfo.gamesCount || games.length)} jeux</span>
          </div>
          <div class="surface-signal-card">
            <span class="surface-signal-label">Accessoires</span>
            <span class="surface-signal-value">${escapeHtml(accessories.length)}</span>
          </div>
        </div>
        <div class="surface-chip-row">
          <span class="surface-chip is-primary">${escapeHtml(encyclopedia.generation || consoleInfo.platform || 'Archive')}</span>
          <span class="surface-chip">${escapeHtml(technicalSpecs.media || 'media n/a')}</span>
          <span class="surface-chip">${escapeHtml(notableGames.length)} titres notables</span>
        </div>
        <div class="console-detail-actions surface-action-row">
          <a class="terminal-action-link" href="/games-list.html?console=${encodeURIComponent(consoleInfo.platform || '')}">Ouvrir le catalogue -></a>
          <a class="terminal-action-link" href="/search.html?q=${encodeURIComponent(consoleInfo.platform || '')}&ctx=retrodex">Ouvrir la recherche -></a>
          <a class="terminal-action-link" href="/search.html?q=${encodeURIComponent(consoleInfo.platform || '')}&ctx=retrodex">Ouvrir RetroDex -></a>
        </div>
      </div>
    </div>

    <div class="console-section">
      <div class="console-section-head">
        <div>
          <div class="detail-kicker">OVERVIEW</div>
          <h3 class="console-section-title">Lecture rapide</h3>
        </div>
        <div class="console-section-copy">Bloc d'entree court pour situer la machine avant les details.</div>
      </div>
      <div class="console-overview-copy surface-summary-copy">${escapeHtml(encyclopedia.overview || 'Notice encyclopedique indisponible pour cette console.')}</div>
    </div>

    <div class="console-encyclopedia-grid">
      ${encyclopediaSectionMarkup({
        title: 'Developpement',
        kicker: 'DEVELOPMENT',
        body: `
          <div class="console-copy-stack">
            <p><strong>Contexte.</strong> ${escapeHtml(encyclopedia.development?.context || 'Non documente.')}</p>
            <p><strong>Objectifs.</strong> ${escapeHtml(encyclopedia.development?.goals || 'Non documente.')}</p>
            <p><strong>Contraintes.</strong> ${escapeHtml(encyclopedia.development?.challenges || 'Non documente.')}</p>
            <p><strong>Choix techniques.</strong> ${escapeHtml(encyclopedia.development?.technical_choices || 'Non documente.')}</p>
          </div>
        `,
      })}
      ${encyclopediaSectionMarkup({
        title: 'Equipe cle',
        kicker: 'TEAM',
        body: encyclopedia.team?.length
          ? `<div class="console-team-list">${encyclopedia.team.map((member) => `
              <article class="console-team-card">
                <div class="console-team-name">${escapeHtml(member.name || 'Equipe')}</div>
                <div class="console-team-role">${escapeHtml(member.role || 'Role')}</div>
                <p>${escapeHtml(member.note || '')}</p>
              </article>
            `).join('')}</div>`
          : consoleEmptyMarkup('Equipe non documentee', 'Aucun membre cle n est documente pour cette machine.'),
      })}
      ${encyclopediaSectionMarkup({
        title: 'Fiche technique',
        kicker: 'TECHNICAL SPECS',
        body: `
          <div class="console-spec-grid">
            <div class="console-spec-card"><span>CPU</span><strong>${escapeHtml(technicalSpecs.cpu || 'n/a')}</strong></div>
            <div class="console-spec-card"><span>GPU</span><strong>${escapeHtml(technicalSpecs.gpu || 'n/a')}</strong></div>
            <div class="console-spec-card"><span>Memoire</span><strong>${escapeHtml(technicalSpecs.memory || 'n/a')}</strong></div>
            <div class="console-spec-card"><span>Media</span><strong>${escapeHtml(technicalSpecs.media || 'n/a')}</strong></div>
          </div>
          ${listMarkup(technicalSpecs.notable_features || [], 'Aucune caracteristique notable renseignee.')}
        `,
      })}
      ${encyclopediaSectionMarkup({
        title: 'Marche et positionnement',
        kicker: 'MARKET',
        body: `
          <div class="console-copy-stack">
            <p><strong>Positionnement.</strong> ${escapeHtml(encyclopedia.market?.positioning || 'Non documente.')}</p>
            <p><strong>Succes.</strong> ${escapeHtml(encyclopedia.market?.success || 'Non documente.')}</p>
            <p><strong>Ventes.</strong> ${escapeHtml(encyclopedia.market?.sales || 'Non documente.')}</p>
          </div>
          ${listMarkup(encyclopedia.market?.competitors || [], 'Aucun concurrent renseigne.')}
        `,
        open: false,
      })}
      ${encyclopediaSectionMarkup({
        title: 'Legacy',
        kicker: 'LEGACY',
        body: `
          <div class="console-copy-stack">
            <p><strong>Impact.</strong> ${escapeHtml(encyclopedia.legacy?.impact || 'Non documente.')}</p>
          </div>
          <div class="console-subsection-label">Innovations</div>
          ${listMarkup(encyclopedia.legacy?.innovations || [], 'Aucune innovation renseignee.')}
          <div class="console-subsection-label">Titres notables relies</div>
          ${notableGamesMarkup(notableGames)}
        `,
        open: false,
      })}
      ${encyclopediaSectionMarkup({
        title: 'Anecdotes',
        kicker: 'ANECDOTES',
        body: listMarkup(encyclopedia.anecdotes || [], 'Aucune anecdote renseignee.'),
        open: false,
      })}
      ${encyclopediaSectionMarkup({
        title: 'Consoles voisines',
        kicker: 'CROSS-LINKS',
        body: relatedConsolesMarkup(relatedConsoles),
        open: false,
      })}
    </div>

    <div class="console-section">
      <div class="console-section-head">
        <div>
          <div class="detail-kicker">CATALOG BRIDGE</div>
          <h3 class="console-section-title">Jeux lies</h3>
        </div>
        <div class="console-section-copy">Passerelle directe vers les fiches jeu de ce systeme.</div>
      </div>
      ${gamesListMarkup}
    </div>

    <div class="console-section">
      <div class="console-section-head">
        <div>
          <div class="detail-kicker">ACCESSORY BRIDGE</div>
          <h3 class="console-section-title">Accessoires lies</h3>
        </div>
        <div class="console-section-copy">Extensions et pieces deja presentes dans RetroDex.</div>
      </div>
      <div class="console-accessory-list">${accessoryMarkup(accessories)}</div>
    </div>
  `
}

function syncSelectedRow() {
  gridEl.querySelectorAll('.console-row').forEach((row) => {
    row.classList.toggle('active', row.dataset.id === selectedId)
  })
}

async function loadDetail(id) {
  selectedId = id
  syncSelectedRow()
  detailEl.innerHTML = consoleEmptyMarkup('Chargement', 'Lecture de la fiche hardware et des liens associes.')

  const response = await fetch(`/api/consoles/${encodeURIComponent(id)}`)
  const payload = await response.json()

  if (!response.ok || !payload.ok) {
    detailEl.innerHTML = consoleEmptyMarkup('Systeme indisponible', 'Ce systeme n est pas disponible dans l archive.')
    return
  }

  await renderDetail(payload)
}

async function loadConsoles() {
  const response = await fetch('/api/consoles')
  const payload = await response.json()

  if (!response.ok || !payload.ok) {
    countEl.textContent = 'Impossible de charger les consoles'
    gridEl.innerHTML = ''
    detailEl.innerHTML = consoleEmptyMarkup('Erreur de chargement', 'Impossible de charger les consoles depuis l archive.')
    return
  }

  const consoles = payload.consoles || []
  const requested = requestedPlatform().toLowerCase()

  countEl.textContent = `${payload.count || consoles.length} systemes retro`
  gridEl.innerHTML = consoles.map(consoleRowMarkup).join('')

  gridEl.querySelectorAll('.console-row').forEach((row) => {
    row.addEventListener('click', async () => {
      selectedId = row.dataset.id || ''
      selectedPlatform = row.dataset.platform || ''
      syncSelectedRow()
      await loadDetail(selectedId)
    })
  })

  if (consoles.length) {
    const initial = consoles.find((item) => String(item.platform || '').toLowerCase() === requested)
      || consoles.find((item) => hardwarePreferredPlatforms.has(String(item.platform || '').toLowerCase()))
      || consoles[0]
    selectedId = initial.id
    selectedPlatform = initial.platform || ''
    syncSelectedRow()
    await loadDetail(selectedId)
  }
}

loadConsoles().catch(() => {
  countEl.textContent = 'Impossible de charger les consoles'
  detailEl.innerHTML = consoleEmptyMarkup('Archive indisponible', 'Le systeme n a pas pu etre charge.')
})
