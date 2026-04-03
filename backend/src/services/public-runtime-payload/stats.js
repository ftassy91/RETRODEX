'use strict'

const { db, getStats } = require('../../../db_supabase')
const { normalizeGameRecord } = require('../../lib/normalize')
const { fetchAllSupabaseGames } = require('../public-game-reader')
const { isMissingSupabaseRelationError } = require('../public-supabase-utils')

function median(values) {
  if (!values.length) return 0

  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }

  return sorted[middle]
}

async function fetchStatsPayload() {
  const statsBase = await getStats().catch((err) => { console.warn('[stats] getStats failed:', err.message); return {} })
  const games = await fetchAllSupabaseGames()
  const { count: rawFranchiseCount, error: franchiseError } = await db
    .from('franchise_entries')
    .select('*', { count: 'exact', head: true })

  if (franchiseError && !isMissingSupabaseRelationError(franchiseError)) {
    throw new Error(franchiseError.message)
  }
  const franchiseCount = franchiseError ? 0 : rawFranchiseCount

  const byRarity = { LEGENDARY: 0, EPIC: 0, RARE: 0, UNCOMMON: 0, COMMON: 0 }
  const byPlatformMap = new Map()
  const looseValues = []
  let withSynopsis = 0

  for (const rawGame of games) {
    const game = normalizeGameRecord(rawGame)
    const rarity = Object.prototype.hasOwnProperty.call(byRarity, game.rarity) ? game.rarity : 'COMMON'
    byRarity[rarity] += 1

    const platform = String(game.console || 'Unknown').trim() || 'Unknown'
    byPlatformMap.set(platform, (byPlatformMap.get(platform) || 0) + 1)

    if (String(game.synopsis || '').trim()) {
      withSynopsis += 1
    }

    const loose = Number(game.loosePrice)
    if (Number.isFinite(loose) && loose > 0) {
      looseValues.push(loose)
    }
  }

  const byPlatform = Array.from(byPlatformMap.entries())
    .map(([platform, count]) => ({ platform, count }))
    .sort((left, right) => right.count - left.count || left.platform.localeCompare(right.platform))
    .slice(0, 10)

  const pricedGames = games
    .map((game) => normalizeGameRecord(game))
    .filter((game) => Number.isFinite(Number(game.loosePrice)) && Number(game.loosePrice) > 0)
    .sort((left, right) => Number(right.loosePrice) - Number(left.loosePrice))

  const top5Expensive = pricedGames.slice(0, 5).map((game) => ({
    id: game.id,
    title: game.title,
    platform: game.console,
    loosePrice: Number(game.loosePrice),
  }))

  const expensiveGame = pricedGames[0] || null
  const cheapestGame = [...pricedGames].sort((left, right) => Number(left.loosePrice) - Number(right.loosePrice))[0] || null

  const trustStats = { t1: 0, t3: 0, t4: 0 }
  pricedGames.forEach((game) => {
    const confidence = Number(game.source_confidence) || 0
    if (confidence >= 0.6) trustStats.t1 += 1
    else if (confidence >= 0.25) trustStats.t3 += 1
    else trustStats.t4 += 1
  })

  const avgLoose = looseValues.length
    ? looseValues.reduce((sum, value) => sum + value, 0) / looseValues.length
    : 0

  return {
    ok: true,
    total_games: Number(statsBase.total_games) || games.length,
    total_platforms: byPlatformMap.size,
    priced_games: pricedGames.length,
    with_synopsis: withSynopsis,
    by_rarity: byRarity,
    by_platform: byPlatform,
    median_loose: Math.round(median(looseValues) * 100) / 100,
    average_loose: Math.round(avgLoose * 100) / 100,
    top_5_expensive: top5Expensive,
    most_expensive: expensiveGame ? {
      id: expensiveGame.id,
      title: expensiveGame.title,
      platform: expensiveGame.console,
      loosePrice: Number(expensiveGame.loosePrice),
    } : null,
    cheapest_priced: cheapestGame ? {
      id: cheapestGame.id,
      title: cheapestGame.title,
      platform: cheapestGame.console,
      loosePrice: Number(cheapestGame.loosePrice),
    } : null,
    total_franchises: franchiseCount || 0,
    source_confidence: trustStats,
    trust_stats: trustStats,
  }
}

module.exports = {
  fetchStatsPayload,
}
