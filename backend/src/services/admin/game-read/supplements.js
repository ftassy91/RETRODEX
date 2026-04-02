'use strict'

const { QueryTypes } = require('sequelize')

const { sequelize } = require('../../../database')
const { tableExists } = require('./schema')

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

async function loadCanonicalSupplementsMap(gameIds) {
  const ids = Array.from(new Set((gameIds || []).filter(Boolean).map((gameId) => String(gameId))))
  if (!ids.length) {
    return new Map()
  }

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
        `SELECT game_id AS gameId,
                summary,
                synopsis,
                lore,
                dev_notes AS devNotes,
                cheat_codes AS cheatCodes,
                characters,
                gameplay_description AS gameplayDescription
         FROM game_editorial
         WHERE game_id IN (:gameIds)`,
        {
          replacements: { gameIds: ids },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
    hasPeople
      ? sequelize.query(
        `SELECT gp.game_id AS gameId,
                gp.role AS role,
                gp.confidence AS confidence,
                p.name AS name
         FROM game_people gp
         INNER JOIN people p ON p.id = gp.person_id
         WHERE gp.game_id IN (:gameIds)
         ORDER BY gp.game_id ASC, COALESCE(gp.billing_order, 9999) ASC, p.name ASC`,
        {
          replacements: { gameIds: ids },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
    hasMedia
      ? sequelize.query(
        `SELECT entity_id AS gameId,
                media_type AS mediaType,
                url
         FROM media_references
         WHERE entity_type = 'game'
           AND entity_id IN (:gameIds)`,
        {
          replacements: { gameIds: ids },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
    hasSnapshot
      ? sequelize.query(
        `SELECT game_id AS gameId,
                loose_price AS loosePrice,
                cib_price AS cibPrice,
                mint_price AS mintPrice,
                observation_count AS observationCount,
                last_observed_at AS lastObservedAt,
                trend_signal AS trendSignal,
                confidence_score AS confidenceScore,
                source_coverage AS sourceCoverage
         FROM market_snapshots
         WHERE game_id IN (:gameIds)`,
        {
          replacements: { gameIds: ids },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
    hasQuality
      ? sequelize.query(
        `SELECT entity_id AS gameId,
                completeness_score AS completenessScore,
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
           AND entity_id IN (:gameIds)`,
        {
          replacements: { gameIds: ids },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
    hasReleases
      ? sequelize.query(
        `SELECT game_id AS gameId,
                release_date AS releaseDate,
                release_year AS releaseYear,
                console_id AS consoleId,
                region_code AS regionCode,
                edition_name AS editionName
         FROM releases
         WHERE game_id IN (:gameIds)
         ORDER BY game_id ASC,
                  CASE WHEN edition_name = 'default' THEN 0 ELSE 1 END ASC,
                  release_year ASC`,
        {
          replacements: { gameIds: ids },
          type: QueryTypes.SELECT,
        }
      )
      : Promise.resolve([]),
  ])

  const editorialMap = new Map(editorialRows.map((row) => [String(row.gameId), row]))
  const groupedPeopleRows = new Map()
  for (const row of peopleRows) {
    const gameId = String(row.gameId)
    if (!groupedPeopleRows.has(gameId)) {
      groupedPeopleRows.set(gameId, [])
    }
    groupedPeopleRows.get(gameId).push(row)
  }

  const peopleMap = new Map()
  for (const [gameId, rows] of groupedPeopleRows.entries()) {
    peopleMap.set(gameId, buildPeopleBuckets(rows))
  }

  const mediaMap = new Map()
  for (const row of mediaRows) {
    const gameId = String(row.gameId)
    if (!mediaMap.has(gameId)) {
      mediaMap.set(gameId, {})
    }
    mediaMap.get(gameId)[String(row.mediaType || '').toLowerCase()] = row.url
  }

  const snapshotMap = new Map(snapshotRows.map((row) => [String(row.gameId), row]))
  const qualityMap = new Map(qualityRows.map((row) => [String(row.gameId), row]))
  const releaseMap = new Map()
  for (const row of releaseRows) {
    const gameId = String(row.gameId)
    if (!releaseMap.has(gameId)) {
      releaseMap.set(gameId, row)
    }
  }

  return new Map(ids.map((gameId) => [
    gameId,
    {
      editorial: editorialMap.get(gameId) || null,
      people: peopleMap.get(gameId) || { devTeam: [], composers: [] },
      media: mediaMap.get(gameId) || {},
      snapshot: snapshotMap.get(gameId) || null,
      quality: qualityMap.get(gameId) || null,
      release: releaseMap.get(gameId) || null,
    },
  ]))
}

module.exports = {
  loadCanonicalSupplements,
  loadCanonicalSupplementsMap,
}
