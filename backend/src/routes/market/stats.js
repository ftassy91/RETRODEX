'use strict'
// DATA: supabase via Supabase-only services - Sequelize non utilise dans ce fichier

const { Router } = require('express')

const { setPublicEdgeCache } = require('../../helpers/cache-control')
const { handleAsync } = require('../../helpers/query')
const {
  fetchStatsPayload,
} = require('../../services/public-runtime-payload-service')

const router = Router()

router.get('/api/stats', handleAsync(async (_req, res) => {
  setPublicEdgeCache(res, { cdnMaxAge: 120, staleWhileRevalidate: 300 })
  return res.json(await fetchStatsPayload())
}))

module.exports = router
