'use strict'

// LEGACY: this Sequelize-backed detail route tree is not mounted by default in the
// canonical Supabase runtime. The active public detail flow is served by
// `serverless.js` via `public-game-reader` and related Supabase readers.
// Do not add new product logic here during the canonical convergence.

const { Router } = require('express')
const { QueryTypes } = require('sequelize')
require('../models/associations')
const Franchise = require('../models/Franchise')
const CommunityReport = require('../../models/CommunityReport')
const RetrodexIndex = require('../../models/RetrodexIndex')
const { sequelize } = require('../database')

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
const { buildGameDetailDataLayer } = require('../helpers/game-detail-data-layer')

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
              storage_mode AS storageMode,
              title,
              preview_url AS previewUrl,
              asset_subtype AS assetSubtype,
              license_status AS licenseStatus,
              ui_allowed AS uiAllowed,
              healthcheck_status AS healthcheckStatus,
              notes,
              source_context AS sourceContext
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
    } catch (_fallbackError) {
      return []
    }
  }
}

async function fetchLocalEditorialRow(gameId) {
  try {
    const rows = await sequelize.query(
      `SELECT summary,
              synopsis,
              lore,
              gameplay_description AS gameplayDescription,
              characters,
              dev_anecdotes AS devAnecdotes,
              cheat_codes AS cheatCodes,
              versions,
              avg_duration_main AS avgDurationMain,
              avg_duration_complete AS avgDurationComplete,
              speedrun_wr AS speedrunWr
       FROM game_editorial
       WHERE game_id = :gameId
       LIMIT 1`,
      {
        replacements: { gameId },
        type: QueryTypes.SELECT,
      }
    )

    return rows[0] || null
  } catch (_error) {
    try {
      const rows = await sequelize.query(
        `SELECT summary,
                synopsis,
                lore,
                gameplay_description AS gameplayDescription,
                characters,
                cheat_codes AS cheatCodes
         FROM game_editorial
         WHERE game_id = :gameId
         LIMIT 1`,
        {
          replacements: { gameId },
          type: QueryTypes.SELECT,
        }
      )
      return rows[0] || null
    } catch (_fallbackError) {
      return null
    }
  }
}

async function fetchLocalPeopleRows(gameId) {
  try {
    return await sequelize.query(
      `SELECT gp.role AS role,
              gp.billing_order AS billingOrder,
              gp.confidence AS confidence,
              gp.is_inferred AS isInferred,
              p.id AS personId,
              p.name AS name,
              p.normalized_name AS normalizedName
       FROM game_people gp
       INNER JOIN people p ON p.id = gp.person_id
       WHERE gp.game_id = :gameId
       ORDER BY COALESCE(gp.billing_order, 9999) ASC, p.name ASC`,
      {
        replacements: { gameId },
        type: QueryTypes.SELECT,
      }
    )
  } catch (_error) {
    return []
  }
}

async function fetchLocalContentProfileRow(gameId) {
  try {
    const rows = await sequelize.query(
      `SELECT content_profile_json,
              profile_version,
              profile_mode,
              profile_basis_json,
              relevant_expected,
              updated_at
       FROM game_content_profiles
       WHERE game_id = :gameId
       LIMIT 1`,
      {
        replacements: { gameId },
        type: QueryTypes.SELECT,
      }
    )

    return rows[0] || null
  } catch (_error) {
    return null
  }
}

async function fetchLocalOstRows(gameId) {
  try {
    return await sequelize.query(
      `SELECT id,
              title,
              confidence,
              needs_release_enrichment AS needsReleaseEnrichment
       FROM ost
       WHERE game_id = :gameId`,
      {
        replacements: { gameId },
        type: QueryTypes.SELECT,
      }
    )
  } catch (_error) {
    try {
      return await sequelize.query(
        `SELECT id,
                name AS title,
                source_confidence AS confidence,
                0 AS needsReleaseEnrichment
         FROM osts
         WHERE game_id = :gameId`,
        {
          replacements: { gameId },
          type: QueryTypes.SELECT,
        }
      )
    } catch (_fallbackError) {
      return []
    }
  }
}

async function fetchLocalOstTracks(gameId) {
  try {
    return await sequelize.query(
      `SELECT o.id AS ostId,
              ot.track_title AS trackTitle,
              ot.track_number AS trackNumber,
              ot.composer_person_id AS composerPersonId,
              ot.confidence AS confidence
       FROM ost_tracks ot
       INNER JOIN ost o ON o.id = ot.ost_id
       WHERE o.game_id = :gameId
       ORDER BY COALESCE(ot.track_number, 9999) ASC, ot.track_title ASC`,
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
              COALESCE(label, catalog_number, 'OST') AS name,
              NULL AS format,
              NULL AS trackCount,
              NULL AS releaseYear,
              label,
              region_code AS regionCode,
              NULL AS slug,
              confidence AS sourceConfidence
       FROM ost_releases
       WHERE ost_id IN (SELECT id FROM ost WHERE game_id = :gameId)
       ORDER BY COALESCE(release_date, '9999-12-31') ASC, label ASC`,
      {
        replacements: { gameId },
        type: QueryTypes.SELECT,
      }
    )
  } catch (_error) {
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
    } catch (_fallbackError) {
      return []
    }
  }
}

async function fetchLocalKnowledgeDomains(game) {
  const [companyRows, mediaRows, editorial, peopleRows, ostRows, ostTracks, ostReleases] = await Promise.all([
    fetchLocalCompanyRows(game),
    fetchLocalMediaRows(game.id),
    fetchLocalEditorialRow(game.id),
    fetchLocalPeopleRows(game.id),
    fetchLocalOstRows(game.id),
    fetchLocalOstTracks(game.id),
    fetchLocalOstReleases(game.id),
  ])

  const canonicalDevTeam = peopleRows
    .filter((entry) => !String(entry.role || '').toLowerCase().includes('composer'))
    .map((entry) => ({
      personId: entry.personId,
      name: entry.name,
      normalizedName: entry.normalizedName,
      role: entry.role,
      confidence: Number(entry.confidence || 0),
      isInferred: Boolean(entry.isInferred),
    }))

  const canonicalComposers = peopleRows
    .filter((entry) => String(entry.role || '').toLowerCase().includes('composer'))
    .map((entry) => ({
      personId: entry.personId,
      name: entry.name,
      normalizedName: entry.normalizedName,
      role: entry.role,
      confidence: Number(entry.confidence || 0),
      isInferred: Boolean(entry.isInferred),
    }))

  return {
    editorial,
    production: buildProductionPayload({
      game,
      companyRows,
      devTeam: canonicalDevTeam.length ? canonicalDevTeam : (parseStoredJson(game.dev_team, []) || []),
    }),
    media: buildMediaPayload({
      game,
      mediaRows,
    }),
    music: {
      composers: canonicalComposers.length ? canonicalComposers : (parseStoredJson(game.ost_composers, []) || []),
      tracks: ostTracks.length
        ? ostTracks.map((entry) => ({
          ostId: entry.ostId,
          title: entry.trackTitle,
          trackNumber: entry.trackNumber,
          composerPersonId: entry.composerPersonId,
          confidence: Number(entry.confidence || 0),
        }))
        : (parseStoredJson(game.ost_notable_tracks, []) || []),
      releases: ostReleases,
      ostRows,
    },
  }
}

router.get('/api/games/:id/archive', handleAsync(async (req, res) => {
  const game = await getHydratedGameById(req.params.id)

  if (!game) return res.status(404).json({ ok: false, error: 'Game not found' })
  const { editorial, production, media, music } = await fetchLocalKnowledgeDomains(game)

  res.json(buildArchivePayload({
    game,
    editorial,
    production,
    media,
    music,
    ostReleases: music.releases,
  }))
}))

router.get('/api/games/:id/detail', handleAsync(async (req, res) => {
  const game = await getHydratedGameById(req.params.id)

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  const [domains, storedProfile] = await Promise.all([
    fetchLocalKnowledgeDomains(game),
    fetchLocalContentProfileRow(game.id),
  ])

  const archive = buildArchivePayload({
    game,
    editorial: domains.editorial,
    production: domains.production,
    media: domains.media,
    music: domains.music,
    ostReleases: domains.music?.releases || [],
  })
  const encyclopedia = buildEncyclopediaPayload({
    game,
    editorial: domains.editorial,
    production: domains.production,
    music: domains.music,
  })

  return res.json(buildGameDetailDataLayer({
    game,
    archive,
    encyclopedia,
    storedProfile,
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

  const { editorial, production, music } = await fetchLocalKnowledgeDomains(game)

  return res.json(buildEncyclopediaPayload({
    game,
    editorial,
    production,
    music,
  }))
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
