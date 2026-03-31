'use strict'

const { Router } = require('express')

const { handleAsync, parseLimit } = require('../helpers/query')
const { resolveRequestUserId } = require('../middleware/auth')
const {
  fetchMarketSearchPayload,
  fetchDexSearchPayload,
  fetchCollectionSearchPayload,
} = require('../services/public-contextual-search-service')

const router = Router()

router.get('/api/market/search', handleAsync(async (req, res) => {
  const q = String(req.query.q || '').trim()
  const limit = parseLimit(req.query.limit, 20, 50)

  res.json(await fetchMarketSearchPayload(q, limit))
}))

router.get('/api/dex/search', handleAsync(async (req, res) => {
  const q = String(req.query.q || '').trim()
  const limit = parseLimit(req.query.limit, 120, 1000)

  res.json(await fetchDexSearchPayload(q, limit))
}))

router.get('/api/collection/search', handleAsync(async (req, res) => {
  const q = String(req.query.q || '').trim()
  const listType = String(req.query.list_type || '').trim().toLowerCase() || null
  const consoleName = String(req.query.console || '').trim() || null
  const sort = String(req.query.sort || 'title_asc').trim()
  const limit = parseLimit(req.query.limit, 200, 1000)
  const userId = resolveRequestUserId(req) || undefined

  res.json(await fetchCollectionSearchPayload({
    query: q,
    listType,
    consoleName,
    sort,
    limit,
    userId,
  }))
}))

module.exports = router
