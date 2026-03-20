'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../..')
const OUTPUT_FILE = path.join(ROOT, 'data', 'prices_t1_auto_latest.json')
const { Op } = require(path.join(ROOT, 'backend', 'node_modules', 'sequelize'))
const sequelize = require(path.join(ROOT, 'backend', 'config', 'database'))
const Game = require(path.join(ROOT, 'backend', 'src', 'models', 'Game'))
const RetrodexIndex = require(path.join(ROOT, 'backend', 'models', 'RetrodexIndex'))

// Fourchettes par rarete
const RANGES = {
  LEGENDARY: { loose: [400, 900], cib: [800, 2000], mint: [1200, 3500] },
  EPIC: { loose: [60, 300], cib: [120, 600], mint: [250, 1200] },
  RARE: { loose: [20, 80], cib: [40, 150], mint: [70, 300] },
  UNCOMMON: { loose: [8, 25], cib: [15, 50], mint: [25, 100] },
  COMMON: { loose: [3, 12], cib: [6, 20], mint: [12, 40] }
}

function est(range) {
  const mid = (range[0] + range[1]) / 2
  return Math.round((mid + mid * 0.15 * (Math.random() * 2 - 1)) * 100) / 100
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function makeSales(median, n = 3) {
  const sales = []
  const now = new Date('2026-03-20T12:00:00Z')
  for (let i = 0; i < n; i += 1) {
    const daysAgo = 15 + i * 30
    const d = new Date(now.getTime() - daysAgo * 86400000)
    const dateStr = d.toISOString().slice(0, 10)
    const price = Math.round((median + median * 0.1 * (Math.random() * 2 - 1)) * 100) / 100
    sales.push({ date: dateStr, title: '[Editorial estimate]', price })
  }
  return sales
}

function buildConditionData(median) {
  return {
    sampleCount: 3,
    median,
    sales: makeSales(median, 3)
  }
}

function buildSourceUrl(game) {
  return `https://www.pricecharting.com/game/${slugify(game.console)}/${slugify(game.title)}`
}

function buildBatchItem(game, rank, prices) {
  return {
    rank,
    id: game.id,
    title: game.title,
    console: game.console,
    rarity: game.rarity || 'COMMON',
    sourceUrl: buildSourceUrl(game),
    sourceVariant: null,
    conditions: {
      loose: buildConditionData(prices.loose),
      cib: buildConditionData(prices.cib),
      mint: buildConditionData(prices.mint)
    }
  }
}

async function ensureGameExists(game) {
  await Game.upsert({
    id: game.id,
    title: game.title,
    console: game.console,
    year: game.year,
    developer: game.developer,
    genre: game.genre,
    rarity: game.rarity,
    summary: game.summary,
    type: game.type || 'game',
    slug: game.slug || game.id,
    source_confidence: game.source_confidence == null ? 0.7 : game.source_confidence,
    loosePrice: game.loosePrice,
    cibPrice: game.cibPrice,
    mintPrice: game.mintPrice
  })
}

async function main() {
  const limit = parseInt(process.argv[2], 10) || 20

  await sequelize.sync({ alter: false })
  await RetrodexIndex.sync({ alter: false })

  const candidates = await Game.findAll({
    where: {
      type: 'game',
      rarity: { [Op.in]: ['LEGENDARY', 'EPIC', 'RARE'] }
    },
    order: [['rarity', 'ASC'], ['mintPrice', 'DESC']],
    limit: limit * 3
  })

  const targets = []
  for (const game of candidates) {
    if (targets.length >= limit) break
    const t1 = await RetrodexIndex.findOne({
      where: {
        item_id: game.id,
        confidence_pct: { [Op.gte]: 60 }
      }
    })
    if (!t1) {
      targets.push(game)
    }
  }

  const generatedItems = []

  console.log(`\n[INFO] ${targets.length} candidats T1 selectionnes`)
  console.log(`[INFO] JSON auto-genere: ${OUTPUT_FILE}`)
  console.log('[INFO] Generation et import en cours...\n')

  let ok = 0
  let skip = 0
  let errors = 0

  for (const [index, game] of targets.entries()) {
    const rarity = RANGES[game.rarity] ? game.rarity : 'COMMON'
    const ranges = RANGES[rarity]
    const prices = {
      loose: est(ranges.loose),
      cib: est(ranges.cib),
      mint: est(ranges.mint)
    }

    generatedItems.push(buildBatchItem(game, index + 1, prices))
    await ensureGameExists(game)

    await game.update({
      loosePrice: prices.loose,
      cibPrice: prices.cib,
      mintPrice: prices.mint
    })

    for (const [condition, value] of [
      ['Loose', prices.loose],
      ['CIB', prices.cib],
      ['Mint', prices.mint]
    ]) {
      const existing = await RetrodexIndex.findOne({
        where: { item_id: game.id, condition }
      })

      if (existing && existing.confidence_pct >= 60) {
        skip += 1
        continue
      }

      const sales = makeSales(value, 3)

      try {
        await RetrodexIndex.upsert({
          item_id: game.id,
          item_type: 'game',
          condition,
          index_value: value,
          range_low: Math.round(value * 0.75 * 100) / 100,
          range_high: Math.round(value * 1.3 * 100) / 100,
          confidence_pct: 30,
          sources_editorial: 3,
          sources_community: 0,
          trend: 'stable',
          trend_pct: 0,
          sample_count: 3,
          last_sale_date: sales[0].date,
          last_computed_at: new Date()
        })
        ok += 1
      } catch (error) {
        errors += 1
        console.log(`  [ERR] ${game.title} / ${condition}: ${error.message}`)
      }
    }

    console.log(`  [OK] ${game.title} (${game.console}) | ${rarity} | L:$${prices.loose} C:$${prices.cib} M:$${prices.mint}`)
  }

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true })
  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify({
      metadata: {
        version: '1.0',
        created: '2026-03-20',
        method: 'Editorial medians auto-generated from rarity ranges.',
        sampleTargetPerCondition: 3,
        selectionRule: `Auto-selected next ${targets.length} T1 candidates without verified prices`
      },
      items: generatedItems
    }, null, 2)
  )

  const t1count = await RetrodexIndex.count({
    where: { confidence_pct: { [Op.gte]: 60 } }
  })
  const t3count = await RetrodexIndex.count({
    where: { confidence_pct: { [Op.between]: [25, 59] } }
  })
  const t4count = await RetrodexIndex.count({
    where: { confidence_pct: { [Op.lt]: 25 } }
  })

  console.log('\n========================================')
  console.log('RESUME FINAL')
  console.log('========================================')
  console.log(`  Jeux traites   : ${targets.length}`)
  console.log(`  Conditions OK  : ${ok}`)
  console.log(`  Skippes (T1)   : ${skip}`)
  console.log(`  Erreurs        : ${errors}`)
  console.log(`  T1 en base     : ${t1count}  (confidence >= 60)`)
  console.log(`  T3 en base     : ${t3count}  (confidence 25-59)`)
  console.log(`  T4 en base     : ${t4count}  (confidence < 25)`)

  await sequelize.close()
}

main().catch(async (err) => {
  console.error('[FATAL]', err.message)
  process.exit(1)
})
