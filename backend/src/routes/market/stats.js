'use strict'
// DATA: supabase via Supabase-only services - Sequelize non utilise dans ce fichier

const { Router } = require('express')

const { handleAsync } = require('../../helpers/query')
const {
  fetchStatsPayload,
} = require('../../services/public-runtime-payload-service')

const router = Router()
const PUBLIC_STATS_CACHE_CONTROL = 'public, max-age=0, s-maxage=120, stale-while-revalidate=300'

router.get('/api/stats', handleAsync(async (_req, res) => {
  res.set('Cache-Control', PUBLIC_STATS_CACHE_CONTROL)
  return res.json(await fetchStatsPayload())
}))

module.exports = router
