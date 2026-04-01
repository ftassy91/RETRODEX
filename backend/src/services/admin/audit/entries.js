'use strict'
// DATA: Sequelize via ../../../database and ../../../models - admin/back-office only

const { QueryTypes } = require('sequelize')

const { sequelize } = require('../../../database')
const Game = require('../../../models/Game')
const Console = require('../../../models/Console')
const { getConsoleById } = require('../../../lib/consoles')
const { getSourcePolicy } = require('../../../config/source-policy')
const { getSelectableGameAttributes } = require('../game-read-service')
const {
  freshnessScoreFromDate,
  scoreGameEntity,
  scoreConsoleEntity,
} = require('../../quality-scoring')
const {
  tableExists,
  loadPriceSupportMap,
  loadSourceCountMap,
  loadEditorialMap,
  loadCanonicalPeopleMap,
  loadMarketSnapshotMap,
  loadDuplicateMap,
} = require('./reads')
const { upsertQualityRecord } = require('./persistence')

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

function normalizeGameIds(gameIds = []) {
  return Array.from(new Set((gameIds || []).filter(Boolean).map((value) => String(value))))
}

async function getGameAuditEntries({ limit = 250, persist = false, gameIds = [] } = {}) {
  const gameAuditAttributes = await getSelectableGameAttributes([
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
  ])

  const ids = normalizeGameIds(gameIds)

  const [
    games,
    priceSupportMap,
    sourceCountMap,
    duplicateMap,
    editorialMap,
    canonicalPeopleMap,
    marketSnapshotMap,
  ] = await Promise.all([
    Game.findAll({
      where: ids.length ? { type: 'game', id: ids } : { type: 'game' },
      attributes: gameAuditAttributes,
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

module.exports = {
  getGameAuditEntries,
  getConsoleAuditEntries,
  getMarketAudit,
}
