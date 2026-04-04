'use strict'

;(() => {
  // ── Config ────────────────────────────────────────────────────────────────
  const COLS = 9
  const ROWS = 11
  const CELL = 32
  const W = COLS * CELL  // 288
  const H = ROWS * CELL  // 352

  // Each atom type maps to a game field.
  // 🎮 is the anchor: a complete record = 🎮 + 3 or more adjacent field atoms.
  // Field checks use camelCase keys as returned by /api/items
  const ATOMS = [
    { key: 'base',  emoji: '🎮', color: '#9bbc0f', label: 'Jeu',    colPref: [3,4,5],      check: ()  => true },
    { key: 'cover', emoji: '🖼️', color: '#4FC3F7', label: 'Cover',  colPref: [0,1,2],      check: g  => !!g.coverImage },
    { key: 'price', emoji: '💰', color: '#81C784', label: 'Prix',   colPref: [4,5],        check: g  => !!(g.loosePrice || g.cibPrice) },
    { key: 'text',  emoji: '📖', color: '#CE93D8', label: 'Texte',  colPref: [5,6,7],      check: g  => !!g.summary },
    { key: 'score', emoji: '⭐', color: '#FFD54F', label: 'Score',  colPref: [7,8],        check: g  => !!g.metascore },
    { key: 'mint',  emoji: '💎', color: '#B2EBF2', label: 'Mint',   colPref: [3,4],        check: g  => !!g.mintPrice },
    { key: 'genre', emoji: '🎯', color: '#FF8A65', label: 'Genre',  colPref: [2,3,4,5,6],  check: g  => !!g.genre },
  ]
  const ATOM = Object.fromEntries(ATOMS.map(a => [a.key, a]))

  const SPAWN_MS = 680   // delay between atom spawns
  const FALL_SPD = 4     // px per frame
  const GLOW_MS  = 650   // how long matched cells glow
  const CLEAR_MS = 380   // fade-out duration in ms
  const NEXT_MS  = 1600  // pause before next game

  // ── Canvas ───────────────────────────────────────────────────────────────
  const canvas = document.getElementById('hub-ingest-canvas')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  canvas.width  = W
  canvas.height = H

  const elTitle   = document.getElementById('hub-ingest-title')
  const elMeta    = document.getElementById('hub-ingest-meta')
  const elScore   = document.getElementById('hub-ingest-score')
  const elCombo   = document.getElementById('hub-ingest-combo')
  const elLegend  = document.getElementById('hub-ingest-legend-items')
  const elQuality = document.getElementById('hub-ingest-quality')

  // ── State ────────────────────────────────────────────────────────────────
  // grid[row][col] = null | { key, emoji, color, opacity, glowing, clearing }
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null))

  let games = [], gameIdx = 0
  let score = 0, dispScore = 0
  let queue   = []   // atom keys left to spawn for current game
  let falling = []   // { key, emoji, color, col, y, targetY }
  let lastSpawn = 0
  // phases: init | spawning | glowing | clearing | next
  let phase = 'init'
  let glowStart = 0, nextStart = 0
  let comboTmo = null

  // ── Helpers ───────────────────────────────────────────────────────────────
  function set(el, v) { if (el) el.textContent = v }

  // Returns the lowest empty row in a column, treating rows already claimed
  // by in-flight atoms as occupied so two atoms never target the same cell.
  function targetRow(col) {
    const reserved = new Set(
      falling.filter(a => a.col === col).map(a => Math.round(a.targetY / CELL))
    )
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!grid[r][col] && !reserved.has(r)) return r
    }
    return -1
  }

  function pickCol(key) {
    // Field atoms (non-base) prefer to land near an existing 🎮 atom so
    // they can pair with it. This makes the anchor mechanic feel natural.
    if (key !== 'base') {
      const baseCols = []
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (grid[r][c]?.key === 'base') baseCols.push(c)
        }
      }
      if (baseCols.length && Math.random() < 0.62) {
        const anchor = baseCols[Math.floor(Math.random() * baseCols.length)]
        const near = [anchor - 1, anchor, anchor + 1].filter(c => c >= 0 && c < COLS && targetRow(c) >= 0)
        if (near.length) return near[Math.floor(Math.random() * near.length)]
      }
    }
    // Fallback: use declared column preference
    const a = ATOM[key]
    const usePref = Math.random() < 0.68
    const pool = usePref ? a.colPref : Array.from({ length: COLS }, (_, i) => i)
    const avail = pool.filter(c => targetRow(c) >= 0)
    if (!avail.length) {
      const any = Array.from({ length: COLS }, (_, i) => i).filter(c => targetRow(c) >= 0)
      return any.length ? any[Math.floor(Math.random() * any.length)] : 0
    }
    return avail[Math.floor(Math.random() * avail.length)]
  }

  function gridNeedsReset() {
    for (let r = 0; r < 2; r++) {
      if (grid[r].some(c => c !== null)) return true
    }
    return false
  }

  function resetBoard() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) grid[r][c] = null
    }
  }

  // ── Match detection ───────────────────────────────────────────────────────
  // A record is complete when a 🎮 atom has 3+ adjacent field atoms (any type).
  // All of them — the anchor and its field neighbors — clear together.
  function findMatches() {
    const hits = new Set()

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c]?.key !== 'base') continue

        const neighbors = []
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue
            const nr = r + dr, nc = c + dc
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
              const cell = grid[nr][nc]
              if (cell && cell.key !== 'base') neighbors.push(`${nr},${nc}`)
            }
          }
        }

        // 3+ field atoms adjacent = complete record
        if (neighbors.length >= 3) {
          hits.add(`${r},${c}`)
          neighbors.forEach(k => hits.add(k))
        }
      }
    }

    return [...hits].map(s => { const [r, c] = s.split(',').map(Number); return { r, c } })
  }

  function applyGravity() {
    for (let c = 0; c < COLS; c++) {
      const col = []
      for (let r = ROWS - 1; r >= 0; r--) {
        if (grid[r][c]) col.push(grid[r][c])
      }
      for (let r = ROWS - 1; r >= 0; r--) {
        grid[r][c] = col[ROWS - 1 - r] || null
      }
    }
  }

  // ── Game logic ────────────────────────────────────────────────────────────
  function qualityLabel(count) {
    if (count >= ATOMS.length) return 'COMPLET ★★★'
    if (count >= 5) return 'RICHE ★★'
    if (count >= 3) return 'PARTIEL ★'
    return 'SPARSE ○'
  }

  function updateLegend(game) {
    if (!elLegend) return
    while (elLegend.firstChild) elLegend.removeChild(elLegend.firstChild)
    ATOMS.forEach(a => {
      const span = document.createElement('span')
      span.className = 'hub-ingest-atom' + (a.check(game) ? ' has' : '')
      span.title = a.label
      span.textContent = a.emoji
      elLegend.appendChild(span)
    })
  }

  function startGame(game) {
    set(elTitle, game.title || '—')
    set(elMeta, [game.platform, game.year].filter(Boolean).join(' · ') || '—')

    const present = ATOMS.filter(a => a.check(game))
    set(elQuality, qualityLabel(present.length))
    updateLegend(game)

    queue = ['base', ...present.filter(a => a.key !== 'base').map(a => a.key).sort(() => Math.random() - .5)]
    falling = []
    lastSpawn = performance.now()
    phase = 'spawning'
  }

  function spawnAtom(now) {
    if (!queue.length || now - lastSpawn < SPAWN_MS) return
    lastSpawn = now

    const key = queue.shift()
    const col = pickCol(key)
    const tr  = targetRow(col)
    if (tr < 0) return  // column full — skip

    const a = ATOM[key]
    falling.push({ key, emoji: a.emoji, color: a.color, col, y: -CELL, targetY: tr * CELL })
  }

  function tickFalling() {
    falling = falling.filter(a => {
      a.y = Math.min(a.targetY, a.y + FALL_SPD)
      if (a.y >= a.targetY) {
        const row = Math.round(a.targetY / CELL)
        if (row >= 0 && row < ROWS && a.col >= 0 && a.col < COLS && !grid[row][a.col]) {
          grid[row][a.col] = { key: a.key, emoji: a.emoji, color: a.color, opacity: 1, glowing: false, clearing: false }
        }
        return false
      }
      return true
    })
  }

  function enterCheck(now, cascade) {
    const matches = findMatches()
    if (!matches.length) {
      phase     = 'next'
      nextStart = now
      return
    }
    // Score: each field atom in a cleared record is worth 60 pts. Cascade ×2.
    const fieldAtoms = matches.filter(({ r, c }) => grid[r][c]?.key !== 'base')
    score += fieldAtoms.length * (cascade ? 120 : 60)
    matches.forEach(({ r, c }) => { if (grid[r][c]) grid[r][c].glowing = true })
    showCombo(fieldAtoms.length, cascade)
    glowStart = now
    phase = 'glowing'
  }

  function showCombo(fields, cascade) {
    if (!elCombo) return
    const txt = cascade         ? `✨ CASCADE ${fields} champs`
              : fields >= ATOMS.length - 1 ? `🔥 FICHE COMPLÈTE!`
              : fields >= 5     ? `⚡ FICHE RICHE ${fields}`
              :                    `✓ FICHE ${fields} champs`
    set(elCombo, txt)
    elCombo.classList.add('is-active')
    clearTimeout(comboTmo)
    comboTmo = setTimeout(() => elCombo?.classList.remove('is-active'), 1500)
  }

  // ── Drawing ───────────────────────────────────────────────────────────────
  function drawBg() {
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = '#181818'
    ctx.lineWidth = 1
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL); ctx.stroke()
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, H); ctx.stroke()
    }
  }

  function drawAtom(cx, cy, atom, alpha) {
    const p = 3
    ctx.globalAlpha = alpha ?? 1

    if (atom.glowing) {
      const g = ctx.createRadialGradient(cx + CELL / 2, cy + CELL / 2, 1, cx + CELL / 2, cy + CELL / 2, CELL)
      g.addColorStop(0, atom.color + 'cc')
      g.addColorStop(1, atom.color + '11')
      ctx.fillStyle = g
      ctx.fillRect(cx, cy, CELL, CELL)
    } else {
      ctx.fillStyle = atom.color + '1e'
      ctx.fillRect(cx + p, cy + p, CELL - p * 2, CELL - p * 2)
    }

    ctx.strokeStyle = atom.glowing ? atom.color : atom.color + '55'
    ctx.lineWidth   = atom.glowing ? 2 : 1
    ctx.strokeRect(cx + p + .5, cy + p + .5, CELL - p * 2 - 1, CELL - p * 2 - 1)

    ctx.font         = `${Math.round(CELL * .52)}px serif`
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle    = atom.glowing ? '#ffffff' : '#bbbbbb'
    ctx.fillText(atom.emoji, cx + CELL / 2, cy + CELL / 2 + 1)

    ctx.globalAlpha = 1
  }

  // ── Main loop ─────────────────────────────────────────────────────────────
  function loop(now) {
    drawBg()

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = grid[r][c]
        if (!cell) continue
        if (cell.clearing) {
          cell.opacity -= 16.7 / CLEAR_MS
          if (cell.opacity <= 0) { grid[r][c] = null; continue }
        }
        drawAtom(c * CELL, r * CELL, cell, cell.opacity)
      }
    }

    for (const a of falling) {
      drawAtom(a.col * CELL, a.y, { emoji: a.emoji, color: a.color, glowing: false }, 0.8)
    }

    if (phase === 'spawning') {
      spawnAtom(now)
      tickFalling()
      if (!queue.length && !falling.length) enterCheck(now, false)
    }

    if (phase === 'glowing' && now - glowStart > GLOW_MS) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (grid[r][c]?.glowing) {
            grid[r][c].glowing  = false
            grid[r][c].clearing = true
            grid[r][c].opacity  = 1
          }
        }
      }
      phase = 'clearing'
    }

    if (phase === 'clearing') {
      if (!grid.some(row => row.some(cell => cell?.clearing))) {
        applyGravity()
        const cascade = findMatches()
        if (cascade.length) {
          const cascadeFields = cascade.filter(({ r, c }) => grid[r][c]?.key !== 'base')
          score += cascadeFields.length * 120
          cascade.forEach(({ r, c }) => { if (grid[r][c]) grid[r][c].glowing = true })
          showCombo(cascadeFields.length, true)
          glowStart = now
          phase = 'glowing'
        } else {
          phase     = 'next'
          nextStart = now
        }
      }
    }

    if (phase === 'next' && now - nextStart > NEXT_MS) {
      if (gridNeedsReset()) resetBoard()
      gameIdx = (gameIdx + 1) % games.length
      startGame(games[gameIdx])
    }

    if (dispScore < score) {
      dispScore = Math.min(score, dispScore + Math.max(1, Math.ceil((score - dispScore) * 0.12)))
      set(elScore, dispScore.toLocaleString())
    }

    requestAnimationFrame(loop)
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  async function init() {
    try {
      const res = await fetch('/api/items?limit=80&sort=metascore_desc')
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      games = (data.items || []).sort(() => Math.random() - .5)
      if (!games.length) { set(elTitle, 'Aucune donnée'); return }
      startGame(games[0])
      requestAnimationFrame(loop)
    } catch {
      set(elTitle, 'Flux indisponible')
    }
  }

  init()
})()
