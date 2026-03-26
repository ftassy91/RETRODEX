'use strict'

const consoleUi = window.RetroDexConsoleUi || {}
const escapeHtml = consoleUi.escapeHtml || ((value) => String(value ?? ''))

const countEl = document.getElementById('console-count')
const gridEl = document.getElementById('consoles-grid')
const detailEl = document.getElementById('console-detail')

let selectedId = ''

function requestedConsoleId() {
  return new URLSearchParams(window.location.search).get('id') || ''
}

function consoleEmptyMarkup(title, copy) {
  return `
    <div class="console-detail-empty terminal-empty-state">
      <div class="terminal-empty-title">${escapeHtml(title)}</div>
      <div class="terminal-empty-copy">${escapeHtml(copy)}</div>
    </div>
  `
}

function qualityTone(tier) {
  if (tier === 'Tier A') return 'is-hot'
  if (tier === 'Tier B') return 'is-primary'
  return ''
}

function consoleRowMarkup(item) {
  const isSelected = item.id === selectedId
  return `
    <a href="/console-detail.html?id=${encodeURIComponent(item.id)}"
       class="console-row${isSelected ? ' active' : ''}"
       data-id="${escapeHtml(item.id)}">
      <span class="console-row-title">${escapeHtml(item.name || 'Console')}</span>
      <span class="console-row-meta">${escapeHtml(item.manufacturer || 'Archive')} | ${escapeHtml(item.releaseYear || 'n/a')} | ${escapeHtml(item.gamesCount || 0)} jeux</span>
      <span class="console-row-signal ${qualityTone(item.quality?.tier)}">${escapeHtml(item.quality?.tier || 'Tier D')}</span>
    </a>
  `
}

function bindRows(items) {
  gridEl.querySelectorAll('.console-row').forEach((row) => {
    row.addEventListener('click', async (event) => {
      event.preventDefault()
      selectedId = row.dataset.id || ''
      syncSelectedRow()
      await loadDetail(selectedId)
      history.replaceState({}, '', `/consoles.html?id=${encodeURIComponent(selectedId)}`)
    })
  })
}

function syncSelectedRow() {
  gridEl.querySelectorAll('.console-row').forEach((row) => {
    row.classList.toggle('active', row.dataset.id === selectedId)
  })
}

async function fetchConsolePayload(id) {
  const response = await fetch(`/api/consoles/${encodeURIComponent(id)}`)
  const payload = await response.json()
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`)
  }
  return payload
}

async function loadDetail(id) {
  if (!detailEl) return

  detailEl.innerHTML = consoleEmptyMarkup('Chargement', 'Lecture de la fiche hardware.')
  const payload = await fetchConsolePayload(id)
  await window.RetroDexConsoleSurface.renderConsoleSurface(detailEl, payload, {
    embedded: true,
  })
}

async function loadConsoles() {
  const response = await fetch('/api/consoles')
  const payload = await response.json()

  if (!response.ok || !payload.ok) {
    if (countEl) countEl.textContent = 'Impossible de charger les consoles'
    if (gridEl) gridEl.innerHTML = ''
    if (detailEl) detailEl.innerHTML = consoleEmptyMarkup('Archive indisponible', 'Les consoles n ont pas pu etre chargees.')
    return
  }

  const consoles = payload.items || []
  if (countEl) countEl.textContent = `${payload.count || consoles.length} systemes retro`
  gridEl.innerHTML = consoles.map(consoleRowMarkup).join('')
  bindRows(consoles)

  if (!consoles.length) {
    detailEl.innerHTML = consoleEmptyMarkup('Aucune console', 'Aucune entree disponible dans l archive.')
    return
  }

  const requested = requestedConsoleId()
  const initial = consoles.find((item) => item.id === requested || item.slug === requested) || consoles[0]
  selectedId = initial.id
  syncSelectedRow()
  await loadDetail(selectedId)
}

loadConsoles().catch((error) => {
  console.error('[consoles]', error)
  if (countEl) countEl.textContent = 'Impossible de charger les consoles'
  if (detailEl) detailEl.innerHTML = consoleEmptyMarkup('Archive indisponible', 'Le systeme n a pas pu etre charge.')
})
