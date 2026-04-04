'use strict'

;(() => {
  // ── 16-bit bubble shooter config ──────────────────────────────────────────
  // Logical canvas is 144×176; CSS scales 2× → 288×352 (pixel-art look)
  const W = 144, H = 176
  const R    = 9        // bubble radius (logical px)
  const DIAM = R * 2    // 18
  const ROW_H = 15      // hex row height ≈ R√3

  const COLS = 7        // bubbles per even row
  const ROWS = 7        // grid rows

  // Even-row col-0 center sits at (GRID_X0, GRID_Y0)
  const GRID_X0 = R     // 9  — left margin equals one radius
  const GRID_Y0 = R     // 9  — top margin equals one radius

  const SHOOT_X = W >> 1   // 72 — shooter horizontal center
  const SHOOT_Y = H - 22   // 154 — shooter base y

  const BSPEED   = 2.5   // bullet px/frame
  const AIM_MS   = 700   // ms to sweep to target angle
  const GLOW_MS  = 380   // ms flash before pop
  const NEXT_MS  = 1400  // ms pause before next game
  const MAX_SHOTS = 8    // shots per game before cycling

  // SNES-ish saturated palette; each key maps to a game data field
  const ATOMS = [
    { key: 'base',  emoji: '🎮', color: '#3bff4b', label: 'Jeu'   },
    { key: 'cover', emoji: '🖼️', color: '#4fc3f7', label: 'Cover' },
    { key: 'price', emoji: '💰', color: '#44d870', label: 'Prix'  },
    { key: 'text',  emoji: '📖', color: '#c264ff', label: 'Texte' },
    { key: 'score', emoji: '⭐', color: '#ffd740', label: 'Score' },
    { key: 'mint',  emoji: '💎', color: '#00e5ff', label: 'Mint'  },
    { key: 'genre', emoji: '🎯', color: '#ff6040', label: 'Genre' },
  ]
  const CHECKS = {
    base:  ()  => true,
    cover: g  => !!g.coverImage,
    price: g  => !!(g.loosePrice || g.cibPrice),
    text:  g  => !!g.summary,
    score: g  => !!g.metascore,
    mint:  g  => !!g.mintPrice,
    genre: g  => !!g.genre,
  }

  // ── Canvas ────────────────────────────────────────────────────────────────
  const canvas = document.getElementById('hub-ingest-canvas')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  canvas.width  = W
  canvas.height = H
  canvas.style.width  = (W * 2) + 'px'   // 288
  canvas.style.height = (H * 2) + 'px'   // 352
  ctx.imageSmoothingEnabled = false

  const elTitle   = document.getElementById('hub-ingest-title')
  const elMeta    = document.getElementById('hub-ingest-meta')
  const elScore   = document.getElementById('hub-ingest-score')
  const elCombo   = document.getElementById('hub-ingest-combo')
  const elLegend  = document.getElementById('hub-ingest-legend-items')
  const elQuality = document.getElementById('hub-ingest-quality')

  // ── State ─────────────────────────────────────────────────────────────────
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null))
  let games = [], gameIdx = 0
  let score = 0, dispScore = 0, shotCount = 0
  // phases: init | aiming | firing | glowing | next
  let phase = 'init'
  let aimAngle = -Math.PI / 2, aimTarget = -Math.PI / 2, aimStart = 0
  let nextBubble = null
  let bullet = null   // { key, emoji, color, x, y, vx, vy }
  let glowCells = []  // [[r, c], …] being popped
  let glowStart = 0, nextStart = 0
  let comboTmo = null

  // ── Geometry ──────────────────────────────────────────────────────────────
  // Odd rows are offset right by R to form a hex grid
  function cellPos(r, c) {
    return {
      x: GRID_X0 + c * DIAM + (r & 1 ? R : 0),
      y: GRID_Y0 + r * ROW_H,
    }
  }

  // Six hex neighbors — offsets differ for odd vs even rows
  function hexNeighbors(r, c) {
    const odd = r & 1
    return [
      [r,     c - 1],
      [r,     c + 1],
      [r - 1, odd ? c : c - 1],
      [r - 1, odd ? c + 1 : c],
      [r + 1, odd ? c : c - 1],
      [r + 1, odd ? c + 1 : c],
    ].filter(([nr, nc]) => nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS)
  }

  // Max valid column for a row (odd rows have one fewer bubble)
  function maxCol(r) { return r & 1 ? COLS - 1 : COLS }

  // ── Match + orphan detection ───────────────────────────────────────────────
  // BFS: all cells connected to (r0,c0) that share the same bubble type
  function findGroup(r0, c0) {
    const type = grid[r0]?.[c0]?.key
    if (!type) return []
    const seen = new Set([`${r0},${c0}`])
    const q = [[r0, c0]]
    while (q.length) {
      const [r, c] = q.shift()
      for (const [nr, nc] of hexNeighbors(r, c)) {
        const k = `${nr},${nc}`
        if (!seen.has(k) && grid[nr]?.[nc]?.key === type) {
          seen.add(k); q.push([nr, nc])
        }
      }
    }
    return [...seen].map(s => s.split(',').map(Number))
  }

  // Remove bubbles not reachable from the ceiling row → physics-correct drops
  function dropOrphans() {
    const reachable = new Set()
    const q = []
    for (let c = 0; c < COLS; c++) {
      if (grid[0][c]) { reachable.add(`0,${c}`); q.push([0, c]) }
    }
    while (q.length) {
      const [r, c] = q.shift()
      for (const [nr, nc] of hexNeighbors(r, c)) {
        const k = `${nr},${nc}`
        if (!reachable.has(k) && grid[nr]?.[nc]) { reachable.add(k); q.push([nr, nc]) }
      }
    }
    let n = 0
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < maxCol(r); c++)
        if (grid[r][c] && !reachable.has(`${r},${c}`)) { grid[r][c] = null; n++ }
    return n
  }

  // ── Grid initialisation ───────────────────────────────────────────────────
  // Fill top rows with bubbles matching the game's present data fields.
  // Games with more fields get a denser, taller starting grid.
  function initGrid(game) {
    for (let r = 0; r < ROWS; r++) grid[r].fill(null)
    const present = ATOMS.filter(a => CHECKS[a.key](game))
    if (!present.length) return
    const fillRows = Math.max(2, Math.min(present.length, 5))
    for (let r = 0; r < fillRows; r++) {
      for (let c = 0; c < maxCol(r); c++) {
        if (Math.random() < 0.78) {
          const a = present[Math.floor(Math.random() * present.length)]
          grid[r][c] = { key: a.key, emoji: a.emoji, color: a.color }
        }
      }
    }
  }

  // ── Shooter logic ──────────────────────────────────────────────────────────
  // Prefer a bubble type that already exists in the grid — enables matches
  function pickBubble(game) {
    const present = ATOMS.filter(a => CHECKS[a.key](game))
    const inGrid  = new Set()
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < maxCol(r); c++)
        if (grid[r][c]) inGrid.add(grid[r][c].key)
    const matchable = present.filter(a => inGrid.has(a.key))
    const pool = matchable.length ? matchable : present
    return pool[Math.floor(Math.random() * pool.length)]
  }

  // Auto-aim: find the empty cell where landing would produce the most matches
  function pickAngle() {
    if (!nextBubble) return -Math.PI / 2
    const key = nextBubble.key
    let best = null, bestScore = -1
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < maxCol(r); c++) {
        if (grid[r][c]) continue
        const nbrs = hexNeighbors(r, c)
        if (r > 0 && !nbrs.some(([nr, nc]) => grid[nr]?.[nc])) continue
        const same = nbrs.filter(([nr, nc]) => grid[nr]?.[nc]?.key === key).length
        if (same > bestScore) { bestScore = same; best = { r, c } }
      }
    }
    if (best) {
      const { x, y } = cellPos(best.r, best.c)
      const raw = Math.atan2(y - SHOOT_Y, x - SHOOT_X)
      return Math.max(-Math.PI + 0.12, Math.min(-0.12, raw))
    }
    return -Math.PI / 2 + (Math.random() - 0.5) * 1.4
  }

  function fire() {
    bullet = {
      key: nextBubble.key, emoji: nextBubble.emoji, color: nextBubble.color,
      x: SHOOT_X, y: SHOOT_Y - R - 2,
      vx: Math.cos(aimAngle) * BSPEED,
      vy: Math.sin(aimAngle) * BSPEED,
    }
    nextBubble = null
    phase = 'firing'
  }

  function tickBullet() {
    bullet.x += bullet.vx
    bullet.y += bullet.vy
    // Wall bounces
    if (bullet.x - R < 0)  { bullet.x = R;     bullet.vx =  Math.abs(bullet.vx) }
    if (bullet.x + R > W)  { bullet.x = W - R; bullet.vx = -Math.abs(bullet.vx) }
    // Ceiling
    if (bullet.y - R <= GRID_Y0 - ROW_H * 0.5) { snapBullet(); return }
    // Collision with grid
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < maxCol(r); c++) {
        if (!grid[r][c]) continue
        const p = cellPos(r, c)
        const dx = bullet.x - p.x, dy = bullet.y - p.y
        if (dx * dx + dy * dy < (DIAM * 0.88) ** 2) { snapBullet(); return }
      }
    }
  }

  // Place bullet in the nearest valid empty cell and check for matches
  function snapBullet() {
    let best = null, bestD = Infinity
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < maxCol(r); c++) {
        if (grid[r][c]) continue
        const nbrs = hexNeighbors(r, c)
        if (r > 0 && !nbrs.some(([nr, nc]) => grid[nr]?.[nc])) continue
        const { x, y } = cellPos(r, c)
        const d = (bullet.x - x) ** 2 + (bullet.y - y) ** 2
        if (d < bestD) { bestD = d; best = { r, c } }
      }
    }
    if (!best) { bullet = null; prepareNext(); return }

    grid[best.r][best.c] = { key: bullet.key, emoji: bullet.emoji, color: bullet.color }
    bullet = null

    const group = findGroup(best.r, best.c)
    if (group.length >= 3) {
      glowCells = group
      score += group.length * 60
      showCombo(group.length)
      glowStart = performance.now()
      phase = 'glowing'
    } else {
      prepareNext()
    }
  }

  function applyGlow() {
    glowCells.forEach(([r, c]) => { grid[r][c] = null })
    score += dropOrphans() * 30
    glowCells = []
    prepareNext()
  }

  function prepareNext() {
    shotCount++
    const empty = !grid.some(row => row.some(c => c !== null))
    if (empty || shotCount >= MAX_SHOTS) {
      nextStart = performance.now()
      phase = 'next'
      return
    }
    nextBubble = pickBubble(games[gameIdx])
    aimTarget  = pickAngle()
    aimStart   = performance.now()
    phase = 'aiming'
  }

  // ── Game / UI helpers ─────────────────────────────────────────────────────
  function set(el, v) { if (el) el.textContent = v }

  function showCombo(n) {
    if (!elCombo) return
    const txt = n >= ATOMS.length ? '🔥 FULL DATA!' : n >= 5 ? `⚡ COMBO ×${n}` : `✓ ${n} MATCH`
    set(elCombo, txt)
    elCombo.classList.add('is-active')
    clearTimeout(comboTmo)
    comboTmo = setTimeout(() => elCombo?.classList.remove('is-active'), 1400)
  }

  function qualityLabel(n) {
    if (n >= ATOMS.length) return 'COMPLET ★★★'
    if (n >= 5)            return 'RICHE ★★'
    if (n >= 3)            return 'PARTIEL ★'
    return 'SPARSE ○'
  }

  function updateLegend(game) {
    if (!elLegend) return
    while (elLegend.firstChild) elLegend.removeChild(elLegend.firstChild)
    ATOMS.forEach(a => {
      const span = document.createElement('span')
      span.className   = 'hub-ingest-atom' + (CHECKS[a.key](game) ? ' has' : '')
      span.title       = a.label
      span.textContent = a.emoji
      elLegend.appendChild(span)
    })
  }

  function startGame(game) {
    set(elTitle, game.title || '—')
    set(elMeta, [game.platform, game.year].filter(Boolean).join(' · ') || '—')
    const present = ATOMS.filter(a => CHECKS[a.key](game))
    set(elQuality, qualityLabel(present.length))
    updateLegend(game)
    initGrid(game)
    shotCount  = 0
    nextBubble = pickBubble(game)
    aimTarget  = pickAngle()
    // Start slightly off-angle so the sweep is visible
    aimAngle   = aimTarget + (Math.random() - 0.5) * 1.0
    aimStart   = performance.now()
    phase      = 'aiming'
  }

  // ── Drawing ───────────────────────────────────────────────────────────────
  function drawBg() {
    // Deep navy base — classic 16-bit dark screen
    ctx.fillStyle = '#0b0b1e'
    ctx.fillRect(0, 0, W, H)
    // Scanlines: every other pixel row tinted darker
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    for (let y = 1; y < H; y += 2) ctx.fillRect(0, y, W, 1)
    // Bottom info bar
    ctx.fillStyle = '#111128'
    ctx.fillRect(0, H - 14, W, 14)
    ctx.fillStyle = '#222244'
    ctx.fillRect(0, H - 15, W, 1)
  }

  // Pixel-art bubble: drop shadow + flat fill + 1px border + 3px highlight square
  function drawBubble(cx, cy, atom, alpha) {
    ctx.globalAlpha = alpha ?? 1

    // Drop shadow (1px offset — classic 16-bit sprite trick)
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.beginPath()
    ctx.arc(cx + 1, cy + 1, R - 1, 0, Math.PI * 2)
    ctx.fill()

    // Main fill (white flash when glowing)
    ctx.fillStyle = atom.glowing ? '#ffffff' : atom.color
    ctx.beginPath()
    ctx.arc(cx, cy, R - 1, 0, Math.PI * 2)
    ctx.fill()

    // Hard black border
    ctx.strokeStyle = '#000'
    ctx.lineWidth   = 1
    ctx.stroke()

    // 16-bit style highlight: a small bright square at top-left
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fillRect(cx - R + 3, cy - R + 3, 3, 2)
    ctx.fillRect(cx - R + 3, cy - R + 5, 1, 1)

    // Emoji centred inside bubble
    ctx.font          = (R + 2) + 'px serif'
    ctx.textAlign     = 'center'
    ctx.textBaseline  = 'middle'
    ctx.fillText(atom.emoji, cx, cy + 1)

    ctx.globalAlpha = 1
  }

  // Dotted trajectory line including wall-bounce simulation
  function drawGuide() {
    let x = SHOOT_X, y = SHOOT_Y - R
    let vx = Math.cos(aimAngle), vy = Math.sin(aimAngle)
    ctx.strokeStyle = 'rgba(255,255,255,0.11)'
    ctx.lineWidth   = 0.5
    ctx.setLineDash([1, 4])
    ctx.beginPath()
    ctx.moveTo(x, y)
    for (let i = 0; i < 300; i++) {
      x += vx; y += vy
      if (x < R)     { x = R;     vx =  Math.abs(vx) }
      if (x > W - R) { x = W - R; vx = -Math.abs(vx) }
      if (y < GRID_Y0) break
      ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Pixel-art cannon with rotating barrel
  function drawShooter() {
    ctx.fillStyle = '#1a1a33'
    ctx.fillRect(SHOOT_X - 7, SHOOT_Y,     14, 8)
    ctx.fillStyle = '#2a2a44'
    ctx.fillRect(SHOOT_X - 5, SHOOT_Y + 1, 10, 6)
    ctx.fillStyle = '#3a3a55'
    ctx.fillRect(SHOOT_X - 3, SHOOT_Y + 2,  6, 4)

    // Barrel points toward aim angle
    ctx.strokeStyle = '#4a4a66'
    ctx.lineWidth   = 3
    ctx.lineCap     = 'square'
    ctx.beginPath()
    ctx.moveTo(SHOOT_X, SHOOT_Y)
    ctx.lineTo(SHOOT_X + Math.cos(aimAngle) * 13, SHOOT_Y + Math.sin(aimAngle) * 13)
    ctx.stroke()
    ctx.lineCap = 'butt'

    // Next bubble hovers above the cannon
    if (nextBubble) drawBubble(SHOOT_X, SHOOT_Y - 15, nextBubble)
  }

  // Score display in the bottom info bar
  function drawInfoBar() {
    ctx.fillStyle    = '#9bbc0f'
    ctx.font         = '5px monospace'
    ctx.textAlign    = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('PTS', 4, H - 7)
    ctx.textAlign = 'right'
    ctx.fillText(String(Math.floor(dispScore)).padStart(6, '0'), W - 4, H - 7)
  }

  // ── Main loop ──────────────────────────────────────────────────────────────
  function loop(now) {
    drawBg()

    // Draw grid — glowing cells flash white
    const glowSet = new Set(glowCells.map(([r, c]) => `${r},${c}`))
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < maxCol(r); c++) {
        if (!grid[r][c]) continue
        const { x, y } = cellPos(r, c)
        if (glowSet.has(`${r},${c}`)) {
          const t   = (now - glowStart) / GLOW_MS
          const alp = 0.55 + 0.45 * Math.sin(t * Math.PI * 5)
          drawBubble(x, y, { ...grid[r][c], glowing: true }, alp)
        } else {
          drawBubble(x, y, grid[r][c])
        }
      }
    }

    if (bullet) drawBubble(bullet.x, bullet.y, bullet, 0.9)

    if (phase === 'aiming' || phase === 'firing') drawGuide()
    drawShooter()
    drawInfoBar()

    // ── Phase transitions ────────────────────────────────────────────────
    if (phase === 'aiming') {
      // Ease angle toward target; fire when close enough or time expired
      aimAngle += (aimTarget - aimAngle) * 0.07
      if ((now - aimStart) >= AIM_MS || Math.abs(aimAngle - aimTarget) < 0.015) {
        aimAngle = aimTarget
        fire()
      }
    }

    if (phase === 'firing')  tickBullet()

    if (phase === 'glowing' && now - glowStart > GLOW_MS) applyGlow()

    if (phase === 'next' && now - nextStart > NEXT_MS) {
      gameIdx = (gameIdx + 1) % games.length
      startGame(games[gameIdx])
    }

    if (dispScore < score) {
      dispScore = Math.min(score, dispScore + Math.max(1, Math.ceil((score - dispScore) * 0.12)))
      set(elScore, dispScore.toLocaleString())
    }

    requestAnimationFrame(loop)
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    try {
      const res = await fetch('/api/items?limit=80&sort=metascore_desc')
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      games = (data.items || []).sort(() => Math.random() - 0.5)
      if (!games.length) { set(elTitle, 'Aucune donnée'); return }
      startGame(games[0])
      requestAnimationFrame(loop)
    } catch {
      set(elTitle, 'Flux indisponible')
    }
  }

  init()
})()
