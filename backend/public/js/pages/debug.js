'use strict'

const healthEl = document.getElementById('health')
const originHintEl = document.getElementById('originHint')
const backendBaseEl = document.getElementById('backendBase')
const consoleEl = document.getElementById('console')
const queryEl = document.getElementById('query')
const limitEl = document.getElementById('limit')
const resultsEl = document.getElementById('results')
const randomResultEl = document.getElementById('randomResult')
const detailStatusEl = document.getElementById('detailStatus')
const detailResultEl = document.getElementById('detailResult')

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') {
    return 'n/a'
  }
  return String(value)
}

function formatPrice(value) {
  if (value === null || value === undefined || value === '') {
    return 'n/a'
  }
  const number = Number(value)
  return Number.isFinite(number) ? `$${number}` : String(value)
}

function gameCard(game) {
  return `
    <article class="card">
      <strong>${escapeHtml(game.title)}</strong>
      <div class="meta">
        <div><span class="muted">ID</span><br>${escapeHtml(game.id)}</div>
        <div><span class="muted">Console</span><br>${escapeHtml(game.console || 'n/a')}</div>
        <div><span class="muted">Year</span><br>${escapeHtml(game.year || 'n/a')}</div>
        <div><span class="muted">Genre</span><br>${escapeHtml(game.genre || 'n/a')}</div>
        <div><span class="muted">Metascore</span><br>${escapeHtml(game.metascore || 'n/a')}</div>
        <div><span class="muted">Rarity</span><br>${escapeHtml(game.rarity || 'n/a')}</div>
        <div><span class="muted">Developer</span><br>${escapeHtml(game.developer || 'n/a')}</div>
      </div>
      ${game.summary ? `<div class="summary">${escapeHtml(game.summary)}</div>` : ''}
      <div class="prices">
        <div class="price-card"><span class="muted">Loose</span><br>${escapeHtml(formatPrice(game.prices?.loose ?? game.loosePrice))}</div>
        <div class="price-card"><span class="muted">CIB</span><br>${escapeHtml(formatPrice(game.prices?.cib ?? game.cibPrice))}</div>
        <div class="price-card"><span class="muted">Mint</span><br>${escapeHtml(formatPrice(game.prices?.mint ?? game.mintPrice))}</div>
      </div>
      <div class="card-actions">
        <button
          class="card-button detail-button"
          type="button"
          data-game-id="${escapeHtml(game.id || '')}"
          data-game-title="${escapeHtml(game.title || '')}"
        >
          Voir le detail backend
        </button>
        <button
          class="card-button copy-button"
          type="button"
          data-game-id="${escapeHtml(game.id || '')}"
          data-game-title="${escapeHtml(game.title || '')}"
          data-game-console="${escapeHtml(game.console || '')}"
        >
          Copier ID + titre
        </button>
      </div>
    </article>
  `
}

function buildCopyPayload(gameId, gameTitle, gameConsole) {
  return [
    `id: ${gameId || 'n/a'}`,
    `title: ${gameTitle || 'n/a'}`,
    `console: ${gameConsole || 'n/a'}`,
  ].join('\n')
}

async function copyGameMeta(gameId, gameTitle, gameConsole) {
  const payload = buildCopyPayload(gameId, gameTitle, gameConsole)

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(payload)
    detailStatusEl.textContent = `Infos copiees pour ${gameTitle || gameId || 'le jeu selectionne'}`
    return
  }

  const temp = document.createElement('textarea')
  temp.value = payload
  document.body.appendChild(temp)
  temp.select()
  document.execCommand('copy')
  temp.remove()
  detailStatusEl.textContent = `Infos copiees pour ${gameTitle || gameId || 'le jeu selectionne'}`
}

function detailCard(game) {
  return `
    <article class="card detail-stack">
      <div>
        <strong>${escapeHtml(game.title || 'Unknown game')}</strong>
        <div class="muted">${escapeHtml(game.console || 'n/a')} - ${escapeHtml(game.year || 'n/a')}</div>
      </div>
      <section class="detail-section">
        <strong>Identite</strong>
        <div class="meta">
          <div><span class="muted">ID</span><br>${escapeHtml(game.id || 'n/a')}</div>
          <div><span class="muted">Console</span><br>${escapeHtml(game.console || 'n/a')}</div>
          <div><span class="muted">Year</span><br>${escapeHtml(game.year || 'n/a')}</div>
          <div><span class="muted">Genre</span><br>${escapeHtml(game.genre || 'n/a')}</div>
        </div>
      </section>
      <section class="detail-section">
        <strong>Edition</strong>
        <div class="meta">
          <div><span class="muted">Developer</span><br>${escapeHtml(game.developer || 'n/a')}</div>
          <div><span class="muted">Metascore</span><br>${escapeHtml(formatValue(game.metascore))}</div>
          <div><span class="muted">Rarity</span><br>${escapeHtml(formatValue(game.rarity))}</div>
        </div>
      </section>
      <section class="detail-section">
        <strong>Market</strong>
        <div class="prices">
          <div class="price-card"><span class="muted">Loose</span><br>${escapeHtml(formatPrice(game.prices?.loose ?? game.loosePrice))}</div>
          <div class="price-card"><span class="muted">CIB</span><br>${escapeHtml(formatPrice(game.prices?.cib ?? game.cibPrice))}</div>
          <div class="price-card"><span class="muted">Mint</span><br>${escapeHtml(formatPrice(game.prices?.mint ?? game.mintPrice))}</div>
        </div>
      </section>
      <section class="detail-section">
        <strong>Résumé</strong>
        <div class="summary">${escapeHtml(game.summary || 'Aucun résumé disponible.')}</div>
      </section>
    </article>
  `
}

function getBackendBase() {
  return backendBaseEl.value.trim().replace(/\/$/, '')
}

function getApiUrl(path) {
  return `${getBackendBase()}${path}`
}

function getDefaultBackendBase() {
  if (window.location.protocol === 'file:') {
    return 'http://127.0.0.1:3000'
  }
  return window.location.origin
}

function getInitialGameId() {
  const params = new URLSearchParams(window.location.search)
  return params.get('gameId') || ''
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }
  return response.json()
}

function formatNetworkError(error) {
  if (String(error.message).includes('Failed to fetch')) {
    return 'Impossible de joindre le backend. Lancez le serveur backend puis rechargez la page.'
  }
  return error.message
}

async function loadHealth() {
  try {
    const health = await fetchJson(getApiUrl('/api/health'))
    healthEl.innerHTML = `<strong>API OK</strong><br />${health.games} entr?es dans ${health.storage}`
    originHintEl.textContent = `Source API active : ${getBackendBase()}`
  } catch (error) {
    healthEl.textContent = `Erreur : ${formatNetworkError(error)}`
    originHintEl.textContent = `Source API attendue : ${getBackendBase()}`
  }
}

async function loadConsoles() {
  const consoles = await fetchJson(getApiUrl('/api/consoles'))
  for (const item of consoles.items) {
    const option = document.createElement('option')
    option.value = item.name
    option.textContent = `${item.name} (${item.gamesCount})`
    consoleEl.appendChild(option)
  }
}

async function loadGameDetail(gameId, fallbackTitle) {
  detailStatusEl.textContent = 'Chargement du resume backend...'
  detailResultEl.innerHTML = ''

  try {
    const payload = await fetchJson(getApiUrl(`/api/games/${encodeURIComponent(gameId)}/summary`))
    const game = payload.item || payload
    detailStatusEl.textContent = `Resume charge pour ${game.title || fallbackTitle || gameId}`
    detailResultEl.innerHTML = detailCard(game)
  } catch (error) {
    detailStatusEl.textContent = `Erreur resume - ${formatNetworkError(error)}`
  }
}

async function searchGames() {
  resultsEl.innerHTML = '<div class="muted">Chargement...</div>'
  const params = new URLSearchParams()
  if (queryEl.value.trim()) {
    params.set('q', queryEl.value.trim())
  }
  if (consoleEl.value) {
    params.set('console', consoleEl.value)
  }
  params.set('limit', limitEl.value)

  try {
    const payload = await fetchJson(getApiUrl(`/api/games?${params.toString()}`))
    if (!payload.items.length) {
      resultsEl.innerHTML = '<div class="muted">Aucun resultat.</div>'
      return
    }
    resultsEl.innerHTML = payload.items.map(gameCard).join('')
  } catch (error) {
    resultsEl.innerHTML = `<pre>Erreur : ${escapeHtml(formatNetworkError(error))}</pre>`
  }
}

async function loadRandomGame() {
  randomResultEl.innerHTML = '<div class="muted">Chargement...</div>'
  const params = new URLSearchParams()
  if (consoleEl.value) {
    params.set('console', consoleEl.value)
  }

  try {
    const payload = await fetchJson(getApiUrl(`/api/games/random?${params.toString()}`))
    randomResultEl.innerHTML = gameCard(payload)
    loadGameDetail(payload.id, payload.title)
  } catch (error) {
    randomResultEl.innerHTML = `<pre>Erreur : ${escapeHtml(formatNetworkError(error))}</pre>`
  }
}

document.getElementById('searchButton').addEventListener('click', searchGames)
document.getElementById('randomButton').addEventListener('click', loadRandomGame)
document.body.addEventListener('click', (event) => {
  const detailButton = event.target.closest('.detail-button')
  if (detailButton) {
    loadGameDetail(detailButton.dataset.gameId, detailButton.dataset.gameTitle)
    return
  }

  const copyButton = event.target.closest('.copy-button')
  if (!copyButton) return
  copyGameMeta(
    copyButton.dataset.gameId,
    copyButton.dataset.gameTitle,
    copyButton.dataset.gameConsole
  ).catch((error) => {
    detailStatusEl.textContent = `Erreur copie - ${formatNetworkError(error)}`
  })
})

backendBaseEl.value = getDefaultBackendBase()
loadHealth()
loadConsoles().then(async () => {
  await searchGames()
  const initialGameId = getInitialGameId()
  if (initialGameId) {
    await loadGameDetail(initialGameId, initialGameId)
    return
  }
  await loadRandomGame()
})
