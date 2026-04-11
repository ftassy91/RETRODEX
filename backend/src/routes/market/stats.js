'use strict'
// DATA: supabase via Supabase-only services - Sequelize non utilise dans ce fichier

const { Router } = require('express')

const { setPublicEdgeCache } = require('../../helpers/cache-control')
const { handleAsync } = require('../../helpers/query')
const {
  fetchStatsPayload,
} = require('../../services/public-runtime-payload-service')

const router = Router()

let _statsCache = { data: null, ts: 0 }
const STATS_TTL = 5 * 60 * 1000 // 5 min

router.get('/api/stats', handleAsync(async (_req, res) => {
  const now = Date.now()
  if (_statsCache.data && (now - _statsCache.ts) < STATS_TTL) {
    setPublicEdgeCache(res, { cdnMaxAge: 120, staleWhileRevalidate: 300 })
    return res.json(_statsCache.data)
  }

  const payload = await fetchStatsPayload()
  _statsCache = { data: payload, ts: now }

  setPublicEdgeCache(res, { cdnMaxAge: 120, staleWhileRevalidate: 300 })
  return res.json(payload)
}))

module.exports = router
