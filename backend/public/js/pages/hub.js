'use strict'

;(() => {
  const { byId, setHtml, setText } = window.RetroDexDom || {}
  const { escapeHtml, formatCurrency } = window.RetroDexFormat || {}
  const { fetchJson, getItems } = window.RetroDexApi || {}

  if (!byId || !setHtml || !setText || !escapeHtml || !formatCurrency || !fetchJson || !getItems) {
    console.warn('[RetroDex] Hub bootstrap skipped: core helpers missing')
    return
  }

  /* ── Helpers ────────────────────────────────── */

  function vizBar(label, value, pct, opts) {
    const color = opts?.color || 'var(--accent)'
    const suffix = opts?.suffix || ''
    const link = opts?.link || ''
    const labelHtml = link
      ? `<a href="${escapeHtml(link)}" class="viz-bar-label viz-bar-label--link">${escapeHtml(label)}</a>`
      : `<span class="viz-bar-label">${escapeHtml(label)}</span>`
    return `
      <div class="viz-bar">
        ${labelHtml}
        <div class="viz-bar-track">
          <div class="viz-bar-fill" style="width:${Math.min(pct, 100)}%;background:${color}"></div>
        </div>
        <span class="viz-bar-value">${escapeHtml(String(value))}${suffix ? escapeHtml(suffix) : ''}</span>
      </div>
    `
  }

  function vizRankRow(rank, label, value, opts) {
    const link = opts?.link || ''
    const labelHtml = link
      ? `<a href="${escapeHtml(link)}" class="viz-rank-title viz-rank-title--link">${escapeHtml(label)}</a>`
      : `<span class="viz-rank-title">${escapeHtml(label)}</span>`
    return `
      <div class="viz-rank-row">
        <span class="viz-rank-pos">${escapeHtml(String(rank))}</span>
        ${labelHtml}
        <span class="viz-rank-value">${escapeHtml(String(value))}</span>
      </div>
    `
  }

  function shortPlatform(name) {
    const map = {
      'Nintendo Entertainment System': 'NES',
      'Super Nintendo': 'SNES',
      'Nintendo 64': 'N64',
      'Game Boy': 'GB',
      'Game Boy Color': 'GBC',
      'Game Boy Advance': 'GBA',
      'Nintendo DS': 'NDS',
      'Sega Genesis': 'Genesis',
      'Sega Saturn': 'Saturn',
      'Sega Master System': 'SMS',
      'PlayStation': 'PS1',
      'PlayStation 2': 'PS2',
      'PlayStation 3': 'PS3',
      'Dreamcast': 'DC',
      'TurboGrafx-16': 'TG-16',
      'Neo Geo': 'Neo Geo',
    }
    return map[name] || (name.length > 10 ? name.substring(0, 9) + '.' : name)
  }

  const RARITY_COLORS = {
    LEGENDARY: '#ffd700',
    EPIC: '#e48855',
    RARE: '#4ecdc4',
    UNCOMMON: '#33cc66',
    COMMON: '#6a8a6a',
  }

  /* ── Renderers ─────────────────────────────── */

  function renderByConsole(container, byPlatform) {
    if (!byPlatform || !byPlatform.length) {
      setHtml(container, '<div class="hub-viz-empty">Aucune donnée</div>')
      return
    }
    const max = byPlatform[0].count
    const html = byPlatform.slice(0, 8).map((entry) =>
      vizBar(
        shortPlatform(entry.platform),
        entry.count,
        (entry.count / max) * 100,
        { link: `/games-list.html?console=${encodeURIComponent(entry.platform)}` }
      )
    ).join('')
    setHtml(container, html)
  }

  function renderByRarity(container, byRarity) {
    if (!byRarity) {
      setHtml(container, '<div class="hub-viz-empty">Aucune donnée</div>')
      return
    }
    const order = ['LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON']
    const total = order.reduce((sum, key) => sum + (byRarity[key] || 0), 0) || 1
    const max = Math.max(...order.map((key) => byRarity[key] || 0), 1)
    const html = order.map((key) => {
      const count = byRarity[key] || 0
      return vizBar(key, count, (count / max) * 100, {
        color: RARITY_COLORS[key] || 'var(--accent)',
        link: `/games-list.html?rarity=${key}`,
      })
    }).join('')
    setHtml(container, html)
  }

  function renderByPrice(container, games) {
    const brackets = [
      { label: '$0 - $10', min: 0, max: 10, count: 0 },
      { label: '$10 - $25', min: 10, max: 25, count: 0 },
      { label: '$25 - $50', min: 25, max: 50, count: 0 },
      { label: '$50 - $100', min: 50, max: 100, count: 0 },
      { label: '$100 - $250', min: 100, max: 250, count: 0 },
      { label: '$250+', min: 250, max: Infinity, count: 0 },
    ]
    for (const game of games) {
      const price = Number(game.loosePrice)
      if (!Number.isFinite(price) || price <= 0) continue
      for (const bracket of brackets) {
        if (price >= bracket.min && price < bracket.max) {
          bracket.count += 1
          break
        }
      }
    }
    const max = Math.max(...brackets.map((b) => b.count), 1)
    const html = brackets.map((b) =>
      vizBar(b.label, b.count, (b.count / max) * 100)
    ).join('')
    setHtml(container, html)
  }

  function renderTopExpensive(container, top5) {
    if (!top5 || !top5.length) {
      setHtml(container, '<div class="hub-viz-empty">Aucune donnée</div>')
      return
    }
    const html = top5.map((game, idx) =>
      vizRankRow(
        idx + 1,
        game.title || 'Sans titre',
        formatCurrency(game.loosePrice),
        { link: `/game-detail.html?id=${encodeURIComponent(game.id)}` }
      )
    ).join('')
    setHtml(container, html)
  }

  function renderByDecade(container, games) {
    const decades = {}
    for (const game of games) {
      const year = Number(game.year)
      if (!year || year < 1970 || year > 2030) continue
      const decade = Math.floor(year / 10) * 10
      const label = `${decade}s`
      decades[label] = (decades[label] || 0) + 1
    }
    const entries = Object.entries(decades).sort((a, b) => a[0].localeCompare(b[0]))
    if (!entries.length) {
      setHtml(container, '<div class="hub-viz-empty">Aucune donnée</div>')
      return
    }
    const max = Math.max(...entries.map(([, count]) => count), 1)
    const html = entries.map(([label, count]) =>
      vizBar(label, count, (count / max) * 100, { color: 'var(--text-secondary)' })
    ).join('')
    setHtml(container, html)
  }

  function renderByMetascore(container, games) {
    const brackets = [
      { label: '90 - 100', min: 90, max: 101, count: 0, color: '#52e052' },
      { label: '80 - 89', min: 80, max: 90, count: 0, color: '#33cc66' },
      { label: '70 - 79', min: 70, max: 80, count: 0, color: '#e0b352' },
      { label: '60 - 69', min: 60, max: 70, count: 0, color: '#e48855' },
      { label: '< 60', min: 0, max: 60, count: 0, color: '#e05252' },
    ]
    let scored = 0
    for (const game of games) {
      const score = Number(game.metascore)
      if (!Number.isFinite(score) || score <= 0) continue
      scored += 1
      for (const bracket of brackets) {
        if (score >= bracket.min && score < bracket.max) {
          bracket.count += 1
          break
        }
      }
    }
    if (!scored) {
      setHtml(container, '<div class="hub-viz-empty">Aucun metascore</div>')
      return
    }
    const max = Math.max(...brackets.map((b) => b.count), 1)
    const html = brackets.map((b) =>
      vizBar(b.label, b.count, (b.count / max) * 100, { color: b.color })
    ).join('')
    setHtml(container, html)
  }

  /* ── Data Loading ──────────────────────────── */

  async function loadHub() {
    let stats = null
    let games = []

    // Fetch stats (has by_platform, by_rarity, top5_expensive, price_stats, etc.)
    try {
      stats = await fetchJson('/api/stats')
    } catch (_) {
      console.warn('[RetroDex] Failed to fetch /api/stats')
    }

    // Populate hero stat pills
    if (stats) {
      setText(byId('hero-stat-games'), `${stats.total_games || '?'} jeux`)
      setText(byId('hero-stat-consoles'), `${stats.total_platforms || '?'} consoles`)
      setText(byId('hero-stat-franchises'), `${stats.encyclopedia_stats?.total_franchises || '?'} franchises`)
    }

    // Render stats-based panels immediately
    renderByConsole(byId('viz-by-console'), stats?.by_platform)
    renderByRarity(byId('viz-by-rarity'), stats?.by_rarity)
    renderTopExpensive(byId('viz-top-expensive'), stats?.top5_expensive)

    // Fetch full game list for client-side aggregation (price, decade, metascore)
    try {
      const payload = await fetchJson('/api/games?limit=2000&include_trend=0&type=game')
      games = getItems(payload)
    } catch (_) {
      console.warn('[RetroDex] Failed to fetch /api/games for dataviz')
    }

    // Render game-data panels
    renderByPrice(byId('viz-by-price'), games)
    renderByDecade(byId('viz-by-decade'), games)
    renderByMetascore(byId('viz-by-metascore'), games)
  }

  /* ── Retro Menu Navigation ───────────────────── */

  function initRetroMenu() {
    const menu = document.querySelector('.r?tro-menu')
    if (!menu) return

    const items = Array.from(menu.querySelectorAll('.r?tro-menu-item'))
    if (!items.length) return

    let activeIndex = 0

    function setActive(index) {
      items[activeIndex]?.classList.remove('is-active')
      activeIndex = ((index % items.length) + items.length) % items.length
      items[activeIndex].classList.add('is-active')
      items[activeIndex].focus({ preventScroll: true })
    }

    // Play a subtle "click" sound via AudioContext (8-bit style)
    function playMenuSound() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'square'
        osc.frequency.value = 880
        gain.gain.value = 0.06
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.06)
      } catch (_) {
        // AudioContext not available — silent fallback
      }
    }

    function playSelectSound() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'square'
        osc.frequency.setValueAtTime(523, ctx.currentTime)
        osc.frequency.setValueAtTime(784, ctx.currentTime + 0.06)
        osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.12)
        gain.gain.value = 0.08
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.2)
      } catch (_) {}
    }

    document.addEventListener('keydown', (event) => {
      const tagName = event.target?.tagName
      const inField = tagName === 'INPUT' || tagName === 'TEXTAREA' || event.target?.isContentEditable

      if (inField) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        playMenuSound()
        setActive(activeIndex + 1)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        playMenuSound()
        setActive(activeIndex - 1)
      } else if (event.key === 'Enter') {
        const href = items[activeIndex]?.getAttribute('href')
        if (href) {
          event.preventDefault()
          playSelectSound()
          setTimeout(() => { window.location.href = href }, 180)
        }
      }
    })

    // Hover also moves cursor
    items.forEach((item, idx) => {
      item.addEventListener('mouseenter', () => {
        if (idx !== activeIndex) {
          playMenuSound()
          setActive(idx)
        }
      })
    })
  }

  /* ── Keyboard Shortcut ─────────────────────── */

  function bindKeyboardShortcut() {
    document.addEventListener('keydown', (event) => {
      const tagName = event.target?.tagName
      const inField = tagName === 'INPUT' || tagName === 'TEXTAREA' || event.target?.isContentEditable
      const input = byId('hub-search-input')

      if (event.key === '/' && !inField && input) {
        event.preventDefault()
        input.focus()
        input.select()
      }

      if (event.key === 'Escape' && input && document.activeElement === input) {
        input.value = ''
        input.blur()
      }
    })
  }

  /* ── Service Worker ────────────────────────── */

  function registerServiceWorker() {
    // Legacy hub script kept for archive compatibility.
    // Service worker registration is intentionally disabled because
    // the canonical public surfaces now force cache cleanup instead.
  }

  /* ── Init ──────────────────────────────────── */

  function init() {
    bindKeyboardShortcut()
    initRetroMenu()
    registerServiceWorker()
    loadHub()
  }

  init()
})()
