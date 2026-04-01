'use strict'
// DATA: admin audit aggregation only; no direct route/runtime use

const {
  getGameAuditEntries,
  getConsoleAuditEntries,
  getMarketAudit,
} = require('./entries')

async function getAuditSummary({ persist = false } = {}) {
  const [games, consoles, market] = await Promise.all([
    getGameAuditEntries({ limit: 5000, persist }),
    getConsoleAuditEntries({ persist }),
    getMarketAudit(),
  ])

  const countMissing = (fieldName, filterFn = null) => games.filter((entry) => {
    if (typeof filterFn === 'function' && !filterFn(entry)) {
      return false
    }
    return entry.missingCriticalFields.includes(fieldName)
  }).length

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
      missingSummaries: countMissing('summary'),
      missingSummariesPublished: countMissing('summary', (entry) => entry.curationStatus === 'published'),
      missingDevTeam: countMissing('dev_team'),
      missingDevTeamPublished: countMissing('dev_team', (entry) => entry.curationStatus === 'published'),
      missingComposers: countMissing('ost_composers'),
      missingComposersTierA: countMissing('ost_composers', (entry) => entry.tier === 'Tier A'),
      missingComposersPublished: countMissing('ost_composers', (entry) => entry.curationStatus === 'published'),
      missingComposersPublishedTierA: countMissing('ost_composers', (entry) => entry.curationStatus === 'published' && entry.tier === 'Tier A'),
      missingSourceAttribution: countMissing('source_attribution'),
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

function toPriorityItem(entry) {
  return {
    entityType: entry.entityType,
    entityId: entry.entityId,
    title: entry.title,
    platform: entry.platform || null,
    tier: entry.tier,
    priorityScore: entry.priorityScore,
    completenessScore: entry.completenessScore,
    confidenceScore: entry.confidenceScore,
    sourceCoverageScore: entry.sourceCoverageScore,
    freshnessScore: entry.freshnessScore,
    missingCriticalFields: entry.missingCriticalFields || [],
    breakdown: entry.breakdown || {},
    policies: entry.policies || [],
  }
}

async function getPriorityQueue({ entityType = 'all', limit = 100, persist = false } = {}) {
  const normalizedType = String(entityType || 'all').trim().toLowerCase()
  const shouldLoadGames = normalizedType === 'all' || normalizedType === 'game'
  const shouldLoadConsoles = normalizedType === 'all' || normalizedType === 'console'

  const [games, consoles] = await Promise.all([
    shouldLoadGames ? getGameAuditEntries({ limit: 5000, persist }) : Promise.resolve([]),
    shouldLoadConsoles ? getConsoleAuditEntries({ persist }) : Promise.resolve([]),
  ])

  return [...games, ...consoles]
    .map(toPriorityItem)
    .sort((left, right) => right.priorityScore - left.priorityScore
      || String(left.title || '').localeCompare(String(right.title || ''), 'fr', { sensitivity: 'base' }))
    .slice(0, limit)
}

module.exports = {
  getAuditSummary,
  getPriorityQueue,
}
