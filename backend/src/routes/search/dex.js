'use strict'
// DATA: supabase via Supabase-only services - Sequelize non utilise dans ce fichier

const { Router } = require('express')

const { handleAsync, parseLimit } = require('../../helpers/query')
const {
  fetchDexSearchPayload,
} = require('../../services/public-contextual-search-service')

const router = Router()

router.get('/api/dex/search', handleAsync(async (req, res) => {
  const q = String(req.query.q || '').trim()
  const limit = parseLimit(req.query.limit, 120, 1000)

  return res.json(await fetchDexSearchPayload(q, limit))
}))

module.exports = router
