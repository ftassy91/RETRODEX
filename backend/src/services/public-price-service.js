'use strict'

const {
  fetchGamesMap,
  fetchRecentSales,
  fetchPriceSummaryRows,
  fetchPriceSales,
  getCutoffStr,
  isMissingPriceHistoryTable,
  roundPrice,
} = require('./public-price/queries')

function computeFreshnessLabel(freshnessDays) {
  if (!Number.isFinite(freshnessDays)) {
    return null
  }
  if (freshnessDays < 30) return 'recent'
  if (freshnessDays < 90) return 'aging'
  if (freshnessDays < 180) return 'stale'
  return 'outdated'
}

function aggregateSourceMeta(rows) {
  const normalizedRows = Array.isArray(rows) ? rows : []
  const sources = Array.from(new Set(
    normalizedRows
      .map((row) => String(row?.source || row?.source_name || '').trim())
      .filter(Boolean)
  ))
  const freshnessValues = normalizedRows
    .map((row) => Number(row?.freshness_days))
    .filter((value) => Number.isFinite(value))
  const confidenceValues = normalizedRows
    .map((row) => Number(row?.confidence_pct))
    .filter((value) => Number.isFinite(value))
  const verifiedCount = normalizedRows.filter((row) => row?.is_verified === true).length
  const freshnessDays = freshnessValues.length ? Math.min(...freshnessValues) : null
  const confidencePct = confidenceValues.length
    ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length)
    : null

  return {
    sources,
    sourceCount: sources.length,
    freshnessDays,
    freshness: computeFreshnessLabel(freshnessDays),
    confidencePct,
    verifiedCount,
  }
}

async function fetchRecentPriceSalesPayload(limit) {
  try {
    const sales = await fetchRecentSales(limit)
    const gamesMap = await fetchGamesMap(sales.map((sale) => sale.game_id))
    const rows = sales.map((sale) => {
      const game = gamesMap.get(sale.game_id) || {}
      return {
        ...sale,
        title: game.title || null,
        console: game.console || null,
        rarity: game.rarity || null,
      }
    })

    return { ok: true, count: rows.length, sales: rows }
  } catch (error) {
    if (isMissingPriceHistoryTable(error)) {
      return { ok: true, count: 0, sales: [] }
    }

    throw error
  }
}

async function fetchGamePriceSummaryPayload(gameId, months) {
  try {
    const rows = await fetchPriceSummaryRows(gameId, getCutoffStr(months))
    const buckets = {}

    for (const row of rows) {
      const condition = String(row.condition || 'loose').toLowerCase()
      if (!['loose', 'cib', 'mint'].includes(condition)) {
        continue
      }

      if (!buckets[condition]) {
        buckets[condition] = { prices: [], dates: [], rows: [] }
      }

      buckets[condition].prices.push(Number(row.price))
      buckets[condition].dates.push(row.sale_date)
      buckets[condition].rows.push(row)
    }

    const byCondition = ['loose', 'cib', 'mint']
      .filter((condition) => buckets[condition] && buckets[condition].prices.length > 0)
      .map((condition) => {
        const prices = buckets[condition].prices.filter((price) => Number.isFinite(price))
        const dates = [...buckets[condition].dates].sort()
        const sorted = [...prices].sort((left, right) => left - right)
        const total = sorted.length
        const middle = Math.floor(total / 2)
        const median = total % 2 === 0
          ? (sorted[middle - 1] + sorted[middle]) / 2
          : sorted[middle]
        const sourceMeta = aggregateSourceMeta(buckets[condition].rows)

        return {
          condition,
          count: total,
          min: total ? roundPrice(sorted[0]) : null,
          max: total ? roundPrice(sorted[total - 1]) : null,
          median: total ? roundPrice(median) : null,
          avg: total ? roundPrice(sorted.reduce((sum, price) => sum + price, 0) / total) : null,
          firstDate: dates[0] || null,
          lastDate: dates[dates.length - 1] || null,
          sourceCount: sourceMeta.sourceCount,
          sources: sourceMeta.sources,
          freshnessDays: sourceMeta.freshnessDays,
          freshness: sourceMeta.freshness,
          confidencePct: sourceMeta.confidencePct,
          verifiedCount: sourceMeta.verifiedCount,
        }
      })

    const allPrices = rows
      .map((row) => Number(row.price))
      .filter((price) => Number.isFinite(price))
    const sourceMeta = aggregateSourceMeta(rows)

    return {
      ok: true,
      gameId,
      period: `${months} months`,
      totalSales: rows.length,
      lastSale: rows[0]?.sale_date || null,
      minPrice: allPrices.length ? roundPrice(Math.min(...allPrices)) : null,
      maxPrice: allPrices.length ? roundPrice(Math.max(...allPrices)) : null,
      sourceCount: sourceMeta.sourceCount,
      sources: sourceMeta.sources,
      freshnessDays: sourceMeta.freshnessDays,
      freshness: sourceMeta.freshness,
      confidencePct: sourceMeta.confidencePct,
      verifiedCount: sourceMeta.verifiedCount,
      byCondition,
    }
  } catch (error) {
    if (isMissingPriceHistoryTable(error)) {
      return {
        ok: true,
        gameId,
        period: `${months} months`,
        totalSales: 0,
        lastSale: null,
        minPrice: null,
        maxPrice: null,
        sourceCount: 0,
        sources: [],
        freshnessDays: null,
        freshness: null,
        confidencePct: null,
        verifiedCount: 0,
        byCondition: [],
      }
    }

    throw error
  }
}

async function fetchGamePriceSalesPayload(gameId, condition, limit) {
  try {
    const sales = await fetchPriceSales(gameId, condition, limit)

    return {
      ok: true,
      gameId,
      count: sales.length,
      sales,
    }
  } catch (error) {
    if (isMissingPriceHistoryTable(error)) {
      return {
        ok: true,
        gameId,
        count: 0,
        sales: [],
      }
    }

    throw error
  }
}

module.exports = {
  fetchRecentPriceSalesPayload,
  fetchGamePriceSummaryPayload,
  fetchGamePriceSalesPayload,
}
