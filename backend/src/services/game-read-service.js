'use strict'

const { QueryTypes } = require('sequelize')

const Game = require('../models/Game')
const { sequelize } = require('../database')

function parseMaybeJson(value, fallback = null) {
  if (value == null || value === '') {
    return fallback
  }
  if (Array.isArray(value) || typeof value === 'object') {
    return value
  }
  if (typeof value !== 'string') {
    return fallback
  }
  try {
    return JSON.parse(value)
  } catch (_error) {
    return fallback
  }
}

function tableNamesMatch(tableName, target) {
  return String(tableName || '').replace(/"/g, '').toLowerCase() === String(target).toLowerCase()
}

async function tableExists(target) {
  const tables = await sequelize.getQueryInterface().showAllTables()
  return (tables || []).some((tableName) => tableNamesMatch(tableName, target))
}

function buildPeopleBuckets(rows) {
  const buckets = {
    devTeam: [],
    composers: [],
  }

  for (const row of rows) {
    const entry = {
      name: row.name,
      role: row.role,
      confidence: Number(row.confidence || 0),
    }
    const normalizedRole = String(row.role || '').toLowerCase()
    if (normalizedRole.includes('composer') || normalizedRole.includes('music')) {
      buckets.composers.push(entry)
    } else {
      buckets.devTeam.push(entry)
    }
  }

  return buckets
}

async function loadCanonicalSupplements(gameId) {
  const [hasEditorial, hasPeople, hasMedia, hasSnapshot, hasQuality, hasReleases] = await Promise.all([
    tableExists('game_editorial'),
    Promise.all([tableExists('game_people'), tableExists('people')]).then((result) => result.every(Boolean)),
    tableExists('media_references'),
    tableExists('market_snapshots'),
    tableExists('quality_records'),
    tableExists('releases'),
  ])

  const [editorialRows, peopleRows, mediaRows, snapshotRows, qualityRows, releaseRows] = await Promise.all([
    hasEditorial
      ? sequelize.query(
        `SELECT summary,
                synopsis,
                lore,
                dev_notes AS devNotes,
                cheat_codes AS cheatCodes,
                characters,
                gameplay_description AS gameplayDescription
         FROM game_editorial
         WHERE game_id = :gameId
         LIMIT 1`,
        {
          replacements: { gameId },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
    hasPeople
      ? sequelize.query(
        `SELECT gp.role AS role, gp.confidence AS confidence, p.name AS name
         FROM game_people gp
         INNER JOIN people p ON p.id = gp.person_id
         WHERE gp.game_id = :gameId
         ORDER BY COALESCE(gp.billing_order, 9999) ASC, p.name ASC`,
        {
          replacements: { gameId },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
    hasMedia
      ? sequelize.query(
        `SELECT media_type AS mediaType, url
         FROM media_references
         WHERE entity_type = 'game'
           AND entity_id = :gameId`,
        {
          replacements: { gameId },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
    hasSnapshot
      ? sequelize.query(
        `SELECT loose_price AS loosePrice,
                cib_price AS cibPrice,
                mint_price AS mintPrice,
                observation_count AS observationCount,
                last_observed_at AS lastObservedAt,
                trend_signal AS trendSignal,
                confidence_score AS confidenceScore,
                source_coverage AS sourceCoverage
         FROM market_snapshots
         WHERE game_id = :gameId
         LIMIT 1`,
        {
          replacements: { gameId },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
    hasQuality
      ? sequelize.query(
        `SELECT completeness_score AS completenessScore,
                confidence_score AS confidenceScore,
                source_coverage_score AS sourceCoverageScore,
                freshness_score AS freshnessScore,
                overall_score AS overallScore,
                tier,
                missing_critical_fields AS missingCriticalFields,
                breakdown_json AS breakdownJson,
                priority_score AS priorityScore
         FROM quality_records
         WHERE entity_type = 'game'
           AND entity_id = :gameId
         LIMIT 1`,
        {
          replacements: { gameId },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
    hasReleases
      ? sequelize.query(
        `SELECT release_date AS releaseDate,
                release_year AS releaseYear,
                console_id AS consoleId,
                region_code AS regionCode,
                edition_name AS editionName
         FROM releases
         WHERE game_id = :gameId
         ORDER BY CASE WHEN edition_name = 'default' THEN 0 ELSE 1 END ASC, release_year ASC
         LIMIT 1`,
        {
          replacements: { gameId },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
  ])

  return {
    editorial: editorialRows[0] || null,
    people: buildPeopleBuckets(peopleRows),
    media: mediaRows.reduce((acc, row) => {
      acc[String(row.mediaType || '').toLowerCase()] = row.url
      return acc
    }, {}),
    snapshot: snapshotRows[0] || null,
    quality: qualityRows[0] || null,
    release: releaseRows[0] || null,
  }
}

function mergeGameRecord(game, supplement) {
  if (!game) {
    return null
  }

  const editorial = supplement.editorial || {}
  const people = supplement.people || { devTeam: [], composers: [] }
  const media = supplement.media || {}
  const snapshot = supplement.snapshot || {}
  const quality = supplement.quality || null
  const release = supplement.release || {}

  return {
    ...game,
    summary: game.summary || editorial.summary || null,
    synopsis: game.synopsis || editorial.synopsis || editorial.lore || null,
    lore: game.lore || editorial.lore || null,
    dev_anecdotes: game.dev_anecdotes || editorial.devNotes || null,
    cheat_codes: parseMaybeJson(game.cheat_codes) || parseMaybeJson(editorial.cheatCodes) || null,
    characters: parseMaybeJson(game.characters) || parseMaybeJson(editorial.characters) || null,
    gameplay_description: game.gameplay_description || editorial.gameplayDescription || null,
    dev_team: people.devTeam.length ? people.devTeam : parseMaybeJson(game.dev_team) || null,
    ost_composers: people.composers.length ? people.composers : parseMaybeJson(game.ost_composers) || null,
    loosePrice: snapshot.loosePrice ?? game.loosePrice ?? game.loose_price ?? null,
    cibPrice: snapshot.cibPrice ?? game.cibPrice ?? game.cib_price ?? null,
    mintPrice: snapshot.mintPrice ?? game.mintPrice ?? game.mint_price ?? null,
    coverImage: media.cover || game.cover_url || game.coverImage || null,
    cover_url: media.cover || game.cover_url || game.coverImage || null,
    manual_url: media.manual || game.manual_url || null,
    releaseDate: release.releaseDate || game.releaseDate || null,
    quality: quality ? {
      completenessScore: Number(quality.completenessScore || 0),
      confidenceScore: Number(quality.confidenceScore || 0),
      sourceCoverageScore: Number(quality.sourceCoverageScore || 0),
      freshnessScore: Number(quality.freshnessScore || 0),
      overallScore: Number(quality.overallScore || 0),
      tier: quality.tier,
      missingCriticalFields: parseMaybeJson(quality.missingCriticalFields, []) || [],
      breakdown: parseMaybeJson(quality.breakdownJson, {}) || {},
      priorityScore: Number(quality.priorityScore || 0),
    } : null,
    market: snapshot ? {
      observationCount: Number(snapshot.observationCount || 0),
      lastObservedAt: snapshot.lastObservedAt || null,
      trendSignal: snapshot.trendSignal || null,
      confidenceScore: Number(snapshot.confidenceScore || 0),
      sourceCoverage: Number(snapshot.sourceCoverage || 0),
    } : null,
  }
}

async function getHydratedGameById(gameId) {
  const record = await Game.findByPk(gameId)
  if (!record) {
    return null
  }

  const supplement = await loadCanonicalSupplements(gameId)
  return mergeGameRecord(record.get({ plain: true }), supplement)
}

module.exports = {
  parseMaybeJson,
  mergeGameRecord,
  getHydratedGameById,
}
