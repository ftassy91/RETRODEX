'use strict'

const fs = require('fs')
const path = require('path')

const { QueryTypes } = require('sequelize')

const { sequelize } = require('../database')
const Game = require('../models/Game')
const Console = require('../models/Console')
const { getConsoleById } = require('../lib/consoles')
const { getSourcePolicy } = require('../config/source-policy')
const {
  freshnessScoreFromDate,
  scoreGameEntity,
  scoreConsoleEntity,
} = require('./quality-scoring')

const AUDIT_OUTPUT_DIR = path.resolve(__dirname, '../../../data/audit')

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

function resolvePolicySupport(keys) {
  const uniqueKeys = Array.from(new Set(keys.filter(Boolean)))
  if (!uniqueKeys.length) {
    const fallback = getSourcePolicy('unknown')
    return {
      policies: [fallback.name],
      legalFeasibility: fallback.legalFeasibility,
      sourceAvailability: fallback.sourceAvailability,
    }
  }

  const policies = uniqueKeys.map((key) => getSourcePolicy(key))
  return {
    policies: policies.map((policy) => policy.name),
    legalFeasibility: Math.max(...policies.map((policy) => policy.legalFeasibility)),
    sourceAvailability: Math.max(...policies.map((policy) => policy.sourceAvailability)),
  }
}

function detectGameSourceKeys(game) {
  const keys = []
  if (String(game.cover_url || game.coverImage || '').includes('igdb.com')) {
    keys.push('igdb')
  }
  if (String(game.manual_url || '').includes('archive.org')) {
    keys.push('internet_archive')
  }
  if (Number(game.source_confidence || 0) > 0) {
    keys.push('internal')
  }
  return keys
}

function detectConsoleSourceKeys(consoleItem, knowledgeEntry) {
  const keys = ['internal']
  if (knowledgeEntry) {
    keys.push('internal')
  }
  return keys
}

async function upsertQualityRecord(entry) {
  if (!(await tableExists('quality_records'))) {
    return
  }

  await sequelize.query(
    `INSERT INTO quality_records (
      entity_type,
      entity_id,
      completeness_score,
      confidence_score,
      source_coverage_score,
      freshness_score,
      overall_score,
      tier,
      missing_critical_fields,
      breakdown_json,
      priority_score,
      updated_at
    ) VALUES (
      :entityType,
      :entityId,
      :completenessScore,
      :confidenceScore,
      :sourceCoverageScore,
      :freshnessScore,
      :overallScore,
      :tier,
      :missingCriticalFields,
      :breakdownJson,
      :priorityScore,
      :updatedAt
    )
    ON CONFLICT(entity_type, entity_id) DO UPDATE SET
      completeness_score = excluded.completeness_score,
      confidence_score = excluded.confidence_score,
      source_coverage_score = excluded.source_coverage_score,
      freshness_score = excluded.freshness_score,
      overall_score = excluded.overall_score,
      tier = excluded.tier,
      missing_critical_fields = excluded.missing_critical_fields,
      breakdown_json = excluded.breakdown_json,
      priority_score = excluded.priority_score,
      updated_at = excluded.updated_at`,
    {
      replacements: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        completenessScore: entry.completenessScore,
        confidenceScore: entry.confidenceScore,
        sourceCoverageScore: entry.sourceCoverageScore,
        freshnessScore: entry.freshnessScore,
        overallScore: entry.overallScore,
        tier: entry.tier,
        missingCriticalFields: JSON.stringify(entry.missingCriticalFields || []),
        breakdownJson: JSON.stringify(entry.breakdown || {}),
        priorityScore: entry.priorityScore,
        updatedAt: new Date().toISOString(),
      },
      type: QueryTypes.INSERT,
    }
  )
}

async function getGameAuditEntries({ limit = 250, persist = false } = {}) {
  const [games, priceSupportMap, sourceCountMap, duplicateMap, editorialMap, canonicalPeopleMap, marketSnapshotMap] = await Promise.all([
    Game.findAll({
      where: { type: 'game' },
      attributes: [
        'id',
        'title',
        'console',
        'consoleId',
        'year',
        'developer',
        'genre',
        'metascore',
        'rarity',
        'summary',
        'synopsis',
        'dev_team',
        'ost_composers',
        'franch_id',
        'slug',
        'source_confidence',
        'loosePrice',
        'cibPrice',
        'mintPrice',
        'cover_url',
        'coverImage',
        'manual_url',
      ],
    }),
    loadPriceSupportMap(),
    loadSourceCountMap('game'),
    loadDuplicateMap(),
    loadEditorialMap(),
    loadCanonicalPeopleMap(),
    loadMarketSnapshotMap(),
  ])

  const entries = []

  for (const gameRecord of games) {
    const game = gameRecord.get({ plain: true })
    const editorial = editorialMap.get(String(game.id)) || {}
    const people = canonicalPeopleMap.get(String(game.id)) || { devTeam: [], composers: [] }
    const snapshot = marketSnapshotMap.get(String(game.id)) || {}
    const priceSupport = priceSupportMap.get(String(game.id)) || { observationCount: 0, lastObservedAt: null }
    const duplicateCount = duplicateMap.get(`${game.title}::${game.console}::${game.year}`) || 1
    const canonicalGame = {
      ...game,
      summary: game.summary || editorial.summary || null,
      synopsis: game.synopsis || editorial.synopsis || editorial.lore || null,
      lore: game.lore || editorial.lore || null,
      cheat_codes: game.cheat_codes || editorial.cheatCodes || null,
      dev_team: game.dev_team || (people.devTeam.length ? JSON.stringify(people.devTeam) : null),
      ost_composers: game.ost_composers || (people.composers.length ? JSON.stringify(people.composers) : null),
      loosePrice: game.loosePrice ?? snapshot.loosePrice ?? null,
      cibPrice: game.cibPrice ?? snapshot.cibPrice ?? null,
      mintPrice: game.mintPrice ?? snapshot.mintPrice ?? null,
    }
    const canonicalPriceSupport = {
      observationCount: Math.max(
        Number(priceSupport.observationCount || 0),
        Number(snapshot.observationCount || 0)
      ),
      lastObservedAt: snapshot.lastObservedAt || priceSupport.lastObservedAt || null,
    }
    const policySupport = resolvePolicySupport(detectGameSourceKeys(game))
    const entry = scoreGameEntity(canonicalGame, {
      priceObservationCount: canonicalPriceSupport.observationCount,
      lastObservedAt: canonicalPriceSupport.lastObservedAt,
      freshnessScore: freshnessScoreFromDate(canonicalPriceSupport.lastObservedAt),
      hasCoherentHistory: canonicalPriceSupport.observationCount >= 3,
      sourceRecordCount: sourceCountMap.get(String(game.id)) || 0,
      duplicateCount,
      legalFeasibility: policySupport.legalFeasibility,
      sourceAvailability: policySupport.sourceAvailability,
    })

    entry.metascore = canonicalGame.metascore ?? null
    entry.rarity = canonicalGame.rarity || null
    entry.observationCount = canonicalPriceSupport.observationCount
    entry.lastObservedAt = canonicalPriceSupport.lastObservedAt
    entry.policies = policySupport.policies

    if (persist) {
      await upsertQualityRecord(entry)
    }

    entries.push(entry)
  }

  return entries
    .sort((left, right) => right.priorityScore - left.priorityScore || left.title.localeCompare(right.title, 'fr', { sensitivity: 'base' }))
    .slice(0, limit)
}

async function getConsoleAuditEntries({ persist = false } = {}) {
  const [consoles, gamesByConsoleRows, sourceCountMap] = await Promise.all([
    Console.findAll({
      attributes: ['id', 'name', 'manufacturer', 'generation', 'releaseYear', 'slug'],
      order: [['name', 'ASC']],
    }),
    sequelize.query(
      `SELECT "consoleId" AS consoleId,
              console,
              COUNT(*) AS gamesCount,
              SUM(CASE WHEN COALESCE(loose_price, 0) > 0 OR COALESCE(cib_price, 0) > 0 OR COALESCE(mint_price, 0) > 0 THEN 1 ELSE 0 END) AS pricedGamesCount
       FROM games
       WHERE type = 'game'
       GROUP BY "consoleId", console`,
      { type: QueryTypes.SELECT }
    ),
    loadSourceCountMap('console'),
  ])

  const byId = new Map()
  const byName = new Map()
  for (const row of gamesByConsoleRows) {
    const counts = {
      gamesCount: Number(row.gamesCount || 0),
      pricedGamesCount: Number(row.pricedGamesCount || 0),
    }
    if (row.consoleId) {
      byId.set(String(row.consoleId), counts)
    }
    if (row.console) {
      byName.set(String(row.console), counts)
    }
  }

  const entries = []
  for (const record of consoles) {
    const consoleItem = record.get({ plain: true })
    const counts = byId.get(String(consoleItem.id))
      || byName.get(String(consoleItem.name))
      || { gamesCount: 0, pricedGamesCount: 0 }
    const knowledgeEntry = getConsoleById(consoleItem.slug || consoleItem.name || consoleItem.id)
    const policySupport = resolvePolicySupport(detectConsoleSourceKeys(consoleItem, knowledgeEntry))
    const entry = scoreConsoleEntity(consoleItem, {
      gamesCount: counts.gamesCount,
      pricedGamesCount: counts.pricedGamesCount,
      marketCoverage: counts.gamesCount > 0 ? Math.round((counts.pricedGamesCount / counts.gamesCount) * 100) : 0,
      freshnessScore: null,
      sourceRecordCount: sourceCountMap.get(String(consoleItem.id)) || 0,
      hasKnowledgeEntry: Boolean(knowledgeEntry),
      hasOverview: Boolean(knowledgeEntry?.overview),
      hasTeam: Boolean(knowledgeEntry?.team?.length),
      hasTechnicalSpecs: Boolean(knowledgeEntry?.technical_specs?.cpu || knowledgeEntry?.technical_specs?.media),
      hasLegacy: Boolean(knowledgeEntry?.legacy?.impact),
      legalFeasibility: policySupport.legalFeasibility,
      sourceAvailability: policySupport.sourceAvailability,
    })

    entry.gamesCount = counts.gamesCount
    entry.pricedGamesCount = counts.pricedGamesCount
    entry.policies = policySupport.policies

    if (persist) {
      await upsertQualityRecord(entry)
    }

    entries.push(entry)
  }

  return entries
}

async function getMarketAudit() {
  const hasPriceObservations = await tableExists('price_observations')
  const hasMarketSnapshots = await tableExists('market_snapshots')

  const [summaryRows, weakRows, snapshotRows] = await Promise.all([
    (hasPriceObservations
      ? sequelize.query(
        `SELECT COUNT(DISTINCT game_id) AS usableHistories,
                COUNT(*) AS totalObservations
         FROM price_observations`,
        { type: QueryTypes.SELECT }
      )
      : sequelize.query(
        `SELECT COUNT(DISTINCT game_id) AS usableHistories,
                SUM(CASE WHEN sale_date IS NOT NULL THEN 1 ELSE 0 END) AS totalObservations
         FROM price_history`,
        { type: QueryTypes.SELECT }
      )).catch(() => [{ usableHistories: 0, totalObservations: 0 }]),
    (hasMarketSnapshots
      ? sequelize.query(
        `SELECT COUNT(*) AS weakEntries
         FROM games g
         LEFT JOIN market_snapshots ms ON ms.game_id = g.id
         WHERE g.type = 'game'
           AND COALESCE(ms.loose_price, g.loose_price, 0) = 0
           AND COALESCE(ms.cib_price, g.cib_price, 0) = 0
           AND COALESCE(ms.mint_price, g.mint_price, 0) = 0`,
        { type: QueryTypes.SELECT }
      )
      : sequelize.query(
        `SELECT COUNT(*) AS weakEntries
         FROM games
         WHERE type = 'game'
           AND COALESCE(loose_price, 0) = 0
           AND COALESCE(cib_price, 0) = 0
           AND COALESCE(mint_price, 0) = 0`,
        { type: QueryTypes.SELECT }
      )),
    (hasMarketSnapshots
      ? sequelize.query(
        `SELECT COUNT(*) AS reliableSnapshots
         FROM market_snapshots
         WHERE COALESCE(loose_price, 0) > 0
            OR COALESCE(cib_price, 0) > 0
            OR COALESCE(mint_price, 0) > 0`,
        { type: QueryTypes.SELECT }
      )
      : sequelize.query(
        `SELECT COUNT(*) AS reliableSnapshots
         FROM games
         WHERE type = 'game'
           AND (
             COALESCE(loose_price, 0) > 0
             OR COALESCE(cib_price, 0) > 0
             OR COALESCE(mint_price, 0) > 0
           )`,
        { type: QueryTypes.SELECT }
      )),
  ])

  const summary = summaryRows[0] || {}
  return {
    usablePriceHistories: Number(summary.usableHistories || 0),
    reliablePriceSummaries: Number(snapshotRows[0]?.reliableSnapshots || 0),
    weakMarketEntries: Number(weakRows[0]?.weakEntries || 0),
    totalObservations: Number(summary.totalObservations || 0),
  }
}

async function getAuditSummary({ persist = false } = {}) {
  const [games, consoles, market] = await Promise.all([
    getGameAuditEntries({ limit: 5000, persist }),
    getConsoleAuditEntries({ persist }),
    getMarketAudit(),
  ])

  const tierCounts = games.reduce((acc, entry) => {
    acc[entry.tier] = (acc[entry.tier] || 0) + 1
    return acc
  }, {})

  const byPlatform = games.reduce((acc, entry) => {
    const key = entry.platform || 'Unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  return {
    games: {
      total: games.length,
      byPlatform,
      byQualityTier: tierCounts,
      missingPrices: games.filter((entry) => entry.breakdown.market < 30).length,
      missingSummaries: games.filter((entry) => entry.missingCriticalFields.includes('summary')).length,
      missingDevTeam: games.filter((entry) => entry.missingCriticalFields.includes('dev_team')).length,
      missingComposers: games.filter((entry) => entry.missingCriticalFields.includes('ost_composers')).length,
      missingSourceAttribution: games.filter((entry) => entry.missingCriticalFields.includes('source_attribution')).length,
      weakTrust: games.filter((entry) => entry.breakdown.sourceTrust < 50).length,
    },
    consoles: {
      total: consoles.length,
      byQualityTier: consoles.reduce((acc, entry) => {
        acc[entry.tier] = (acc[entry.tier] || 0) + 1
        return acc
      }, {}),
      completeness: consoles.map((entry) => ({
        id: entry.entityId,
        title: entry.title,
        completenessScore: entry.completenessScore,
        tier: entry.tier,
      })),
      priceReadiness: consoles.filter((entry) => entry.pricedGamesCount > 0).length,
      linkedToGames: consoles.filter((entry) => entry.gamesCount > 0).length,
    },
    market,
  }
}

function ensureAuditDir() {
  if (!fs.existsSync(AUDIT_OUTPUT_DIR)) {
    fs.mkdirSync(AUDIT_OUTPUT_DIR, { recursive: true })
  }
}

async function writeAuditReports() {
  ensureAuditDir()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const [summary, games, consoles, market] = await Promise.all([
    getAuditSummary({ persist: true }),
    getGameAuditEntries({ limit: 5000, persist: true }),
    getConsoleAuditEntries({ persist: true }),
    getMarketAudit(),
  ])

  const files = {
    summary: path.join(AUDIT_OUTPUT_DIR, `${timestamp}_summary.json`),
    games: path.join(AUDIT_OUTPUT_DIR, `${timestamp}_games.json`),
    consoles: path.join(AUDIT_OUTPUT_DIR, `${timestamp}_consoles.json`),
    market: path.join(AUDIT_OUTPUT_DIR, `${timestamp}_market.json`),
  }

  fs.writeFileSync(files.summary, JSON.stringify(summary, null, 2))
  fs.writeFileSync(files.games, JSON.stringify(games, null, 2))
  fs.writeFileSync(files.consoles, JSON.stringify(consoles, null, 2))
  fs.writeFileSync(files.market, JSON.stringify(market, null, 2))

  return { files, summary }
}

module.exports = {
  getAuditSummary,
  getGameAuditEntries,
  getConsoleAuditEntries,
  getMarketAudit,
  writeAuditReports,
}
