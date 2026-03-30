'use strict'

const { Router } = require('express')
const { QueryTypes } = require('sequelize')
require('../models/associations')
const Franchise = require('../models/Franchise')
const CommunityReport = require('../../models/CommunityReport')
const RetrodexIndex = require('../../models/RetrodexIndex')
const { sequelize } = require('../database')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPERDATA_Project_URL
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPERDATA_SERVICE_KEY
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPERDATA_Anon_Key

const { handleAsync } = require('../helpers/query')
const { buildPriceHistoryPayload } = require('../helpers/priceHistory')
const {
  getHydratedGameById,
  listHydratedGamesByConsole,
} = require('../services/game-read-service')
const {
  toGameSummary,
  fetchSeedPriceHistory,
} = require('./games-helpers')
const {
  parseStoredJson,
  buildProductionPayload,
  buildMediaPayload,
  buildArchivePayload,
  buildEncyclopediaPayload,
} = require('../helpers/game-knowledge')

const router = Router()

async function fetchLocalCompanyRows(game) {
  try {
    const rows = await sequelize.query(
      `SELECT gc.company_id AS id,
              c.name AS name,
              gc.role AS role,
              gc.confidence AS confidence,
              c.country AS country
       FROM game_companies gc
       INNER JOIN companies c ON c.id = gc.company_id
       WHERE gc.game_id = :gameId
       ORDER BY COALESCE(gc.confidence, 0) DESC, c.name ASC`,
      {
        replacements: { gameId: game.id },
        type: QueryTypes.SELECT,
      }
    )

    if (rows.length) {
      return rows
    }
  } catch (_error) {}

  const fallbackIds = [
    { id: game.developerId, role: 'developer' },
    { id: game.publisherId, role: 'publisher' },
  ].filter((entry) => entry.id)

  if (!fallbackIds.length) {
    return []
  }

  try {
    const ids = fallbackIds.map((entry) => entry.id)
    const rows = await sequelize.query(
      `SELECT id, name, country
       FROM companies
       WHERE id IN (:ids)`,
      {
        replacements: { ids },
        type: QueryTypes.SELECT,
      }
    )
    const byId = new Map(rows.map((entry) => [String(entry.id), entry]))

    return fallbackIds
      .map((entry) => {
        const company = byId.get(String(entry.id))
        if (!company) {
          return null
        }

        return {
          id: company.id,
          name: company.name,
          country: company.country || null,
          role: entry.role,
          confidence: 0.7,
          source: 'association_fallback',
        }
      })
      .filter(Boolean)
  } catch (_error) {
    return []
  }
}

async function fetchLocalMediaRows(gameId) {
  try {
    return await sequelize.query(
      `SELECT media_type AS mediaType,
              url,
              provider,
              compliance_status AS complianceStatus,
              storage_mode AS storageMode
       FROM media_references
       WHERE entity_type = 'game'
         AND entity_id = :gameId
       ORDER BY CASE WHEN media_type = 'cover' THEN 0 WHEN media_type = 'manual' THEN 1 ELSE 2 END ASC,
                url ASC`,
      {
        replacements: { gameId },
        type: QueryTypes.SELECT,
      }
    )
  } catch (_error) {
    return []
  }
}

async function fetchLocalOstReleases(gameId) {
  try {
    return await sequelize.query(
      `SELECT id,
              name,
              format,
              track_count AS trackCount,
              release_year AS releaseYear,
              label,
              region_code AS regionCode,
              slug,
              source_confidence AS sourceConfidence
       FROM osts
       WHERE game_id = :gameId
       ORDER BY COALESCE(release_year, 9999) ASC, name ASC`,
      {
        replacements: { gameId },
        type: QueryTypes.SELECT,
      }
    )
  } catch (_error) {
    return []
  }
}

async function fetchLocalKnowledgeDomains(game) {
  const [companyRows, mediaRows, ostReleases] = await Promise.all([
    fetchLocalCompanyRows(game),
    fetchLocalMediaRows(game.id),
    fetchLocalOstReleases(game.id),
  ])

  return {
    production: buildProductionPayload({
      game,
      companyRows,
      devTeam: parseStoredJson(game.dev_team, []) || [],
    }),
    media: buildMediaPayload({
      game,
      mediaRows,
    }),
    ostReleases,
  }
}

router.get('/api/games/:id/archive', handleAsync(async (req, res) => {
  const game = await getHydratedGameById(req.params.id)

  if (!game) return res.status(404).json({ ok: false, error: 'Game not found' })
  const { production, media, ostReleases } = await fetchLocalKnowledgeDomains(game)

  res.json(buildArchivePayload({
    game,
    production,
    media,
    ostReleases,
  }))
}))

router.get('/api/games/:id', handleAsync(async (req, res) => {
  const game = await getHydratedGameById(req.params.id)
  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }
  return res.json(game)
}))

router.get('/api/games/:id/price-history', handleAsync(async (req, res) => {
  const [game, reports, indexEntries, seedHistory] = await Promise.all([
    getHydratedGameById(req.params.id),
    CommunityReport.findAll({
      where: {
        item_id: req.params.id,
        item_type: 'game',
        editorial_excluded: false,
      },
      order: [['date_estimated', 'ASC'], ['created_at', 'ASC'], ['id', 'ASC']],
    }),
    RetrodexIndex.findAll({
      where: {
        item_id: req.params.id,
        item_type: 'game',
      },
      order: [['condition', 'ASC']],
    }),
    fetchSeedPriceHistory(req.params.id),
  ])

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  return res.json(buildPriceHistoryPayload(game, { reports, indexEntries, seedHistory }))
}))

router.get('/api/games/:id/summary', handleAsync(async (req, res) => {
  const game = await getHydratedGameById(req.params.id)

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  return res.json({ ok: true, item: toGameSummary(game) })
}))

router.get('/api/games/:id/encyclopedia', handleAsync(async (req, res) => {
  const game = await getHydratedGameById(req.params.id)

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  return res.json(buildEncyclopediaPayload(game))
}))

router.get('/api/games/:id/similar', handleAsync(async (req, res) => {
  const currentGame = await getHydratedGameById(req.params.id)

  if (!currentGame) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  const consoleBundle = await listHydratedGamesByConsole({
    id: currentGame.consoleId || null,
  }, {
    nameVariants: [currentGame.console].filter(Boolean),
    limit: 5000,
    sort: 'price_desc',
  })

  const pool = (consoleBundle.items || []).filter((game) => game.id !== currentGame.id)
  const sameConsoleSameRarity = pool.filter((game) => game.rarity === currentGame.rarity)
  const fallbackGames = pool.filter((game) => game.rarity !== currentGame.rarity)
  const selectedGames = [...sameConsoleSameRarity, ...fallbackGames].slice(0, 6)

  return res.json({
    ok: true,
    games: selectedGames.map((game) => ({
      id: game.id,
      title: game.title,
      console: game.console,
      year: game.year,
      rarity: game.rarity,
      loosePrice: game.loosePrice,
    })),
    count: selectedGames.length,
  })
}))

router.get('/api/games/:id/franchise', handleAsync(async (req, res) => {
  const game = await getHydratedGameById(req.params.id)

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  if (!game.franch_id) {
    return res.json({
      ok: true,
      franchise: null,
    })
  }

  const franchise = await Franchise.findOne({
    where: { id: game.franch_id },
    attributes: ['id', 'name', 'slug', 'first_game', 'last_game'],
  })

  return res.json({
    ok: true,
    franchise: franchise ? {
      id: franchise.id,
      name: franchise.name,
      slug: franchise.slug,
      first_game: franchise.first_game ?? null,
      last_game: franchise.last_game ?? null,
    } : null,
  })
}))

module.exports = router
