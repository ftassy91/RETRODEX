'use strict'
// SYNC: B1 - migre le 2026-03-23 - fallback Supabase et recherche par annee alignes avec les tests
// Decision source : SYNC.md Â§ B1
// SYNC: A8 - migre le 2026-03-23 - routeur Supabase dedie au runtime Vercel
// Decision source : SYNC.md § A8

const { Router } = require('express')

const { handleAsync, parseLimit } = require('../helpers/query')
const { resolveRequestCollectionScope } = require('../middleware/auth')
const { toGameSummary } = require('../lib/normalize')
const { buildGameDetailDataLayer } = require('../helpers/game-detail-data-layer')
const {
  normalizeCollectionListType,
  parseCollectionCreatePayload,
  parseCollectionPatchPayload,
  listCollectionItems,
  createCollectionItem,
  updateCollectionItem,
  deleteCollectionItem,
  getCollectionStats,
} = require('../services/public-collection-service')
const {
  fetchGameContentProfileRow,
  fetchGameKnowledgeDomains,
  buildArchivePayload,
  buildEncyclopediaPayload,
  fetchCanonicalGamesList: readCanonicalGamesList,
  fetchCanonicalGameById: readCanonicalGameById,
} = require('../services/public-game-reader')
const {
  fetchPublishedGameScope: readPublishedGameScope,
} = require('../services/public-publication-service')
const {
  searchCatalog,
  searchGlobal,
  listFranchises,
  getFranchiseBySlug,
  listFranchiseGamesBySlug,
} = require('../services/public-search-service')
const {
  fetchGamePriceHistoryPayload,
  fetchItemsPayload,
  fetchConsolesPayload,
  fetchConsoleDetailPayload,
  fetchStatsPayload,
} = require('../services/public-runtime-payload-service')

const router = Router()
// SYNC: SC-5 - routes Search Core confirmees pour le runtime serverless
// Decision source : SYNC.md § SEARCH RULES / SERVERLESS RULES

async function runCollectionOperation(res, operation) {
  try {
    return await operation()
  } catch (error) {
    if (error?.statusCode) {
      res.status(error.statusCode).json({
        ok: false,
        error: error.message,
      })
      return null
    }

    throw error
  }
}

router.get('/games', handleAsync(async (req, res) => {
  const payload = await readCanonicalGamesList(req.query)
  return res.json(payload.items)
}))

router.get('/api/games', handleAsync(async (req, res) => {
  const payload = await readCanonicalGamesList(req.query)
  res.json(payload)
}))

router.get('/api/games/random', handleAsync(async (req, res) => {
  const payload = await readCanonicalGamesList({
    ...req.query,
    limit: 5000,
    offset: 0,
  })

  if (!payload.items.length) {
    return res.status(404).json({ ok: false, error: 'No game found for the current filter' })
  }

  const index = Math.floor(Math.random() * payload.items.length)
  return res.json(payload.items[index])
}))

router.get('/games/:id', handleAsync(async (req, res) => {
  const game = await readCanonicalGameById(req.params.id)

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  return res.json(game)
}))

router.get('/api/games/:id', handleAsync(async (req, res) => {
  const game = await readCanonicalGameById(req.params.id)

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  return res.json(game)
}))

router.get('/api/games/:id/summary', handleAsync(async (req, res) => {
  const game = await readCanonicalGameById(req.params.id)

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  return res.json({ ok: true, item: toGameSummary(game) })
}))

router.get('/api/games/:id/archive', handleAsync(async (req, res) => {
  const game = await readCanonicalGameById(req.params.id)

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  const domains = await fetchGameKnowledgeDomains(game)

  return res.json(buildArchivePayload(game, domains))
}))

router.get('/api/games/:id/detail', handleAsync(async (req, res) => {
  const game = await readCanonicalGameById(req.params.id)

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  const [domains, storedProfile] = await Promise.all([
    fetchGameKnowledgeDomains(game),
    fetchGameContentProfileRow(game.id).catch(() => null),
  ])

  const archive = buildArchivePayload(game, domains)
  const encyclopedia = buildEncyclopediaPayload(game, domains)

  return res.json(buildGameDetailDataLayer({
    game,
    archive,
    encyclopedia,
    storedProfile,
  }))
}))

router.get('/api/games/:id/encyclopedia', handleAsync(async (req, res) => {
  const game = await readCanonicalGameById(req.params.id)

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  const domains = await fetchGameKnowledgeDomains(game)

  return res.json(buildEncyclopediaPayload(game, domains))
}))

router.get('/api/games/:id/price-history', handleAsync(async (req, res) => {
  const payload = await fetchGamePriceHistoryPayload(req.params.id)
  if (!payload) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }
  return res.json(payload)
}))

router.get('/api/items', handleAsync(async (req, res) => {
  res.json(await fetchItemsPayload(req.query))
}))

router.get('/api/consoles', handleAsync(async (_req, res) => {
  res.json(await fetchConsolesPayload())
}))

router.get('/api/consoles/:id', handleAsync(async (req, res) => {
  const payload = await fetchConsoleDetailPayload(req.params.id)
  if (!payload) {
    return res.status(404).json({ ok: false, error: 'Console not found' })
  }
  res.json(payload)
}))

router.get('/api/search', handleAsync(async (req, res) => {
  const q = String(req.query.q || '').trim()
  const type = ['all', 'game', 'franchise'].includes(String(req.query.type || 'all'))
    ? String(req.query.type || 'all')
    : 'all'
  const limit = parseLimit(req.query.limit, 20, 100)
  const scope = await readPublishedGameScope()
  res.json(await searchCatalog(q, type, limit, scope))
}))

router.get('/api/search/global', handleAsync(async (req, res) => {
  const q = String(req.query.q || '').trim()
  const context = String(req.query.context || 'all').trim().toLowerCase()
  const limit = parseLimit(req.query.limit, 20, 60)
  const scope = await readPublishedGameScope()
  res.json(await searchGlobal(q, context, limit, scope))
}))

router.get('/api/franchises', handleAsync(async (_req, res) => {
  res.json(await listFranchises())
}))

router.get('/api/franchises/:slug', handleAsync(async (req, res) => {
  const slug = String(req.params.slug || '').trim()
  const payload = await getFranchiseBySlug(slug)
  if (!payload) {
    return res.status(404).json({ ok: false, error: 'Franchise not found' })
  }
  return res.json(payload)
}))

router.get('/api/franchises/:slug/games', handleAsync(async (req, res) => {
  const slug = String(req.params.slug || '').trim()
  res.json(await listFranchiseGamesBySlug(slug))
}))

router.get('/api/collection', handleAsync(async (req, res) => {
  const listType = req.query?.list_type ? normalizeCollectionListType(req.query.list_type) : null
  if (req.query?.list_type && !listType) {
    return res.status(400).json({ ok: false, error: 'list_type must be one of owned, wanted or for_sale' })
  }
  const items = await listCollectionItems({
    ...resolveRequestCollectionScope(req),
    listType,
  })

  res.json({
    items,
    total: items.length,
  })
}))

router.post('/api/collection', handleAsync(async (req, res) => {
  const parsed = parseCollectionCreatePayload(req.body)
  if (!parsed.ok) {
    return res.status(400).json({ ok: false, error: parsed.error })
  }

  const item = await runCollectionOperation(res, () => createCollectionItem({
    ...resolveRequestCollectionScope(req),
    body: req.body,
  }))
  if (!item) {
    return
  }

  res.status(201).json({
    ok: true,
    item,
  })
}))

router.patch('/api/collection/:id', handleAsync(async (req, res) => {
  const parsed = parseCollectionPatchPayload(req.body)
  if (!parsed.ok) {
    return res.status(400).json({ ok: false, error: parsed.error })
  }

  const item = await runCollectionOperation(res, () => updateCollectionItem({
    ...resolveRequestCollectionScope(req),
    gameId: req.params.id,
    body: req.body,
  }))
  if (!item) {
    return
  }

  res.json({
    ok: true,
    item,
  })
}))

router.delete('/api/collection/:id', handleAsync(async (req, res) => {
  const deleted = await runCollectionOperation(res, () => deleteCollectionItem({
    ...resolveRequestCollectionScope(req),
    gameId: req.params.id,
  }))
  if (!deleted) {
    return
  }

  res.json(deleted)
}))

router.get('/api/collection/stats', handleAsync(async (_req, res) => {
  const stats = await getCollectionStats(resolveRequestCollectionScope(_req))
  res.json({
    ...stats,
    total: stats.count,
  })
}))

router.get('/api/stats', handleAsync(async (_req, res) => {
  res.json(await fetchStatsPayload())
}))

module.exports = router
