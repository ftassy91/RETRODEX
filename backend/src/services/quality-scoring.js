'use strict'

const STRATEGIC_PLATFORMS = new Set([
  'nintendo ds',
  'nintendo 3ds',
  'playstation',
  'super nintendo',
  'sega genesis',
  'nintendo 64',
  'sega saturn',
  'game boy advance',
])

function normalizePlatform(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

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

function normalizeList(value) {
  const parsed = parseMaybeJson(value)
  if (Array.isArray(parsed)) {
    return parsed.filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/[,\n;]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function numeric(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function freshnessScoreFromDate(value) {
  if (!value) {
    return 0
  }

  const observedAt = new Date(value)
  if (Number.isNaN(observedAt.getTime())) {
    return 0
  }

  const diffMs = Date.now() - observedAt.getTime()
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffDays <= 30) return 100
  if (diffDays <= 90) return 75
  if (diffDays <= 180) return 50
  if (diffDays <= 365) return 25
  return 0
}

function toTier(score, missingCriticalFields) {
  if (score >= 85 && !missingCriticalFields.length) return 'Tier A'
  if (score >= 70) return 'Tier B'
  if (score >= 50) return 'Tier C'
  return 'Tier D'
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function computePriorityScore({
  userValue,
  businessValue,
  missingCriticality,
  sourceAvailability,
  legalFeasibility,
  catalogImportance,
}) {
  const weighted = (
    (0.35 * userValue)
    + (0.25 * businessValue)
    + (0.20 * missingCriticality)
    + (0.20 * catalogImportance)
  )

  return Math.round(legalFeasibility * sourceAvailability * weighted * 100) / 100
}

function scoreGameEntity(game, support = {}) {
  const missingCriticalFields = []
  const platformKey = normalizePlatform(game.console)
  const devTeam = normalizeList(game.dev_team)
  const composers = normalizeList(game.ost_composers)
  const synopsisPresent = Boolean(game.summary || game.synopsis)
  const hasPriceSignal = ['loosePrice', 'cibPrice', 'mintPrice'].some((key) => numeric(game[key]) > 0)

  const identityFields = [
    ['title', game.title],
    ['console', game.console],
    ['year', game.year],
    ['slug', game.slug],
  ]
  const identityScore = clampScore((identityFields.filter(([, value]) => Boolean(value)).length / identityFields.length) * 100)

  const marketSubscores = [
    hasPriceSignal ? 30 : 0,
    support.priceObservationCount >= 3 ? 30 : support.priceObservationCount > 0 ? 15 : 0,
    support.hasCoherentHistory ? 20 : 0,
    support.freshnessScore > 0 ? 20 : 0,
  ]
  const marketScore = clampScore(marketSubscores.reduce((sum, value) => sum + value, 0))

  const sourceTrustScore = clampScore(
    (support.sourceRecordCount > 0 ? 45 : 0)
    + (numeric(game.source_confidence, 0) * 35)
    + (support.legalFeasibility * 20)
  )

  const editorialScore = clampScore(
    (synopsisPresent ? 35 : 0)
    + (Boolean(game.developer) ? 20 : 0)
    + (devTeam.length ? 20 : 0)
    + (composers.length ? 15 : 0)
    + (Boolean(game.franch_id) ? 10 : 0)
  )

  const structuralScore = clampScore(
    (Boolean(game.consoleId) ? 35 : 0)
    + (Boolean(game.slug) ? 25 : 0)
    + (support.duplicateCount > 1 ? 0 : 20)
    + (Boolean(game.id) ? 20 : 0)
  )

  for (const [field, value] of identityFields) {
    if (!value) {
      missingCriticalFields.push(field)
    }
  }

  if (!synopsisPresent) {
    missingCriticalFields.push('summary')
  }
  if (!devTeam.length) {
    missingCriticalFields.push('dev_team')
  }
  if (!composers.length) {
    missingCriticalFields.push('ost_composers')
  }
  if (support.sourceRecordCount === 0) {
    missingCriticalFields.push('source_attribution')
  }

  const overallScore = clampScore(
    (identityScore * 0.30)
    + (marketScore * 0.25)
    + (sourceTrustScore * 0.20)
    + (editorialScore * 0.15)
    + (structuralScore * 0.10)
  )

  const userValue = Math.min(1, (
    (numeric(game.metascore) >= 85 ? 0.45 : numeric(game.metascore) >= 75 ? 0.3 : 0.15)
    + ({ LEGENDARY: 0.35, EPIC: 0.25, RARE: 0.18, UNCOMMON: 0.1, COMMON: 0.05 }[game.rarity] || 0.05)
    + (STRATEGIC_PLATFORMS.has(platformKey) ? 0.2 : 0.1)
  ))
  const businessValue = Math.min(1, (
    (hasPriceSignal ? 0.2 : 0.45)
    + (numeric(game.mintPrice) > 0 ? 0.2 : 0.05)
    + ({ LEGENDARY: 0.25, EPIC: 0.18, RARE: 0.12 }[game.rarity] || 0.05)
  ))
  const missingCriticality = Math.min(1, missingCriticalFields.length / 6)
  const sourceAvailability = support.sourceAvailability
  const legalFeasibility = support.legalFeasibility
  const catalogImportance = STRATEGIC_PLATFORMS.has(platformKey) ? 1 : 0.55

  return {
    entityType: 'game',
    entityId: game.id,
    title: game.title,
    platform: game.console,
    completenessScore: clampScore((identityScore + editorialScore) / 2),
    confidenceScore: clampScore((sourceTrustScore + structuralScore) / 2),
    sourceCoverageScore: clampScore(support.sourceRecordCount > 0 ? 100 : numeric(game.source_confidence, 0) * 100),
    freshnessScore: support.freshnessScore,
    overallScore,
    tier: toTier(overallScore, missingCriticalFields.filter((field) => ['title', 'console', 'year', 'source_attribution'].includes(field))),
    missingCriticalFields,
    breakdown: {
      identity: identityScore,
      market: marketScore,
      sourceTrust: sourceTrustScore,
      editorial: editorialScore,
      structural: structuralScore,
    },
    priorityScore: computePriorityScore({
      userValue,
      businessValue,
      missingCriticality,
      sourceAvailability,
      legalFeasibility,
      catalogImportance,
    }),
  }
}

function scoreConsoleEntity(consoleItem, support = {}) {
  const missingCriticalFields = []
  const identityFields = [
    ['name', consoleItem.name],
    ['manufacturer', consoleItem.manufacturer],
    ['releaseYear', consoleItem.releaseYear],
    ['slug', consoleItem.slug],
  ]

  const identityScore = clampScore((identityFields.filter(([, value]) => Boolean(value)).length / identityFields.length) * 100)
  const marketScore = clampScore(
    (support.gamesCount > 0 ? 25 : 0)
    + (support.pricedGamesCount > 0 ? 35 : 0)
    + (support.marketCoverage >= 50 ? 20 : support.marketCoverage >= 20 ? 10 : 0)
    + (support.freshnessScore > 0 ? 20 : 0)
  )
  const sourceTrustScore = clampScore(
    (support.sourceRecordCount > 0 ? 50 : 0)
    + (support.hasKnowledgeEntry ? 30 : 0)
    + (support.legalFeasibility * 20)
  )
  const editorialScore = clampScore(
    (support.hasOverview ? 40 : 0)
    + (support.hasTeam ? 25 : 0)
    + (support.hasTechnicalSpecs ? 25 : 0)
    + (support.hasLegacy ? 10 : 0)
  )
  const structuralScore = clampScore(
    (support.gamesCount > 0 ? 35 : 10)
    + (Boolean(consoleItem.id) ? 25 : 0)
    + (Boolean(consoleItem.slug) ? 20 : 0)
    + (Boolean(consoleItem.generation) ? 20 : 0)
  )

  for (const [field, value] of identityFields) {
    if (!value) {
      missingCriticalFields.push(field)
    }
  }
  if (!support.hasOverview) {
    missingCriticalFields.push('overview')
  }
  if (support.sourceRecordCount === 0) {
    missingCriticalFields.push('source_attribution')
  }

  const overallScore = clampScore(
    (identityScore * 0.30)
    + (marketScore * 0.25)
    + (sourceTrustScore * 0.20)
    + (editorialScore * 0.15)
    + (structuralScore * 0.10)
  )

  const catalogImportance = normalizePlatform(consoleItem.name).includes('nintendo ds') || normalizePlatform(consoleItem.name).includes('nintendo 3ds')
    ? 1
    : 0.7

  return {
    entityType: 'console',
    entityId: consoleItem.id,
    title: consoleItem.name,
    platform: consoleItem.name,
    completenessScore: clampScore((identityScore + editorialScore) / 2),
    confidenceScore: clampScore((sourceTrustScore + structuralScore) / 2),
    sourceCoverageScore: clampScore(support.sourceRecordCount > 0 ? 100 : support.hasKnowledgeEntry ? 70 : 30),
    freshnessScore: support.freshnessScore,
    overallScore,
    tier: toTier(overallScore, missingCriticalFields.filter((field) => ['name', 'manufacturer', 'releaseYear', 'source_attribution'].includes(field))),
    missingCriticalFields,
    breakdown: {
      identity: identityScore,
      market: marketScore,
      sourceTrust: sourceTrustScore,
      editorial: editorialScore,
      structural: structuralScore,
    },
    priorityScore: computePriorityScore({
      userValue: support.gamesCount > 100 ? 0.9 : support.gamesCount > 25 ? 0.65 : 0.4,
      businessValue: support.pricedGamesCount === 0 ? 0.7 : 0.45,
      missingCriticality: Math.min(1, missingCriticalFields.length / 5),
      sourceAvailability: support.sourceAvailability,
      legalFeasibility: support.legalFeasibility,
      catalogImportance,
    }),
  }
}

module.exports = {
  freshnessScoreFromDate,
  normalizeList,
  scoreGameEntity,
  scoreConsoleEntity,
}
