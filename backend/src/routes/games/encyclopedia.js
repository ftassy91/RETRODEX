'use strict'
// DATA: supabase via Supabase-only services - Sequelize non utilise dans ce fichier

const { Router } = require('express')

const { setPublicEdgeCache } = require('../../helpers/cache-control')
const { handleAsync } = require('../../helpers/query')
const {
  fetchGameKnowledgeDomains,
  buildEncyclopediaPayload,
  fetchCanonicalGameById,
} = require('../../services/public-game-reader')

const router = Router()

router.get('/api/games/:id/encyclopedia', handleAsync(async (req, res) => {
  const game = await fetchCanonicalGameById(req.params.id)
  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  const domains = await fetchGameKnowledgeDomains(game)
  setPublicEdgeCache(res, { cdnMaxAge: 300, staleWhileRevalidate: 900 })
  return res.json(buildEncyclopediaPayload(game, domains))
}))

module.exports = router
