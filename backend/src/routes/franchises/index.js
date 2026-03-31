'use strict'

const { Router } = require('express')

const { handleAsync } = require('../../helpers/query')
const {
  listFranchises,
  getFranchiseBySlug,
  listFranchiseGamesBySlug,
} = require('../../services/public-search-service')

const router = Router()

router.get('/api/franchises', handleAsync(async (_req, res) => {
  return res.json(await listFranchises())
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
  return res.json(await listFranchiseGamesBySlug(slug))
}))

module.exports = router
