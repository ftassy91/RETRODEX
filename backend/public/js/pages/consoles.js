'use strict'

const countEl = document.getElementById('console-count')
const gridEl = document.getElementById('consoles-grid')
const detailEl = document.getElementById('console-detail')

let selectedId = null
let selectedPlatform = ''

function requestedPlatform() {
  return new URLSearchParams(window.location.search).get('platform') || ''
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function manufacturerFor(label) {
  const text = String(label || '').toLowerCase()
  if (text.includes('nintendo') || text.includes('game boy')) return 'Nintendo'
  if (text.includes('sega') || text.includes('dreamcast') || text.includes('saturn') || text.includes('genesis')) return 'Sega'
  if (text.includes('playstation')) return 'Sony'
  if (text.includes('neo geo')) return 'SNK'
  if (text.includes('atari')) return 'Atari'
  return 'Archive'
}

function consoleRowMarkup(item) {
  const manufacturer = manufacturerFor(item.title || item.platform)
  const isSelected = item.id === selectedId

  return `
    <button type="button" class="console-row${isSelected ? ' active' : ''}" data-id="${escapeHtml(item.id)}" data-platform="${escapeHtml(item.platform || '')}">
      <span class="console-row-title">${escapeHtml(item.title || item.platform || 'Console')}</span>
      <span class="console-row-meta">${escapeHtml(manufacturer)} &middot; ${escapeHtml(item.year || 'n/a')} &middot; ${escapeHtml(item.gamesCount || 0)} jeux</span>
      <span class="console-row-signal">${escapeHtml(item.platform || 'Archive')}</span>
    </button>
  `
}

function accessoryMarkup(accessories) {
  if (!accessories.length) {
    return '<div class="console-detail-empty">Aucun accessoire indexe pour ce systeme.</div>'
  }

  return accessories.map((item) => `
    <div class="console-accessory-row">
      <a href="/accessories.html" class="console-inline-link">${escapeHtml(item.name || 'Accessoire')}</a>
      <span class="console-accessory-type">${escapeHtml(item.accessory_type || 'other')}</span>
    </div>
  `).join('')
}

function gamesMarkup(consoleInfo, games) {
  if (!games.length) {
    return '<div class="console-detail-empty">Aucun jeu relie a ce systeme pour le moment.</div>'
  }

  return `
    <div class="console-games-list">
      ${games.map((game) => `
        <a class="console-game-row" href="/game-detail.html?id=${encodeURIComponent(game.id)}">
          <span class="console-game-title">${escapeHtml(game.title || 'Jeu')}</span>
          <span class="console-game-meta">${escapeHtml(consoleInfo.platform || '')} &middot; ${escapeHtml(game.year || 'n/a')}</span>
        </a>
      `).join('')}
    </div>
  `
}

function renderDetail(payload) {
  const consoleInfo = payload.console || {}
  const games = payload.games || []
  const accessories = payload.accessories || []
  const manufacturer = manufacturerFor(consoleInfo.title || consoleInfo.platform)

  detailEl.innerHTML = `
    <div class="console-detail-hero">
      <div class="console-detail-slot">
        <div class="console-detail-placeholder">${escapeHtml(String(consoleInfo.title || consoleInfo.platform || 'RD').slice(0, 2).toUpperCase())}</div>
        <div class="console-detail-slot-caption">SYSTEM SLOT</div>
      </div>

      <div class="console-detail-copy">
        <div class="detail-kicker">HARDWARE ENTRY</div>
        <div class="console-detail-title">${escapeHtml(consoleInfo.title || 'Console')}</div>
        <div class="console-detail-meta">${escapeHtml(manufacturer)} &middot; ${escapeHtml(consoleInfo.year || 'n/a')} &middot; ${escapeHtml(consoleInfo.platform || 'Archive')}</div>
        <div class="console-detail-signals">
          <span class="console-detail-badge">${escapeHtml(manufacturer)}</span>
          <span class="console-detail-badge">${escapeHtml(games.length)} jeux visibles</span>
          <span class="console-detail-badge">${escapeHtml(accessories.length)} accessoires</span>
        </div>
        <div class="console-detail-actions">
          <a class="terminal-action-link" href="/games-list.html?console=${encodeURIComponent(consoleInfo.platform || '')}">Ouvrir le catalogue &rarr;</a>
          <a class="terminal-action-link" href="/search.html">Rechercher un jeu &rarr;</a>
        </div>
      </div>
    </div>

    <div class="console-section">
      <div class="console-section-head">
        <div>
          <div class="detail-kicker">CATALOG BRIDGE</div>
          <h3 class="console-section-title">Jeux lies</h3>
        </div>
        <div class="console-section-copy">Passerelle directe vers les fiches jeu de ce systeme.</div>
      </div>
      ${gamesMarkup(consoleInfo, games)}
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
  detailEl.innerHTML = '<div class="console-detail-empty">Chargement...</div>'

  const response = await fetch(`/api/consoles/${encodeURIComponent(id)}`)
  const payload = await response.json()

  if (!response.ok || !payload.ok) {
    detailEl.innerHTML = '<div class="console-detail-empty">Console introuvable.</div>'
    return
  }

  renderDetail(payload)
}

async function loadConsoles() {
  const response = await fetch('/api/consoles')
  const payload = await response.json()

  if (!response.ok || !payload.ok) {
    countEl.textContent = 'Impossible de charger les consoles'
    gridEl.innerHTML = ''
    detailEl.innerHTML = '<div class="console-detail-empty">Erreur de chargement.</div>'
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
    const initial = consoles.find((item) => String(item.platform || '').toLowerCase() === requested) || consoles[0]
    selectedId = initial.id
    selectedPlatform = initial.platform || ''
    syncSelectedRow()
    await loadDetail(selectedId)
  }
}

loadConsoles().catch(() => {
  countEl.textContent = 'Impossible de charger les consoles'
  detailEl.innerHTML = '<div class="console-detail-empty">Erreur de chargement.</div>'
})
