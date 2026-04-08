'use strict'
// DATA: supabase via Supabase-only services - Sequelize non utilise dans ce fichier

const { Router } = require('express')

const { handleAsync } = require('../../helpers/query')
const {
  fetchCanonicalGamesList,
} = require('../../services/public-game-reader')

const router = Router()

router.get('/games', handleAsync(async (req, res) => {
  const payload = await fetchCanonicalGamesList(req.query)
  res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
  return res.json(payload.items)
}))

router.get('/api/games', handleAsync(async (req, res) => {
  const payload = await fetchCanonicalGamesList(req.query)
  res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
  return res.json(payload)
}))

router.get('/api/games/random', handleAsync(async (req, res) => {
  const payload = await fetchCanonicalGamesList({
    ...req.query,
    limit: 5000,
    offset: 0,
  })

  if (!payload.items.length) {
    return res.status(404).json({ ok: false, error: 'No game found for the current filter' })
  }

  const index = Math.floor(Math.random() * payload.items.length)
  return res.json(payload.items[index])
}))

module.exports = router
