'use strict'

const { Router } = require('express')
const { Op } = require('sequelize')
const Franchise = require('../models/Franchise')
const Game = require('../models/Game')
const { handleAsync } = require('../helpers/query')

const router = Router()

function parseStoredJson(value) {
  if (value == null || value === '') {
    return null
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  try {
    return JSON.parse(value)
  } catch (_error) {
    return null
  }
}

function toFranchisePayload(franchise) {
  return {
    id: franchise.id,
    name: franchise.name,
    slug: franchise.slug,
    description: franchise.description || null,
    first_game: franchise.first_game ?? null,
    last_game: franchise.last_game ?? null,
    developer: franchise.developer || null,
    publisher: franchise.publisher || null,
    genres: parseStoredJson(franchise.genres),
    platforms: parseStoredJson(franchise.platforms),
    timeline: parseStoredJson(franchise.timeline),
    team_changes: parseStoredJson(franchise.team_changes),
    trivia: parseStoredJson(franchise.trivia),
    legacy: franchise.legacy || null,
  }
}

router.get('/api/franchises', handleAsync(async (_req, res) => {
  const franchises = await Franchise.findAll({
    order: [['name', 'ASC']],
  })

  res.json({
    ok: true,
    franchises: franchises.map(toFranchisePayload),
    count: franchises.length,
  })
}))

router.get('/api/franchises/:slug', handleAsync(async (req, res) => {
  const franchise = await Franchise.findOne({
    where: {
      slug: String(req.params.slug || '').trim(),
    },
  })

  if (!franchise) {
    return res.status(404).json({ ok: false, error: 'Franchise not found' })
  }

  return res.json({
    ok: true,
    franchise: toFranchisePayload(franchise),
  })
}))

router.get('/api/franchises/:slug/games', handleAsync(async (req, res) => {
  const franchise = await Franchise.findOne({
    where: {
      slug: String(req.params.slug || '').trim(),
    },
  })

  if (!franchise) {
    return res.status(404).json({ ok: false, error: 'Franchise not found' })
  }

  const searchTerms = Array.from(new Set(
    [
      franchise.name,
      franchise.name?.split(':')[0]?.trim(),
      franchise.name?.replace(/\bthe Hedgehog\b/gi, '').trim(),
      franchise.slug?.replace(/-/g, ' ').trim(),
      franchise.name?.split(' ')[0]?.trim(),
    ].filter((term) => term && term.length >= 3)
  ))

  const games = await Game.findAll({
    where: {
      type: 'game',
      [Op.or]: searchTerms.map((term) => ({
        title: {
          [Op.like]: `%${term}%`,
        },
      })),
    },
    attributes: ['id', 'title', 'console', 'year', 'genre', 'rarity', 'slug', 'loosePrice', 'cibPrice', 'mintPrice'],
    order: [['title', 'ASC']],
  })

  return res.json({
    ok: true,
    games: games.map((game) => ({
      id: game.id,
      title: game.title,
      platform: game.console,
      year: game.year,
      genre: game.genre,
      rarity: game.rarity,
      slug: game.slug || null,
      loosePrice: game.loosePrice,
      cibPrice: game.cibPrice,
      mintPrice: game.mintPrice,
    })),
    count: games.length,
  })
}))

module.exports = router
