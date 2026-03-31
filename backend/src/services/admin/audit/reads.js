'use strict'
// DATA: Sequelize via ../../../database and ../../../models - admin/back-office only

const { QueryTypes } = require('sequelize')

const { sequelize } = require('../../../database')

function tableNamesMatch(tableName, target) {
  return String(tableName || '').replace(/"/g, '').toLowerCase() === String(target).toLowerCase()
}

async function tableExists(target) {
  const tables = await sequelize.getQueryInterface().showAllTables()
  return (tables || []).some((tableName) => tableNamesMatch(tableName, target))
}

async function loadPriceSupportMap() {
  if (!(await tableExists('price_history'))) {
    return new Map()
  }

  const rows = await sequelize.query(
    `SELECT game_id AS gameId,
            COUNT(*) AS observationCount,
            MAX(sale_date) AS lastObservedAt
     FROM price_history
     GROUP BY game_id`,
    { type: QueryTypes.SELECT }
  )

  return new Map(rows.map((row) => [
    String(row.gameId),
    {
      observationCount: Number(row.observationCount || 0),
      lastObservedAt: row.lastObservedAt || null,
    },
  ]))
}

async function loadSourceCountMap(entityType) {
  if (!(await tableExists('source_records'))) {
    return new Map()
  }

  const rows = await sequelize.query(
    `SELECT entity_id AS entityId, COUNT(*) AS sourceCount
     FROM source_records
     WHERE entity_type = :entityType
     GROUP BY entity_id`,
    {
      replacements: { entityType },
      type: QueryTypes.SELECT,
    }
  )

  return new Map(rows.map((row) => [String(row.entityId), Number(row.sourceCount || 0)]))
}

async function loadEditorialMap() {
  if (!(await tableExists('game_editorial'))) {
    return new Map()
  }

  const rows = await sequelize.query(
    `SELECT game_id AS gameId,
            summary,
            synopsis,
            lore,
            dev_notes AS devNotes,
            cheat_codes AS cheatCodes
     FROM game_editorial`,
    { type: QueryTypes.SELECT }
  )

  return new Map(rows.map((row) => [String(row.gameId), row]))
}

async function loadCanonicalPeopleMap() {
  if (!(await tableExists('game_people')) || !(await tableExists('people'))) {
    return new Map()
  }

  const rows = await sequelize.query(
    `SELECT gp.game_id AS gameId,
            gp.role AS role,
            gp.billing_order AS billingOrder,
            gp.confidence AS confidence,
            p.name AS name
     FROM game_people gp
     INNER JOIN people p ON p.id = gp.person_id
     ORDER BY gp.game_id ASC, COALESCE(gp.billing_order, 9999) ASC, p.name ASC`,
    { type: QueryTypes.SELECT }
  )

  const map = new Map()
  for (const row of rows) {
    const gameId = String(row.gameId)
    if (!map.has(gameId)) {
      map.set(gameId, { devTeam: [], composers: [] })
    }

    const bucket = map.get(gameId)
    const normalizedRole = String(row.role || '').toLowerCase()
    const entry = {
      name: row.name,
      role: row.role,
      confidence: Number(row.confidence || 0),
    }

    if (normalizedRole.includes('composer') || normalizedRole.includes('music')) {
      bucket.composers.push(entry)
    } else {
      bucket.devTeam.push(entry)
    }
  }

  return map
}

async function loadMarketSnapshotMap() {
  if (!(await tableExists('market_snapshots'))) {
    return new Map()
  }

  const rows = await sequelize.query(
    `SELECT game_id AS gameId,
            loose_price AS loosePrice,
            cib_price AS cibPrice,
            mint_price AS mintPrice,
            observation_count AS observationCount,
            last_observed_at AS lastObservedAt,
            trend_signal AS trendSignal,
            confidence_score AS confidenceScore,
            source_coverage AS sourceCoverage
     FROM market_snapshots`,
    { type: QueryTypes.SELECT }
  )

  return new Map(rows.map((row) => [String(row.gameId), row]))
}

async function loadCanonicalMediaMap() {
  if (!(await tableExists('media_references'))) {
    return new Map()
  }

  const rows = await sequelize.query(
    `SELECT entity_id AS gameId,
            media_type AS mediaType,
            url
     FROM media_references
     WHERE entity_type = 'game'`,
    { type: QueryTypes.SELECT }
  )

  const map = new Map()
  for (const row of rows) {
    const gameId = String(row.gameId)
    if (!map.has(gameId)) {
      map.set(gameId, {})
    }
    map.get(gameId)[String(row.mediaType || '').toLowerCase()] = row.url
  }

  return map
}

async function loadDuplicateMap() {
  const rows = await sequelize.query(
    `SELECT title, console, year, COUNT(*) AS duplicateCount
     FROM games
     WHERE type = 'game'
     GROUP BY title, console, year
     HAVING COUNT(*) > 1`,
    { type: QueryTypes.SELECT }
  )

  return new Map(rows.map((row) => [
    `${row.title}::${row.console}::${row.year}`,
    Number(row.duplicateCount || 0),
  ]))
}

module.exports = {
  tableExists,
  loadPriceSupportMap,
  loadSourceCountMap,
  loadEditorialMap,
  loadCanonicalPeopleMap,
  loadMarketSnapshotMap,
  loadCanonicalMediaMap,
  loadDuplicateMap,
}
