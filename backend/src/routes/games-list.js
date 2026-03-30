'use strict'

const { Router } = require('express')
const Game = require('../models/Game')
const Console = require('../models/Console')
const Company = require('../models/Company')
const Genre = require('../models/Genre')
const Region = require('../models/Region')
require('../models/associations')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPERDATA_Project_URL
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPERDATA_SERVICE_KEY
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPERDATA_Anon_Key

const { handleAsync, parseLimit } = require('../helpers/query')
const {
  listHydratedGames,
  getRandomHydratedGame,
} = require('../services/game-read-service')

const router = Router()

router.get('/games', handleAsync(async (req, res) => {
  const { consoleId, genreId } = req.query

  if (!genreId) {
    let consoleName = String(req.query.console || '').trim()

    if (!consoleName && consoleId) {
      const consoleRecord = await Console.findByPk(String(consoleId), {
        attributes: ['id', 'name'],
      })
      consoleName = consoleRecord?.get('name') || ''
    }

    const payload = await listHydratedGames({
      search: String(req.query.q || '').trim(),
      consoleId: consoleId ? String(consoleId) : null,
      consoleName,
      rarity: String(req.query.rarity || '').trim(),
      genreName: String(req.query.genre || '').trim(),
      limit: parseLimit(req.query.limit, 20, 5000),
      offset: Math.max(0, Number.parseInt(String(req.query.offset || '0'), 10) || 0),
      sort: String(req.query.sort || 'title_asc'),
      publishedOnly: true,
    })

    return res.json(payload.items)
  }

  const where = {}
  if (consoleId) where.consoleId = consoleId

  const include = [
    { model: Console, as: 'consoleData', attributes: ['id', 'name', 'manufacturer', 'generation'] },
    { model: Company, as: 'developerCompany', attributes: ['id', 'name'] },
    { model: Company, as: 'publisherCompany', attributes: ['id', 'name'] },
    { model: Genre, as: 'genres', attributes: ['id', 'name', 'slug'], through: { attributes: [] } },
  ]

  if (genreId) {
    include[3].where = { id: genreId }
    include[3].required = true
  }

  const games = await Game.findAll({ where, include })
  res.json(games)
}))

router.get('/games/:id', handleAsync(async (req, res) => {
  const game = await Game.findOne({
    where: { id: req.params.id },
    include: [
      { model: Console, as: 'consoleData', attributes: ['id', 'name', 'manufacturer', 'generation', 'releaseYear'] },
      { model: Company, as: 'developerCompany', attributes: ['id', 'name', 'country'] },
      { model: Company, as: 'publisherCompany', attributes: ['id', 'name', 'country'] },
      { model: Genre, as: 'genres', attributes: ['id', 'name', 'slug'], through: { attributes: [] } },
      { model: Region, as: 'regions', attributes: ['code', 'name'], through: { attributes: [] } },
    ]
  })

  if (!game) return res.status(404).json({ error: 'Game not found' })
  res.json(game)
}))

router.get('/api/games', handleAsync(async (req, res) => {
  const payload = await listHydratedGames({
    search: String(req.query.q || '').trim(),
    consoleName: String(req.query.console || '').trim(),
    rarity: String(req.query.rarity || '').trim(),
    genreName: String(req.query.genre || '').trim(),
    limit: parseLimit(req.query.limit, 20, 5000),
    offset: Math.max(0, Number.parseInt(String(req.query.offset || '0'), 10) || 0),
    sort: String(req.query.sort || 'title_asc'),
    publishedOnly: true,
  })

  res.json(payload)
}))

router.get('/api/games/random', handleAsync(async (req, res) => {
  const game = await getRandomHydratedGame({
    search: String(req.query.q || '').trim(),
    consoleName: String(req.query.console || '').trim(),
    rarity: String(req.query.rarity || '').trim(),
    genreName: String(req.query.genre || '').trim(),
    publishedOnly: true,
  })

  if (!game) {
    return res.status(404).json({ ok: false, error: 'No game found for the current filter' })
  }

  return res.json(game)
}))

module.exports = router
