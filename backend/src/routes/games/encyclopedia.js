'use strict'

const { Router } = require('express')

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
  return res.json(buildEncyclopediaPayload(game, domains))
}))

module.exports = router
