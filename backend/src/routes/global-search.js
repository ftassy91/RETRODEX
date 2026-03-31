'use strict'
// DATA: legacy mixed search path - not mounted by default in the canonical Supabase runtime

const { Router } = require('express')
const { Op, fn, col, where: sqlWhere } = require('sequelize')

const Franchise = require('../models/Franchise')
const { handleAsync, parseLimit } = require('../helpers/query')
const { listHydratedGames } = require('../services/game-read-service')
const { listConsoleItems } = require('../services/console-service')

const router = Router()

const CTX = {
  all: 'TOUS',
  retrodex: 'RETRODEX',
  retromarket: 'RETROMARKET',
  collection: 'COLLECTION',
  neoretro: 'NEORETRO',
}

function normalizeQuery(value) {
  return String(value || '').trim().toLowerCase()
}

function tokenize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function buildLike(field, query) {
  return sqlWhere(fn('LOWER', col(field)), {
    [Op.like]: `%${normalizeQuery(query)}%`,
  })
}

function scoreResult(item, query) {
  const tokens = tokenize(query)
  if (!tokens.length) {
    return 50
  }

  const titleTokens = tokenize(item.title)
  const haystack = [
    ...titleTokens,
    ...tokenize(item.subtitle),
    ...tokenize(item.meta?.console),
    ...tokenize(item.meta?.genre),
    ...tokenize(item.meta?.developer),
    ...tokenize(item.meta?.manufacturer),
  ]

  let total = 0

  for (const token of tokens) {
    if (titleTokens.some((value) => value === token)) {
      total += 40
      continue
    }
    if (titleTokens.some((value) => value.startsWith(token))) {
      total += 25
      continue
    }
    if (titleTokens.some((value) => value.includes(token))) {
      total += 15
      continue
    }
    if (haystack.some((value) => value.includes(token))) {
      total += 8
    }
  }

  total += ({ LEGENDARY: 6, EPIC: 4, RARE: 2, UNCOMMON: 1, COMMON: 0 }[item.meta?.rarity] || 0)
  if (item.meta?.synopsis || item.meta?.summary) total += 3
  if (item.meta?.metascore) total += 2
  if (Number(item.meta?.qualityScore) > 0) total += Math.round(Number(item.meta.qualityScore) / 20)
  if (item.meta?.qualityTier === 'Tier A') total += 4
  if (item.meta?.qualityTier === 'Tier B') total += 2
  if (item.type !== 'game' && total < 20) total -= 5

  return Math.max(0, Math.min(100, total))
}

function compareResults(left, right) {
  return right.score - left.score
    || String(left.title || '').localeCompare(String(right.title || ''), 'fr', { sensitivity: 'base' })
}

function createGameResult(game, context, quality = null) {
  const marketHref = `/stats.html?q=${encodeURIComponent(game.title)}`
  const detailHref = `/game-detail.html?id=${encodeURIComponent(game.id)}`

  return {
    id: game.id,
    type: 'game',
    title: game.title || '',
    subtitle: [game.console, game.year].filter(Boolean).join(' · '),
    href: context === 'retromarket' ? marketHref : detailHref,
    marketHref,
    detailHref,
    product: context === 'retromarket' ? 'retromarket' : 'retrodex',
    meta: {
      console: game.console || null,
      year: game.year ?? null,
      genre: game.genre || null,
      developer: game.developer || null,
      metascore: game.metascore ?? null,
      rarity: game.rarity || null,
      summary: game.summary || null,
      synopsis: game.synopsis || null,
      coverImage: game.coverImage || game.cover_url || null,
      loosePrice: game.loosePrice ?? game.loose_price ?? null,
      cibPrice: game.cibPrice ?? game.cib_price ?? null,
      mintPrice: game.mintPrice ?? game.mint_price ?? null,
      qualityScore: Number(quality?.overallScore || 0) || null,
      qualityTier: quality?.tier || null,
    },
  }
}

function createConsoleResult(consoleItem, count, quality = null) {
  return {
    id: `console-${consoleItem.id}`,
    type: 'console',
    title: consoleItem.name || '',
    subtitle: [consoleItem.manufacturer, consoleItem.releaseYear, count ? `${count} jeux` : null]
      .filter(Boolean)
      .join(' · '),
    href: `/console-detail.html?id=${encodeURIComponent(consoleItem.id)}`,
    marketHref: `/stats.html?q=${encodeURIComponent(consoleItem.name || '')}`,
    product: 'retrodex',
    meta: {
      manufacturer: consoleItem.manufacturer || null,
      year: consoleItem.releaseYear ?? null,
      gamesCount: count || 0,
      qualityScore: Number(quality?.overallScore || 0) || null,
      qualityTier: quality?.tier || null,
    },
  }
}

function createFranchiseResult(franchise) {
  return {
    id: `franchise-${franchise.slug || franchise.id}`,
    type: 'franchise',
    title: franchise.name || '',
    subtitle: [franchise.developer, franchise.first_game, franchise.last_game ? `→ ${franchise.last_game}` : null]
      .filter(Boolean)
      .join(' · '),
    href: `/franchises.html?slug=${encodeURIComponent(franchise.slug || franchise.id || '')}`,
    product: 'retrodex',
    meta: {
      developer: franchise.developer || null,
      summary: franchise.description || null,
    },
  }
}

async function fetchGameResults(query, context, limit) {
  if (!query) {
    return []
  }

  const payload = await listHydratedGames({
    search: query,
    limit: Math.max(limit * 3, 20),
    offset: 0,
    publishedOnly: true,
  })

  return (payload.items || []).map((game) => createGameResult(game, context, game.quality || null))
}

async function fetchConsoleResults(query, limit) {
  if (!query) {
    return []
  }

  const normalizedQuery = tokenize(query).join(' ')
  const items = await listConsoleItems({ publishedOnly: true })

  return items
    .filter((consoleItem) => {
      const haystack = tokenize([
        consoleItem.name,
        consoleItem.manufacturer,
        consoleItem.generation,
        consoleItem.summary,
        consoleItem.slug,
      ].filter(Boolean).join(' ')).join(' ')

      return haystack.includes(normalizedQuery)
    })
    .slice(0, Math.max(limit, 10))
    .map((consoleItem) => createConsoleResult(
      consoleItem,
      consoleItem.gamesCount || 0,
      consoleItem.quality ? {
        overallScore: consoleItem.quality.score,
        tier: consoleItem.quality.tier,
      } : null
    ))
}

async function fetchFranchiseResults(query, limit) {
  if (!query) {
    return []
  }

  const rows = await Franchise.findAll({
    attributes: ['id', 'name', 'slug', 'description', 'first_game', 'last_game', 'developer'],
    where: {
      [Op.or]: [
        buildLike('name', query),
        buildLike('developer', query),
        buildLike('description', query),
      ],
    },
    limit: Math.max(limit, 10),
  })

  return rows.map((franchise) => createFranchiseResult(franchise.get({ plain: true })))
}

router.get('/api/search/global', handleAsync(async (req, res) => {
  const q = String(req.query.q || '').trim()
  const context = String(req.query.context || 'all').trim().toLowerCase()
  const limit = parseLimit(req.query.limit, 20, 60)

  if (q.length < 2) {
    return res.json({
      ok: true,
      query: q,
      context,
      label: CTX[context] || CTX.all,
      items: [],
      count: 0,
    })
  }

  const [games, consoles, franchises] = await Promise.all([
    fetchGameResults(q, context, limit),
    fetchConsoleResults(q, limit),
    fetchFranchiseResults(q, limit),
  ])

  let items = [...games, ...consoles, ...franchises]

  if (context === 'retromarket') {
    items = items.filter((item) => item.type === 'game')
  } else if (context === 'collection') {
    items = items.filter((item) => item.type === 'game')
  }

  items = items
    .map((item) => ({ ...item, score: scoreResult(item, q) }))
    .sort(compareResults)
    .slice(0, limit)

  res.json({
    ok: true,
    query: q,
    context,
    label: CTX[context] || CTX.all,
    items,
    count: items.length,
  })
}))

module.exports = router
