'use strict'

const Game = require('../../../models/Game')
const { getSelectableGameAttributes } = require('../game-read-service')
const {
  freshnessScoreFromDate,
  scoreGameEntity,
} = require('../../quality-scoring')
const {
  loadPriceSupportMap,
  loadSourceCountMap,
  loadEditorialMap,
  loadCanonicalPeopleMap,
  loadMarketSnapshotMap,
  loadDuplicateMap,
} = require('./reads')
const { upsertQualityRecord } = require('./persistence')
const {
  resolvePolicySupport,
  detectGameSourceKeys,
} = require('./source-support')

function normalizeGameIds(gameIds = []) {
  return Array.from(new Set((gameIds || []).filter(Boolean).map((value) => String(value))))
}

function buildCanonicalGame(game, editorial, people, snapshot) {
  return {
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
}

function buildCanonicalPriceSupport(priceSupport, snapshot) {
  return {
    observationCount: Math.max(
      Number(priceSupport.observationCount || 0),
      Number(snapshot.observationCount || 0)
    ),
    lastObservedAt: snapshot.lastObservedAt || priceSupport.lastObservedAt || null,
  }
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

    const canonicalGame = buildCanonicalGame(game, editorial, people, snapshot)
    const canonicalPriceSupport = buildCanonicalPriceSupport(priceSupport, snapshot)
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

module.exports = {
  buildCanonicalGame,
  buildCanonicalPriceSupport,
  getGameAuditEntries,
  normalizeGameIds,
}
