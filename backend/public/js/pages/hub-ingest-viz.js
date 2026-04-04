'use strict'

;(() => {
  const COLS = 9
  const ROWS = 11
  const CELL = 32
  const W = COLS * CELL  // 288
  const H = ROWS * CELL  // 352

  const ATOMS = [
    { key: 'base',  emoji: '🎮', color: '#9bbc0f', colPref: [3,4,5],     check: ()  => true },
    { key: 'cover', emoji: '🖼️', color: '#4FC3F7', colPref: [0,1,2],     check: g  => !!g.coverImage },
    { key: 'price', emoji: '💰', color: '#81C784', colPref: [4,5],       check: g  => !!(g.loosePrice || g.cibPrice) },
    { key: 'text',  emoji: '📖', color: '#CE93D8', colPref: [5,6,7],     check: g  => !!g.summary },
    { key: 'score', emoji: '⭐', color: '#FFD54F', colPref: [7,8],       check: g  => !!g.metascore },
    { key: 'mint',  emoji: '💎', color: '#B2EBF2', colPref: [3,4],       check: g  => !!g.mintPrice },
    { key: 'genre', emoji: '🎯', color: '#FF8A65', colPref: [2,3,4,5,6], check: g  => !!g.genre },
  ]
  const ATOM = Object.fromEntries(ATOMS.map(a => [a.key, a]))

  const SPAWN_MS = 600   // delay between atom spawns
  const FALL_SPD = 4     // px per frame
  const READ_MS  = 2800  // pause after all atoms land (time to read)

  // ── Canvas ────────────────────────────────────────────────────────────────
  const canvas = document.getElementById('hub-ingest-canvas')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  canvas.width  = W
  canvas.height = H

  const elTitle   = document.getElementById('hub-ingest-title')
  const elMeta    = document.getElementById('hub-ingest-meta')
  const elLegend  = document.getElementById('hub-ingest-legend-items')
  const elQuality = document.getElementById('hub-ingest-quality')

  // ── State ─────────────────────────────────────────────────────────────────
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null))
  let games = [], gameIdx = 0
  let queue = [], falling = [], lastSpawn = 0
  let phase = 'init'   // init | spawning | reading | next
  let readStart = 0

  // ── Helpers ───────────────────────────────────────────────────────────────
  function set(el, v) { if (el) el.textContent = v }

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
    if (key !== 'base') {
      const baseCols = []
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (grid[r][c]?.key === 'base') baseCols.push(c)
      if (baseCols.length && Math.random() < 0.62) {
        const anchor = baseCols[Math.floor(Math.random() * baseCols.length)]
        const near = [anchor - 1, anchor, anchor + 1].filter(c => c >= 0 && c < COLS && targetRow(c) >= 0)
        if (near.length) return near[Math.floor(Math.random() * near.length)]
      }
    }
    const a = ATOM[key]
    const pool = Math.random() < 0.68 ? a.colPref : Array.from({ length: COLS }, (_, i) => i)
    const avail = pool.filter(c => targetRow(c) >= 0)
    if (avail.length) return avail[Math.floor(Math.random() * avail.length)]
    const any = Array.from({ length: COLS }, (_, i) => i).filter(c => targetRow(c) >= 0)
    return any.length ? any[Math.floor(Math.random() * any.length)] : 0
  }

  function resetBoard() {
    for (let r = 0; r < ROWS; r++) grid[r].fill(null)
  }

  // ── Game cycle ────────────────────────────────────────────────────────────
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
      span.className   = 'hub-ingest-atom' + (a.check(game) ? ' has' : '')
      span.title       = a.key
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
    resetBoard()
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
    if (tr < 0) return
    const a = ATOM[key]
    falling.push({ key, emoji: a.emoji, color: a.color, col, y: -CELL, targetY: tr * CELL })
  }

  function tickFalling() {
    falling = falling.filter(a => {
      a.y = Math.min(a.targetY, a.y + FALL_SPD)
      if (a.y >= a.targetY) {
        const row = Math.round(a.targetY / CELL)
        if (row >= 0 && row < ROWS && !grid[row][a.col]) {
          grid[row][a.col] = { key: a.key, emoji: a.emoji, color: a.color }
        }
        return false
      }
      return true
    })
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
    ctx.fillStyle = atom.color + '1e'
    ctx.fillRect(cx + p, cy + p, CELL - p * 2, CELL - p * 2)
    ctx.strokeStyle = atom.color + '55'
    ctx.lineWidth   = 1
    ctx.strokeRect(cx + p + .5, cy + p + .5, CELL - p * 2 - 1, CELL - p * 2 - 1)
    ctx.font         = `${Math.round(CELL * .52)}px serif`
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle    = '#bbbbbb'
    ctx.fillText(atom.emoji, cx + CELL / 2, cy + CELL / 2 + 1)
    ctx.globalAlpha = 1
  }

  // ── Main loop ─────────────────────────────────────────────────────────────
  function loop(now) {
    drawBg()

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c]) drawAtom(c * CELL, r * CELL, grid[r][c])

    for (const a of falling)
      drawAtom(a.col * CELL, a.y, { emoji: a.emoji, color: a.color }, 0.8)

    if (phase === 'spawning') {
      spawnAtom(now)
      tickFalling()
      if (!queue.length && !falling.length) {
        readStart = now
        phase = 'reading'
      }
    }

    if (phase === 'reading' && now - readStart > READ_MS) {
      gameIdx = (gameIdx + 1) % games.length
      startGame(games[gameIdx])
    }

    requestAnimationFrame(loop)
  }

  // ── Init ──────────────────────────────────────────────────────────────────
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
