'use strict'

;(() => {
  const { byId, setHtml, setText } = window.RetroDexDom || {}
  const { escapeHtml, formatCurrency } = window.RetroDexFormat || {}
  const { fetchJson, getItems } = window.RetroDexApi || {}
  const HUB_IMAGE_VERSION = '20260323b'
  let hubImageManifestPromise = null

  if (!byId || !setHtml || !setText || !escapeHtml || !formatCurrency || !fetchJson || !getItems) {
    console.warn('[RetroDex] Hub bootstrap skipped: core helpers missing')
    return
  }

  function loadHubImageManifest() {
    if (!hubImageManifestPromise) {
      hubImageManifestPromise = fetch(`/assets/hub_pixel_art/_manifest.json?v=${HUB_IMAGE_VERSION}`, { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : []))
        .catch(() => [])
    }

    return hubImageManifestPromise
  }

  async function getHubImagePath(gameId) {
    if (!gameId) return ''

    const manifest = await loadHubImageManifest()
    if (!Array.isArray(manifest)) return ''

    const entry = manifest.find((item) => item && item.game_id === gameId)
    return entry?.file ? `/assets/hub_pixel_art/${entry.file}?v=${HUB_IMAGE_VERSION}` : ''
  }

  function hubStateMarkup(title, copy) {
    return `
      <div class="terminal-empty-state hub-empty-state">
        <div class="terminal-empty-title">${escapeHtml(title)}</div>
        ${copy ? `<div class="terminal-empty-copy">${escapeHtml(copy)}</div>` : ''}
      </div>
    `
  }

  function renderCardThumb(canvas, game) {
    const width = 120
    const height = 68
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = width
    canvas.height = height

    let seed = 0
    const source = game.id || game.title || ''
    for (let index = 0; index < source.length; index += 1) {
      seed = (seed * 31 + source.charCodeAt(index)) | 0
    }
    seed = Math.abs(seed)

    const palettes = {
      PlayStation: ['#050520', '#0f0f45', '#1a1a8b', '#4444dd'],
      'Super Nintendo': ['#0d0d0d', '#1a3a1a', '#2d6a2d', '#7abf7a'],
      'Sega Genesis': ['#101006', '#3a320a', '#72610f', '#d4b54d'],
      'Sega Saturn': ['#0b120b', '#163316', '#245824', '#5db35d'],
      'Nintendo 64': ['#08120b', '#12321a', '#1d6a32', '#57b26f'],
      'Game Boy': ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
      'Game Boy Advance': ['#05101a', '#0f2535', '#1a558b', '#55aae8'],
      'Nintendo DS': ['#05101a', '#17343a', '#2d666d', '#67bec7'],
      Dreamcast: ['#1a1205', '#3f220c', '#8c4a18', '#e59b45'],
      'Nintendo Entertainment System': ['#0f1410', '#263329', '#4a6b52', '#9dc2a5'],
    }
    const palette = palettes[game.console || game.platform] || ['#0f380f', '#306230', '#8bac0f', '#9bbc0f']
    const style = seed % 4

    ctx.fillStyle = palette[0]
    ctx.fillRect(0, 0, width, height)

    if (style === 0) {
      ctx.fillStyle = palette[1]
      ctx.fillRect(8, 8, width - 16, height - 24)
      ctx.fillStyle = palette[2]
      for (let index = 0; index < 3; index += 1) {
        ctx.fillRect(16, 14 + index * 8, width - 32, 4)
      }
    } else if (style === 1) {
      for (let y = 0; y < height; y += 4) {
        ctx.fillStyle = palette[1]
        ctx.globalAlpha = 0.4
        ctx.fillRect(0, y, width, 2)
      }
      ctx.globalAlpha = 1
      ctx.fillStyle = palette[2]
      ctx.beginPath()
      ctx.arc(width / 2, height / 2 - 8, 20, 0, Math.PI * 2)
      ctx.fill()
    } else if (style === 2) {
      ctx.fillStyle = palette[1]
      ctx.fillRect(0, 0, width, height * 0.4)
      ctx.fillStyle = palette[3]
      ctx.fillRect(width - 14, 4, 10, 10)
      for (let index = 0; index < 5; index += 1) {
        const barX = (seed * 7 + index * 23) % (width - 20) + 4
        const barHeight = (seed * 3 + index * 17) % 16 + 6
        ctx.fillStyle = palette[2]
        ctx.fillRect(barX, height * 0.4 - barHeight, 12, barHeight)
      }
    } else {
      ctx.fillStyle = palette[1]
      ctx.fillRect(width * 0.15, height * 0.1, width * 0.7, height * 0.7)
      ctx.fillStyle = palette[0]
      ctx.fillRect(width * 0.15 + 2, height * 0.1 + 2, width * 0.7 - 4, height * 0.7 - 4)
      ctx.fillStyle = palette[3]
      ctx.fillRect(width * 0.35, height * 0.25, width * 0.3, 6)
      ctx.fillRect(width * 0.35, height * 0.45, width * 0.3, 6)
    }

    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, height - 14, width, 14)
    ctx.fillStyle = palette[3]
    ctx.font = '7px monospace'
    ctx.fillText((game.title || '').substring(0, 18), 3, height - 4)
  }

  async function loadLegendary() {
    const grid = byId('legendary-grid')
    if (grid) {
      setHtml(grid, hubStateMarkup('Chargement', 'Lecture de la vitrine LEGENDARY.'))
    }

    try {
      const payload = await fetchJson('/api/items?rarity=LEGENDARY&limit=6')
      const items = getItems(payload)
        .sort((left, right) => (Number(right.mintPrice) || 0) - (Number(left.mintPrice) || 0))
        .slice(0, 6)
      if (!grid) return

      setHtml(grid, '')
      if (!items.length) {
        setHtml(grid, hubStateMarkup('Aucune entree visible', 'La vitrine LEGENDARY est vide pour cette selection.'))
        return
      }

      for (const game of items) {
        const card = document.createElement('div')
        card.className = 'legendary-card'
        card.addEventListener('click', () => {
          window.location.href = `/game-detail.html?id=${encodeURIComponent(game.id)}`
        })

        const media = document.createElement('div')
        media.className = 'legendary-card-media'

        const imagePath = await getHubImagePath(game.id)
        if (imagePath) {
          const img = document.createElement('img')
          img.src = imagePath
          img.alt = game.title || 'Illustration'
          img.loading = 'lazy'
          media.appendChild(img)
        } else {
          const canvas = document.createElement('canvas')
          renderCardThumb(canvas, game)
          media.appendChild(canvas)
        }

        const info = document.createElement('div')
        info.className = 'legendary-card-info'
        info.innerHTML = `
          <div class="legendary-card-title">${escapeHtml(game.title || 'Sans titre')}</div>
          <div class="legendary-card-meta">${escapeHtml(game.console || game.platform || 'Console inconnue')} - ${escapeHtml(game.year || '-')}</div>
          <div class="legendary-card-price">${Number.isFinite(Number(game.mintPrice)) ? `Mint ${formatCurrency(game.mintPrice)}` : 'Mint -'}</div>
        `

        card.appendChild(media)
        card.appendChild(info)
        grid.appendChild(card)
      }
    } catch (_) {
      if (grid) {
        setHtml(grid, hubStateMarkup('Lecture indisponible', 'Impossible de charger la vitrine LEGENDARY.'))
      }
    }
  }

  async function loadEncyclopediaPreview() {
    const grid = byId('hub-encyclo-preview')
    if (grid) {
      setHtml(grid, hubStateMarkup('Chargement', 'Lecture des dossiers RetroDex en cours.'))
    }

    try {
      const payload = await fetchJson('/api/games?limit=1000&type=game')
      let items = getItems(payload).filter((game) =>
        game.synopsis || game.dev_team || game.dev_anecdotes || game.cheat_codes
      )

      if (items.length < 6) {
        const response = await fetch('/games?type=game')
        if (response.ok) {
          const fallback = await response.json()
          items = getItems(fallback).filter((game) =>
            game.synopsis || game.dev_team || game.dev_anecdotes || game.cheat_codes
          )
        }
      }

      if (!grid) return

      setHtml(grid, '')
      if (!items.length) {
        setHtml(grid, hubStateMarkup('Aucun dossier visible', 'Aucune entree enrichie n est disponible pour cet apercu.'))
        return
      }

      for (const game of items.slice(0, 6)) {
        const card = document.createElement('div')
        card.className = 'hub-encyclo-card'
        card.addEventListener('click', () => {
          window.location.href = `/encyclopedia.html?game=${encodeURIComponent(game.id)}`
        })

        const imagePath = await getHubImagePath(game.id)
        card.innerHTML = `
          ${imagePath ? `<div class="hub-encyclo-card-media"><img src="${escapeHtml(imagePath)}" alt="${escapeHtml(game.title || 'Illustration')}" loading="lazy"></div>` : ''}
          <div class="hub-encyclo-card-title">${escapeHtml(game.title || 'Sans titre')}</div>
          <div class="hub-encyclo-card-meta">${escapeHtml(game.console || '')} - ${escapeHtml(game.year || '')}</div>
        `
        grid.appendChild(card)
      }
    } catch (_) {
      if (grid) {
        setHtml(grid, hubStateMarkup('Archive indisponible', 'Impossible de charger l apercu encyclopedique.'))
      }
    }
  }

  function setUniverseSignals({ stats, collectionItems, health, totalGames }) {
    const avgLoose = Number(stats?.price_stats?.avg_loose || 0)
    const collectionLoose = collectionItems.reduce((sum, item) => {
      const loose = Number(item.game?.loosePrice || item.Game?.loosePrice || item.loosePrice || 0)
      return sum + (Number.isFinite(loose) ? loose : 0)
    }, 0)

    setText(
      byId('universe-market-signal'),
      `${stats?.trust_stats?.t1 || 0} T1 | ${formatCurrency(avgLoose || 0)} avg loose`
    )
    setText(
      byId('universe-dex-signal'),
      `${stats?.encyclopedia_stats?.with_synopsis || 0} synopsis | ${stats?.encyclopedia_stats?.total_franchises || 0} franchises`
    )
    setText(
      byId('universe-collection-signal'),
      `${collectionItems.length} entrees | ${collectionItems.length ? formatCurrency(collectionLoose) : '$0'} loose`
    )
    setText(
      byId('universe-search-signal'),
      `${totalGames || health?.games || 0} jeux | ${stats?.total_platforms || 0} plateformes`
    )
  }

  async function loadTopStats() {
    let totalGames = null
    let statsPayload = null
    let healthPayload = null
    let collectionItems = []
    const collectionContainer = byId('coll-items')

    if (collectionContainer) {
      setHtml(collectionContainer, hubStateMarkup('Chargement', 'Lecture de l etagere personnelle.'))
    }

    try {
      const gamesPayload = await fetchJson('/api/games?limit=1&type=game')
      totalGames = gamesPayload.total || null
      setText(byId('stat-games'), gamesPayload.total || '-')
      if (gamesPayload.total) {
        setText(byId('hub-tagline'), `${gamesPayload.total} jeux - prix de marche - encyclopedie - 15 franchises`)
      }
    } catch (_) {}

    try {
      const stats = await fetchJson('/api/stats')
      statsPayload = stats
      setText(byId('stat-consoles'), stats.total_platforms || '-')
      setText(
        byId('stat-meta'),
        Number.isFinite(Number(stats.price_stats?.avg_loose))
          ? formatCurrency(stats.price_stats.avg_loose)
          : '-'
      )
    } catch (_) {}

    try {
      const health = await fetchJson('/api/health')
      healthPayload = health
      setText(byId('footer-status'), health.ok ? 'Backend OK' : 'Backend offline')
      setText(
        byId('footer-db'),
        `${String(health.database || 'sqlite').toUpperCase()} - ${totalGames || health.games || 0} jeux`
      )
      setText(
        byId('hub-runtime-line'),
        health.ok
          ? `${String(health.database || 'sqlite').toUpperCase()} / ${health.status || 'running'} / ${totalGames || health.games || '-'} jeux`
          : 'OFFLINE'
      )
    } catch (_) {
      setText(byId('footer-status'), 'Backend offline')
      setText(byId('footer-db'), '')
      setText(byId('hub-runtime-line'), 'OFFLINE')
    }

    try {
      const collection = await fetchJson('/api/collection')
      collectionItems = getItems(collection)
      setText(byId('stat-collection'), collectionItems.length)

      if (!collectionContainer) return

      if (!collectionItems.length) {
        setHtml(collectionContainer, hubStateMarkup('Aucune entree suivie', 'Ouvrir Recherche pour alimenter l etagere.'))
      } else {
        setHtml(
          collectionContainer,
          collectionItems
            .map((item) => {
              const gameId = item.game?.id || item.Game?.id || item.gameId || item.id
              const title = item.game?.title || item.Game?.title || item.title || item.gameId || 'Jeu'
              return `<a href="/game-detail.html?id=${encodeURIComponent(gameId)}" class="coll-pill">${escapeHtml(title)}</a>`
            })
            .join('')
        )
      }
    } catch (_) {
      setText(byId('stat-collection'), '-')
      if (collectionContainer) {
        setHtml(collectionContainer, hubStateMarkup('Collection indisponible', 'Impossible de lire l etagere pour le moment.'))
      }
    }

    setUniverseSignals({
      stats: statsPayload,
      collectionItems,
      health: healthPayload,
      totalGames,
    })
  }

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
      }
    })
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js')
      .catch((error) => console.warn('[RetroDex] SW registration failed:', error))
  }

  function init() {
    bindKeyboardShortcut()
    registerServiceWorker()
    loadTopStats()
    loadLegendary()
    loadEncyclopediaPreview()
  }

  init()
})()
