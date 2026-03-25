'use strict'

function escapeHtml(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function fmtPrice(p) {
  return p != null && Number(p) > 0 ? `$${Number(p).toFixed(0)}` : '—'
}

async function fetchJson(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status}`)
  return r.json()
}

async function loadPage() {
  const params = new URLSearchParams(window.location.search)
  const id = params.get('id')
  if (!id) {
    document.getElementById('console-name').textContent = 'Console introuvable'
    return
  }

  const consoleRecord = await fetchJson(`/api/consoles/${encodeURIComponent(id)}`)

  document.title = `${consoleRecord.name} | RetroDex`
  document.getElementById('console-breadcrumb-name').textContent = consoleRecord.name
  document.getElementById('console-name').textContent = consoleRecord.name
  document.getElementById('console-maker').textContent = consoleRecord.maker || consoleRecord.manufacturer || '—'
  document.getElementById('console-gen').textContent = consoleRecord.gen || consoleRecord.generation ? `Gen ${consoleRecord.gen || consoleRecord.generation}` : '—'
  document.getElementById('console-type').textContent = consoleRecord.type || '—'

  const yearsEl = document.getElementById('console-years')
  if (yearsEl) {
    const startYear = consoleRecord.start_year || consoleRecord.releaseYear || consoleRecord.release_year || null
    const endYear = consoleRecord.end_year || null
    yearsEl.textContent = startYear
      ? endYear ? `${startYear} - ${endYear}` : String(startYear)
      : ''
  }

  const placeholder = document.getElementById('console-cover-placeholder')
  if (placeholder) {
    placeholder.textContent = (consoleRecord.name || '?').substring(0, 2).toUpperCase()
  }

  const gamesPayload = await fetchJson(`/api/games?console=${encodeURIComponent(consoleRecord.name)}&limit=500&sort=rarity_desc`)
  const games = gamesPayload.items || []

  const priced = games.filter((g) => g.loosePrice > 0)
  const avgLoose = priced.length
    ? (priced.reduce((s, g) => s + Number(g.loosePrice), 0) / priced.length).toFixed(0)
    : null
  const legendary = games.filter((g) => g.rarity === 'LEGENDARY').length
  const epic = games.filter((g) => g.rarity === 'EPIC').length

  const statsGrid = document.getElementById('console-stats-grid')
  if (statsGrid) {
    statsGrid.innerHTML = `
      <article class="stats-card">
        <span class="stats-card-label">Jeux indexés</span>
        <span class="stats-card-value">${games.length}</span>
        <span class="stats-card-sub">dans le catalogue RetroDex</span>
      </article>
      <article class="stats-card">
        <span class="stats-card-label">Prix moyen Loose</span>
        <span class="stats-card-value">${avgLoose ? `$${avgLoose}` : '—'}</span>
        <span class="stats-card-sub">${priced.length} jeux pricés</span>
      </article>
      <article class="stats-card">
        <span class="stats-card-label">LEGENDARY</span>
        <span class="stats-card-value" style="color:#f1c45c">${legendary}</span>
        <span class="stats-card-sub">${epic} EPIC</span>
      </article>
    `
  }

  document.getElementById('console-games-count').textContent =
    `${games.length} jeux — ${consoleRecord.name}`

  const listEl = document.getElementById('console-games-list')
  if (listEl && games.length) {
    listEl.innerHTML = games.map((game) => {
      const cover = game.coverImage
        ? `<img src="${escapeHtml(game.coverImage)}" alt="" width="48" height="48"
             style="width:48px;height:48px;object-fit:cover;border:1px solid rgba(155,188,15,0.2);">`
        : `<span style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;
             background:rgba(155,188,15,0.05);border:1px solid rgba(155,188,15,0.15);
             font-family:monospace;font-size:0.7rem;color:#486648;">
             ${escapeHtml((game.title||'?')[0])}
           </span>`

      const rarityColor = {
        LEGENDARY: '#f1c45c',
        EPIC: '#ff9966',
        RARE: '#9bbc0f',
        UNCOMMON: '#7a9a7a',
        COMMON: '#486648'
      }[game.rarity] || '#486648'

      return `
        <a href="/game-detail.html?id=${encodeURIComponent(game.id)}"
           class="terminal-table-row"
           style="grid-template-columns:60px 1fr 100px 70px 70px 90px;display:grid;
                  align-items:center;padding:0.4rem 0;
                  border-bottom:1px solid rgba(155,188,15,0.06);
                  text-decoration:none;color:inherit;">
          <span style="display:flex;">${cover}</span>
          <span style="font-family:'Share Tech Mono',monospace;font-size:0.82rem;color:#9bbc0f;">
            ${escapeHtml(game.title)}
          </span>
          <span style="font-family:'Share Tech Mono',monospace;font-size:0.75rem;color:#486648;">
            ${game.year || '—'}
          </span>
          <span style="text-align:right;font-family:'Share Tech Mono',monospace;
                       font-size:0.8rem;color:#a8c8a8;">
            ${fmtPrice(game.loosePrice)}
          </span>
          <span style="text-align:right;font-family:'Share Tech Mono',monospace;
                       font-size:0.8rem;color:#a8c8a8;">
            ${fmtPrice(game.mintPrice)}
          </span>
          <span style="text-align:center;">
            <span style="font-family:'Press Start 2P',monospace;font-size:0.5rem;
                         color:${rarityColor};letter-spacing:0.05em;">
              ${escapeHtml(game.rarity || '—')}
            </span>
          </span>
        </a>
      `
    }).join('')
  }
}

loadPage().catch((e) => {
  console.error('[console-detail]', e)
  document.getElementById('console-name').textContent = 'Erreur de chargement'
})
