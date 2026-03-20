#!/usr/bin/env node
'use strict'

/**
 * RetroDex - Import Editorial Prices
 *
 * Reads data/prices_editorial.json and:
 * 1. Syncs CommunityReport + RetrodexIndex
 * 2. Inserts editorial sales into community_reports
 * 3. Upserts retrodex_index for each populated condition
 * 4. Updates Games.loosePrice / cibPrice / mintPrice
 * 5. Prints a compact summary
 *
 * Usage:
 *   node scripts/market/import_editorial.js
 *   node scripts/market/import_editorial.js --dry-run
 *   node scripts/market/import_editorial.js --stats
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../..')
const DATA_FILE = path.join(ROOT, 'data', 'prices_editorial.json')
const DRY_RUN = process.argv.includes('--dry-run')
const STATS_ONLY = process.argv.includes('--stats')

const EDITORIAL_TRUST_SCORE = 0.95
const EDITORIAL_USER_ID = 'retrodex_editorial'
const CONDITION_MAP = { loose: 'Loose', cib: 'CIB', mint: 'Mint' }

function median(values) {
  if (!values || values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function percentile(values, p) {
  if (!values || values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

function computeConfidence(sales, sampleCount, lastSaleDate) {
  if (!sampleCount || sampleCount === 0) return 0

  let score = 0
  score += Math.min(40, sampleCount * 4)

  if (lastSaleDate) {
    const daysSince = (Date.now() - new Date(lastSaleDate).getTime()) / 86400000
    if (daysSince < 30) score += 30
    else if (daysSince < 90) score += 20
    else if (daysSince < 180) score += 10
    else if (daysSince < 365) score += 5
  }

  if (sales && sales.length >= 3) {
    const prices = sales.map((sale) => sale.price)
    const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length
    const variance = prices.reduce((sum, price) => sum + (price - avg) ** 2, 0) / prices.length
    const stddev = Math.sqrt(variance)
    const cv = avg > 0 ? stddev / avg : 1

    if (cv < 0.15) score += 30
    else if (cv < 0.3) score += 20
    else if (cv < 0.5) score += 10
  }

  return Math.min(100, Math.round(score))
}

function computeTrend(sales) {
  if (!sales || sales.length < 4) {
    return { trend: 'stable', trend_pct: 0 }
  }

  const sorted = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date))
  const half = Math.floor(sorted.length / 2)
  const recent = sorted.slice(0, half).map((sale) => sale.price)
  const older = sorted.slice(half).map((sale) => sale.price)

  const avgRecent = recent.reduce((sum, price) => sum + price, 0) / recent.length
  const avgOlder = older.reduce((sum, price) => sum + price, 0) / older.length

  if (avgOlder === 0) {
    return { trend: 'stable', trend_pct: 0 }
  }

  const pct = ((avgRecent - avgOlder) / avgOlder) * 100
  const trend = pct > 5 ? 'up' : pct < -5 ? 'down' : 'stable'
  return { trend, trend_pct: Math.round(pct * 10) / 10 }
}

function resolveMethod(editorial) {
  return editorial?.metadata?.method || editorial?.source?.method || 'Editorial medians'
}

function getExcludedSales(condData) {
  return Array.isArray(condData?.editorialRemoved) ? condData.editorialRemoved : []
}

async function main() {
  console.log('\n[RetroDex] Import Editorial Prices')
  console.log(`[Mode] ${DRY_RUN ? 'DRY-RUN' : STATS_ONLY ? 'STATS ONLY' : 'IMPORT'}`)

  if (!fs.existsSync(DATA_FILE)) {
    console.error(`[FATAL] Missing file: ${DATA_FILE}`)
    process.exit(1)
  }

  const editorial = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
  const items = Array.isArray(editorial.items) ? editorial.items : []

  let totalSales = 0
  let totalConditions = 0
  const statsByRarity = {}

  for (const item of items) {
    statsByRarity[item.rarity] = (statsByRarity[item.rarity] || 0) + 1
    for (const condData of Object.values(item.conditions || {})) {
      if (condData.sampleCount > 0) {
        totalConditions += 1
        totalSales += Array.isArray(condData.sales) ? condData.sales.length : 0
      }
    }
  }

  console.log(`[File] ${DATA_FILE}`)
  console.log(`[Method] ${resolveMethod(editorial)}`)
  console.log(`[Items] ${items.length}`)
  Object.entries(statsByRarity).forEach(([rarity, count]) => {
    console.log(`  ${rarity}: ${count}`)
  })
  console.log(`[Conditions with data] ${totalConditions}`)
  console.log(`[Individual sales] ${totalSales}`)

  if (STATS_ONLY) {
    return
  }

  const sequelize = require(path.join(ROOT, 'backend', 'config', 'database'))
  const Game = require(path.join(ROOT, 'backend', 'src', 'models', 'Game'))
  const CommunityReport = require(path.join(ROOT, 'backend', 'models', 'CommunityReport'))
  const RetrodexIndex = require(path.join(ROOT, 'backend', 'models', 'RetrodexIndex'))

  if (!DRY_RUN) {
    await CommunityReport.sync({ alter: true })
    await RetrodexIndex.sync()
    console.log('[DB] community_reports + retrodex_index synced')
  }

  const stats = {
    items_processed: 0,
    conditions_indexed: 0,
    sales_inserted: 0,
    sales_skipped: 0,
    sales_excluded: 0,
    games_updated: 0,
    errors: 0
  }

  for (const item of items) {
    console.log(`\n[${item.rank}] ${item.title} (${item.console}) - ${item.rarity}`)
    stats.items_processed += 1

    const pricesByCondition = {}

    for (const [condKey, condData] of Object.entries(item.conditions || {})) {
      const condition = CONDITION_MAP[condKey]
      if (!condition) continue
      if (!condData.sampleCount || condData.sampleCount === 0) {
        console.log(`  ${condition}: no data`)
        continue
      }

      const sales = Array.isArray(condData.sales) ? condData.sales : []
      const prices = sales.map((sale) => sale.price).filter((price) => typeof price === 'number')
      const med = condData.median != null ? condData.median : median(prices)
      const low = percentile(prices, 25)
      const high = percentile(prices, 75)
      const lastSaleDate = sales.length > 0 ? sales[0].date : null
      const confidence = computeConfidence(sales, condData.sampleCount, lastSaleDate)
      const trendData = computeTrend(sales)

      console.log(`  ${condition}: $${med != null ? med.toFixed(2) : 'n/a'} | ${condData.sampleCount} sales | conf ${confidence}% | ${trendData.trend}`)

      pricesByCondition[condKey] = med

      for (const sale of sales) {
        const titleLower = String(sale.title || '').toLowerCase()
        let saleConfidence = 0.75

        if (condKey === 'loose' && /\b(loose|disc only|cart only|cartridge only|discs only|game only)\b/.test(titleLower)) {
          saleConfidence = 0.9
        } else if (condKey === 'cib' && /\b(cib|complete|with box|w\/box|box manual)\b/.test(titleLower)) {
          saleConfidence = 0.9
        } else if (condKey === 'mint' && /\b(sealed|new|unopened|factory sealed|brand new)\b/.test(titleLower)) {
          saleConfidence = 0.9
        }

        if (med && (sale.price > med * 2.5 || sale.price < med * 0.3)) {
          saleConfidence = Math.max(0.3, saleConfidence - 0.3)
        }

        const reportData = {
          item_id: item.id,
          item_type: 'game',
          user_id: EDITORIAL_USER_ID,
          reported_price: sale.price,
          currency: 'USD',
          condition,
          context: 'ebay_sold',
          sale_title: sale.title,
          date_estimated: sale.date,
          source_url: item.sourceUrl || null,
          user_trust_score: EDITORIAL_TRUST_SCORE,
          report_confidence_score: saleConfidence,
          is_editorial: true,
          editorial_excluded: false,
          editorial_note: item.sourceVariant ? `Source proxy: ${item.sourceVariant}` : null
        }

        if (DRY_RUN) {
          stats.sales_inserted += 1
        } else {
          try {
            await CommunityReport.upsert(reportData)
            stats.sales_inserted += 1
          } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
              stats.sales_skipped += 1
            } else {
              console.log(`  [ERR] sale upsert failed: ${error.message}`)
              stats.errors += 1
            }
          }
        }
      }

      for (const excluded of getExcludedSales(condData)) {
        const excludedData = {
          item_id: item.id,
          item_type: 'game',
          user_id: EDITORIAL_USER_ID,
          reported_price: excluded.price,
          currency: 'USD',
          condition,
          context: 'ebay_sold',
          sale_title: excluded.title,
          date_estimated: excluded.date,
          source_url: item.sourceUrl || null,
          user_trust_score: EDITORIAL_TRUST_SCORE,
          report_confidence_score: 0.25,
          is_editorial: true,
          editorial_excluded: true,
          editorial_note: Array.isArray(item.editorialNotes) && item.editorialNotes.length > 0
            ? item.editorialNotes.join(' | ')
            : `Excluded from ${condition} editorial sample`
        }

        if (DRY_RUN) {
          stats.sales_excluded += 1
        } else {
          try {
            await CommunityReport.upsert(excludedData)
            stats.sales_excluded += 1
          } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
              stats.sales_excluded += 1
            } else {
              console.log(`  [ERR] excluded sale upsert failed: ${error.message}`)
              stats.errors += 1
            }
          }
        }
      }

      const indexData = {
        item_id: item.id,
        item_type: 'game',
        condition,
        index_value: med,
        range_low: low,
        range_high: high,
        confidence_pct: confidence,
        sources_editorial: condData.sampleCount,
        sources_community: 0,
        trend: trendData.trend,
        trend_pct: trendData.trend_pct,
        sample_count: condData.sampleCount,
        last_sale_date: lastSaleDate,
        last_computed_at: new Date()
      }

      if (DRY_RUN) {
        stats.conditions_indexed += 1
      } else {
        try {
          await RetrodexIndex.upsert(indexData)
          stats.conditions_indexed += 1
        } catch (error) {
          console.log(`  [ERR] index upsert failed: ${error.message}`)
          stats.errors += 1
        }
      }
    }

    const gameUpdate = {}
    if (pricesByCondition.loose != null) gameUpdate.loosePrice = pricesByCondition.loose
    if (pricesByCondition.cib != null) gameUpdate.cibPrice = pricesByCondition.cib
    if (pricesByCondition.mint != null) gameUpdate.mintPrice = pricesByCondition.mint

    if (Object.keys(gameUpdate).length > 0) {
      if (DRY_RUN) {
        stats.games_updated += 1
      } else {
        try {
          const [count] = await Game.update(gameUpdate, { where: { id: item.id } })
          if (count > 0) {
            stats.games_updated += 1
          } else {
            console.log(`  [WARN] game not found: ${item.id}`)
          }
        } catch (error) {
          console.log(`  [ERR] game update failed: ${error.message}`)
          stats.errors += 1
        }
      }
    }
  }

  console.log('\n[Summary]')
  console.log(`  Items processed   : ${stats.items_processed}`)
  console.log(`  Conditions indexed: ${stats.conditions_indexed}`)
  console.log(`  Sales inserted    : ${stats.sales_inserted}`)
  console.log(`  Sales skipped     : ${stats.sales_skipped}`)
  console.log(`  Sales excluded    : ${stats.sales_excluded}`)
  console.log(`  Games updated     : ${stats.games_updated}`)
  console.log(`  Errors            : ${stats.errors}`)

  const top5 = items
    .filter((item) => item.conditions?.mint?.median)
    .sort((a, b) => (b.conditions.mint.median || 0) - (a.conditions.mint.median || 0))
    .slice(0, 5)

  if (top5.length > 0) {
    console.log('\n[Top 5 Mint]')
    top5.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.title} - $${item.conditions.mint.median.toFixed(2)}`)
    })
  }

  await sequelize.close()
}

main().catch(async (error) => {
  console.error('[FATAL]', error.message)
  console.error(error.stack)
  process.exit(1)
})

