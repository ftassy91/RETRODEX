'use strict'

const healthEl = document.getElementById('health')
const metaEl = document.getElementById('meta')
const samplesEl = document.getElementById('samples')
const randomCardEl = document.getElementById('randomCard')
const randomButtonEl = document.getElementById('randomButton')

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }
  return response.json()
}

async function loadHomeData() {
  try {
    const [health, consoles, gamesPayload] = await Promise.all([
      fetchJson('/api/health'),
      fetchJson('/api/consoles'),
      fetchJson('/api/games?limit=5&type=game'),
    ])

    const games = gamesPayload.items || []
    const consoleCount = consoles.items?.length || consoles.total || 0

    healthEl.innerHTML = `<strong>Backend OK</strong><br />${escapeHtml(health.games)} entr?es chargees dans ${escapeHtml(health.database)}`
    metaEl.innerHTML = `
      <div><span class="muted">Database</span><br>${escapeHtml(health.database)}</div>
      <div><span class="muted">Storage</span><br>${escapeHtml(health.storage)}</div>
      <div><span class="muted">Games table</span><br>${escapeHtml(health.games)}</div>
      <div><span class="muted">Consoles</span><br>${escapeHtml(consoleCount)}</div>
    `
    samplesEl.innerHTML = games
      .map(
        (game) => `<li><a href="/game-detail.html?id=${encodeURIComponent(game.id)}">${escapeHtml(game.title)}</a></li>`
      )
      .join('')
  } catch (error) {
    healthEl.textContent = `Erreur home - ${error.message}`
    metaEl.innerHTML = ''
    samplesEl.innerHTML = ''
  }
}

function renderRandomCard(game) {
  randomCardEl.classList.remove('muted')
  randomCardEl.innerHTML = `
    <h3>${escapeHtml(game.title)}</h3>
    <div class="meta">
      <div><span class="muted">Console</span><br>${escapeHtml(game.console || 'n/a')}</div>
      <div><span class="muted">Year</span><br>${escapeHtml(game.year || 'n/a')}</div>
      <div><span class="muted">Genre</span><br>${escapeHtml(game.genre || 'n/a')}</div>
      <div><span class="muted">Metascore</span><br>${escapeHtml(game.metascore || 'n/a')}</div>
    </div>
    <div class="actions">
      <a class="shell-primary-link" href="/game-detail.html?id=${encodeURIComponent(game.id)}">Ouvrir la fiche</a>
      <a class="shell-secondary-link" href="/search.html?q=${encodeURIComponent(game.title || '')}">Voir dans Recherche</a>
    </div>
  `
}

async function loadRandomGame() {
  randomCardEl.classList.add('muted')
  randomCardEl.textContent = 'Chargement d un jeu aleatoire...'

  try {
    const game = await fetchJson('/api/games/random')
    renderRandomCard(game)
  } catch (error) {
    randomCardEl.classList.add('muted')
    randomCardEl.textContent = `Erreur random - ${error.message}`
  }
}

randomButtonEl.addEventListener('click', loadRandomGame)

loadHomeData()
