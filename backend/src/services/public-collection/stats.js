'use strict'

const { normalizeStoredCollectionCondition } = require('./core')
const { listCollectionItems } = require('./storage')

function getCollectionValueByCondition(item) {
  const game = item?.game
  if (!game) {
    return 0
  }

  const loose = Number(game.loosePrice || 0)
  const cib = Number(game.cibPrice || 0)
  const mint = Number(game.mintPrice || 0)
  const condition = normalizeStoredCollectionCondition(item?.condition)

  if (condition === 'CIB') return cib
  if (condition === 'Mint') return mint
  return loose
}

function hasPriceCurrency(item) {
  return item?.game?.priceCurrency != null
}

function computeConfidenceSummary(items) {
  const tiers = items.map((item) => String(item?.game?.priceConfidenceTier || 'unknown').toLowerCase())
  if (!tiers.length) return 'unknown'
  const distinct = new Set(tiers)
  if (distinct.size === 1) return tiers[0]
  return 'mixed'
}

async function getCollectionStats(options = {}) {
  const items = await listCollectionItems({
    ...options,
    listType: 'owned',
  })

  const byPlatformMap = new Map()
  // Confidence distribution across all owned items
  const confidenceDist = { high: 0, medium: 0, low: 0, unknown: 0 }
  let totalLoose = 0
  let totalCib = 0
  let totalMint = 0
  let totalPaid = 0

  for (const item of items) {
    if (!item.game) {
      continue
    }

    const tier = String(item.game.priceConfidenceTier || 'unknown').toLowerCase()
    if (tier in confidenceDist) {
      confidenceDist[tier] += 1
    } else {
      confidenceDist.unknown += 1
    }

    // Monetary aggregates: only include items with known price_currency.
    // Items with priceCurrency === null have no validated pipeline data —
    // including them would mix untracked prices into the portfolio total.
    if (!hasPriceCurrency(item)) {
      const platform = item.game.console || 'Unknown'
      if (!byPlatformMap.has(platform)) {
        byPlatformMap.set(platform, { platform, count: 0, total_loose: 0 })
      }
      byPlatformMap.get(platform).count += 1
      totalPaid += Number(item.price_paid) || 0
      continue
    }

    const platform = item.game.console || 'Unknown'
    const resolvedValue = getCollectionValueByCondition(item)

    if (item.condition === 'CIB') totalCib += resolvedValue
    else if (item.condition === 'Mint') totalMint += resolvedValue
    else totalLoose += resolvedValue

    totalPaid += Number(item.price_paid) || 0

    if (!byPlatformMap.has(platform)) {
      byPlatformMap.set(platform, { platform, count: 0, total_loose: 0 })
    }

    const bucket = byPlatformMap.get(platform)
    bucket.count += 1
    bucket.total_loose += resolvedValue
  }

  const by_platform = Array.from(byPlatformMap.values())
    .map((entry) => ({
      platform: entry.platform,
      count: entry.count,
      total_loose: Math.round(entry.total_loose * 100) / 100,
    }))
    .sort((left, right) => left.platform.localeCompare(right.platform))

  // Top 5 by loose value — restrict to items with known price currency
  const top5 = items
    .filter(hasPriceCurrency)
    .slice()
    .sort((left, right) => Number(right.game?.loosePrice || 0) - Number(left.game?.loosePrice || 0))
    .slice(0, 5)
    .map((item) => ({
      id: item.game.id,
      title: item.game.title,
      platform: item.game.console,
      loosePrice: Number(item.game.loosePrice || 0),
      rarity: item.game.rarity,
    }))

  return {
    ok: true,
    count: items.length,
    total_loose: Math.round(totalLoose * 100) / 100,
    total_cib: Math.round(totalCib * 100) / 100,
    total_mint: Math.round(totalMint * 100) / 100,
    total_paid: Math.round(totalPaid * 100) / 100,
    profit_estimate: Math.round((totalLoose - totalPaid) * 100) / 100,
    confidence: computeConfidenceSummary(items),
    price_confidence_distribution: confidenceDist,
    by_platform,
    top5,
  }
}

module.exports = {
  getCollectionStats,
}
