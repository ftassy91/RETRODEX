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

const { handleAsync, parseLimit, buildGameWhere } = require('../helpers/query')
const { normalizeGameRecord } = require('./games-helpers')

const router = Router()

router.get('/games', handleAsync(async (req, res) => {
  const { consoleId, genreId } = req.query

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
  const sequelize = req.app.locals.sequelize || require('../database').sequelize
  const limit = parseLimit(req.query.limit, 20, 5000)
  const offset = Math.max(0, Number.parseInt(String(req.query.offset || '0'), 10) || 0)
  const search = (req.query.q || '').trim()
  const consoleName = (req.query.console || '').trim()
  const rarity = (req.query.rarity || '').trim()
  const sort = req.query.sort || 'title_asc'

  let where = `WHERE type = 'game'`
  const replacements = {}

  if (consoleName) {
    where += ` AND "console" = :console`
    replacements.console = consoleName
  }
  if (rarity) {
    where += ` AND rarity = :rarity`
    replacements.rarity = rarity
  }
  if (search) {
    where += ` AND (
      LOWER(title) LIKE LOWER(:search)
      OR LOWER(COALESCE(developer,'')) LIKE LOWER(:search)
      OR LOWER(COALESCE("console",'')) LIKE LOWER(:search)
      OR LOWER(COALESCE(genre,'')) LIKE LOWER(:search)
      OR LOWER(COALESCE(lore,'')) LIKE LOWER(:search)
      OR LOWER(COALESCE(gameplay_description,'')) LIKE LOWER(:search)
    )`
    replacements.search = `%${search}%`
  }

  const sortMap = {
    title_asc: 'title ASC',
    title_desc: 'title DESC',
    price_asc: 'loose_price ASC NULLS LAST',
    price_desc: 'loose_price DESC NULLS LAST',
    year_asc: 'year ASC NULLS LAST',
    year_desc: 'year DESC NULLS LAST',
    meta_desc: 'metascore DESC NULLS LAST',
    meta_asc: 'metascore ASC NULLS LAST',
    rarity_desc: `CASE rarity WHEN 'LEGENDARY' THEN 1 WHEN 'EPIC' THEN 2 WHEN 'RARE' THEN 3 WHEN 'UNCOMMON' THEN 4 ELSE 5 END`,
  }
  const orderBy = sortMap[sort] || 'title ASC'

  const [rows] = await sequelize.query(
    `SELECT *,
      cover_url as "coverImage",
      loose_price as "loosePrice",
      cib_price as "cibPrice",
      mint_price as "mintPrice"
     FROM games
     ${where}
     ORDER BY ${orderBy}
     LIMIT 5000`,
    { replacements }
  )

  const total = rows.length
  const games = rows
    .map(normalizeGameRecord)
    .slice(offset, offset + limit)

  res.json({ items: games, returned: games.length, total })
}))

router.get('/api/games/random', handleAsync(async (req, res) => {
  const where = buildGameWhere(req.query)
  const count = await Game.count({ where })

  if (count === 0) {
    return res.status(404).json({ ok: false, error: 'No game found for the current filter' })
  }

  const offset = Math.floor(Math.random() * count)
  const items = await Game.findAll({ where, order: [['title', 'ASC']], limit: 1, offset })

  if (!items.length) {
    return res.status(404).json({ ok: false, error: 'No game found for the current filter' })
  }

  return res.json(items[0])
}))

module.exports = router
