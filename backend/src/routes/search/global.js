'use strict'
// DATA: supabase via Supabase-only services - Sequelize non utilise dans ce fichier

const { Router } = require('express')

const { handleAsync, parseLimit } = require('../../helpers/query')
const {
  searchCatalog,
  searchGlobal,
} = require('../../services/public-search-service')
const {
  fetchPublishedGameScope,
} = require('../../services/public-publication-service')

const router = Router()

router.get('/api/search', handleAsync(async (req, res) => {
  const q = String(req.query.q || '').trim()
  const type = ['all', 'game', 'franchise'].includes(String(req.query.type || 'all'))
    ? String(req.query.type || 'all')
    : 'all'
  const limit = parseLimit(req.query.limit, 20, 100)
  const scope = await fetchPublishedGameScope()

  return res.json(await searchCatalog(q, type, limit, scope))
}))

router.get('/api/search/global', handleAsync(async (req, res) => {
  const q = String(req.query.q || '').trim()
  const context = String(req.query.context || 'all').trim().toLowerCase()
  const limit = parseLimit(req.query.limit, 20, 60)
  const scope = await fetchPublishedGameScope()

  return res.json(await searchGlobal(q, context, limit, scope))
}))

module.exports = router
