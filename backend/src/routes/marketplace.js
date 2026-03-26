'use strict'

const { Router } = require('express')
const MarketplaceListing = require('../models/MarketplaceListing')
const Game = require('../models/Game')

const router = Router()

const VALID_CONDITIONS = new Set(['mint', 'very_good', 'good', 'fair', 'poor', 'incomplete'])
const VALID_STATUSES = new Set(['active', 'sold', 'removed'])

function normalizeLimit(value) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 50
  }

  return Math.min(parsed, 100)
}

router.get('/marketplace', async (req, res) => {
  try {
    const { consoleId, condition, gameId } = req.query
    const status = String(req.query.status || 'active').trim()
    const limit = normalizeLimit(req.query.limit)

    if (condition && !VALID_CONDITIONS.has(String(condition))) {
      return res.status(400).json({ error: 'invalid condition' })
    }

    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: 'invalid status' })
    }

    const where = { status }
    if (condition) {
      where.condition = String(condition)
    }
    if (gameId) {
      where.gameId = String(gameId)
    }

    const include = [{
      model: Game,
      as: 'game',
      attributes: ['id', 'title', 'consoleId', 'slug', 'loosePrice'],
      required: true,
    }]

    if (consoleId) {
      include[0].where = { consoleId: String(consoleId) }
    }

    const listings = await MarketplaceListing.findAll({
      where,
      include,
      order: [['createdAt', 'DESC']],
      limit,
    })

    return res.json(listings)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

router.get('/marketplace/:id', async (req, res) => {
  try {
    const listing = await MarketplaceListing.findByPk(req.params.id, {
      include: [{
        model: Game,
        as: 'game',
      }],
    })

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' })
    }

    return res.json(listing)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

router.post('/marketplace', async (req, res) => {
  try {
    const {
      gameId,
      sellerId,
      price,
      currency,
      condition,
      description,
      location,
    } = req.body || {}

    if (!gameId || !sellerId || price === undefined || price === null || !condition) {
      return res.status(400).json({ error: 'gameId, sellerId, price and condition are required' })
    }

    if (!VALID_CONDITIONS.has(String(condition))) {
      return res.status(400).json({ error: 'invalid condition' })
    }

    const numericPrice = Number(price)
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ error: 'price must be a positive number' })
    }

    const game = await Game.findByPk(gameId)
    if (!game) {
      return res.status(404).json({ error: 'Game not found' })
    }

    const created = await MarketplaceListing.create({
      gameId: String(gameId),
      sellerId: String(sellerId),
      price: numericPrice,
      currency: currency ? String(currency) : undefined,
      condition: String(condition),
      description: description ?? null,
      location: location ?? null,
    })

    const listing = await MarketplaceListing.findByPk(created.id, {
      include: [{
        model: Game,
        as: 'game',
      }],
    })

    return res.status(201).json(listing)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

router.patch('/marketplace/:id/status', async (req, res) => {
  try {
    const { status } = req.body || {}

    if (!VALID_STATUSES.has(String(status))) {
      return res.status(400).json({ error: 'invalid status' })
    }

    const listing = await MarketplaceListing.findByPk(req.params.id)
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' })
    }

    await listing.update({ status: String(status) })
    return res.json(listing)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

module.exports = router
