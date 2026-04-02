'use strict'

const { QueryTypes } = require('sequelize')

const { sequelize } = require('../../../database')
const Console = require('../../../models/Console')
const { getConsoleById } = require('../../../lib/consoles')
const { scoreConsoleEntity } = require('../../quality-scoring')
const { loadSourceCountMap } = require('./reads')
const { upsertQualityRecord } = require('./persistence')
const {
  resolvePolicySupport,
  detectConsoleSourceKeys,
} = require('./source-support')

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

module.exports = {
  getConsoleAuditEntries,
}
