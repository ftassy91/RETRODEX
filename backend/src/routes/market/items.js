'use strict'
// DATA: supabase via Supabase-only services - Sequelize non utilise dans ce fichier

const { Router } = require('express')

const { handleAsync } = require('../../helpers/query')
const {
  fetchItemsPayloadResult,
} = require('../../services/public-runtime-payload-service')

const router = Router()

router.get('/api/items', handleAsync(async (req, res) => {
  const { payload, cacheStatus } = await fetchItemsPayloadResult(req.query)
  res.set('Cache-Control', 'public, max-age=0, s-maxage=120, stale-while-revalidate=300')
  res.set('X-RetroDex-Items-Cache', cacheStatus)
  return res.json(payload)
}))

module.exports = router
