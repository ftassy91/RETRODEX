'use strict'
// DATA: supabase via Supabase-only services - Sequelize non utilise dans ce fichier

const { Router } = require('express')

const { handleAsync } = require('../../helpers/query')
const {
  fetchItemsPayload,
} = require('../../services/public-runtime-payload-service')

const router = Router()

router.get('/api/items', handleAsync(async (req, res) => {
  res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=60')
  return res.json(await fetchItemsPayload(req.query))
}))

module.exports = router
