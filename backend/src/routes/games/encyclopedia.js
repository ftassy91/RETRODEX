'use strict'
// DATA: supabase via Supabase-only services - Sequelize non utilise dans ce fichier

const { Router } = require('express')

const { handleAsync } = require('../../helpers/query')
const {
  fetchGameKnowledgeDomains,
  buildEncyclopediaPayload,
  fetchCanonicalGameById,
} = require('../../services/public-game-reader')

const router = Router()
const PUBLIC_ENCYCLOPEDIA_CACHE_CONTROL = 'public, max-age=0, s-maxage=300, stale-while-revalidate=900'

router.get('/api/games/:id/encyclopedia', handleAsync(async (req, res) => {
  const game = await fetchCanonicalGameById(req.params.id)
  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  const domains = await fetchGameKnowledgeDomains(game)
  res.set('Cache-Control', PUBLIC_ENCYCLOPEDIA_CACHE_CONTROL)
  return res.json(buildEncyclopediaPayload(game, domains))
}))

module.exports = router
