'use strict'

const countEl = document.getElementById('accessories-count')
const listEl = document.getElementById('accessories-list')
const filterEl = document.getElementById('type-filter')
let allAccessories = []

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function accessoryStateMarkup(title, copy) {
  return `
    <div class="terminal-empty-state outlier-empty">
      <div class="terminal-empty-title">${escapeHtml(title)}</div>
      <div class="terminal-empty-copy">${escapeHtml(copy)}</div>
    </div>
  `
}

function renderList(items) {
  if (!items.length) {
    listEl.innerHTML = accessoryStateMarkup('Aucun accessoire visible', 'Aucun accessoire indexe pour ce filtre actif.')
    return
  }

  listEl.innerHTML = items.map((item) => {
    const consoleLabel = item.console_title || 'Sans console associee'
    const yearLabel = item.release_year || '-'
    const consoleHref = item.console_id
      ? `/consoles.html?slug=${encodeURIComponent(item.console_id)}`
      : '/consoles.html'

    return `
      <article class="accessory-row">
        <div class="accessory-main">
          <div class="accessory-title">${escapeHtml(item.name)}</div>
          <div class="accessory-meta">${escapeHtml(consoleLabel)} - ${escapeHtml(yearLabel)}</div>
        </div>
        <div class="accessory-type-chip">${escapeHtml(item.accessory_type || 'other')}</div>
        <a class="terminal-action-link" href="${consoleHref}">Console associee -></a>
      </article>
    `
  }).join('')
}

function applyFilter() {
  const type = filterEl.value
  const filtered = type ? allAccessories.filter((item) => item.accessory_type === type) : allAccessories
  renderList(filtered)
}

async function loadAccessories() {
  listEl.innerHTML = accessoryStateMarkup('Chargement', 'Lecture des accessoires hardware en cours.')

  const [typesRes, accessoriesRes] = await Promise.all([
    fetch('/api/market/accessories/types'),
    fetch('/api/market/accessories'),
  ])

  const typesPayload = await typesRes.json()
  const accessoriesPayload = await accessoriesRes.json()

  if (!typesRes.ok || !accessoriesRes.ok || !typesPayload.ok || !accessoriesPayload.ok) {
    throw new Error('Chargement impossible')
  }

  allAccessories = accessoriesPayload.accessories || []
  countEl.textContent = `${accessoriesPayload.count || allAccessories.length} accessoires indexes`

  const options = (typesPayload.types || []).map((type) =>
    `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`
  ).join('')
  filterEl.insertAdjacentHTML('beforeend', options)
  renderList(allAccessories)
}

filterEl.addEventListener('change', applyFilter)

loadAccessories().catch(() => {
  countEl.textContent = 'Impossible de charger les accessoires'
  listEl.innerHTML = accessoryStateMarkup('Archive indisponible', 'La base hardware n est pas disponible pour le moment.')
})
