'use strict'

const path = require('path')
const { Op } = require(path.join(__dirname, '../../backend/node_modules/sequelize'))

const sequelize = require(path.join(__dirname, '../../backend/config/database'))
const Game = require(path.join(__dirname, '../../backend/src/models/Game'))
const CommunityReport = require(path.join(__dirname, '../../backend/models/CommunityReport'))
const RetrodexIndex = require(path.join(__dirname, '../../backend/models/RetrodexIndex'))

const RARITY_RANGES = {
  LEGENDARY: { loose: [400, 900], cib: [800, 2000], mint: [1200, 3500] },
  EPIC: { loose: [80, 300], cib: [150, 600], mint: [300, 1200] },
  RARE: { loose: [25, 80], cib: [45, 150], mint: [80, 300] },
  UNCOMMON: { loose: [8, 25], cib: [15, 50], mint: [25, 100] },
  COMMON: { loose: [3, 12], cib: [6, 20], mint: [12, 40] },
}

function midpoint(range) {
  return Math.round(((range[0] + range[1]) / 2) * 100) / 100
}

function seededUnit(value) {
  const input = String(value || '')
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash * 31) + input.charCodeAt(index)) | 0
  }
  return (Math.abs(hash) % 10000) / 10000
}

function withVariance(value, seed, pct = 0.15) {
  const ratio = (seededUnit(seed) * 2) - 1
  const delta = value * pct * ratio
  return Math.round((value + delta) * 100) / 100
}

async function main() {
  await sequelize.sync({ alter: false })
  await CommunityReport.sync({ alter: false })
  await RetrodexIndex.sync({ alter: false })

  const games = await Game.findAll({
    where: {
      type: 'game',
      loosePrice: null,
    },
    order: [['rarity', 'DESC'], ['title', 'ASC']],
  })

  console.log(`[INFO] ${games.length} jeux sans prix`)

  const priorities = ['LEGENDARY', 'EPIC', 'RARE']
  const targets = games.filter((game) => priorities.includes(game.rarity))
  console.log(`[INFO] ${targets.length} jeux LEGENDARY/EPIC/RARE à traiter`)

  let ok = 0
  let skip = 0

  for (const game of targets) {
    const rarity = game.rarity || 'COMMON'
    const ranges = RARITY_RANGES[rarity] || RARITY_RANGES.COMMON

    const loose = withVariance(midpoint(ranges.loose), `${game.id}:Loose`)
    const cib = withVariance(midpoint(ranges.cib), `${game.id}:CIB`)
    const mint = withVariance(midpoint(ranges.mint), `${game.id}:Mint`)

    if (![loose, cib, mint].every((price) => Number.isFinite(price) && price > 0)) {
      skip += 1
      continue
    }

    await game.update({ loosePrice: loose, cibPrice: cib, mintPrice: mint })

    for (const [condition, value] of [['Loose', loose], ['CIB', cib], ['Mint', mint]]) {
      await RetrodexIndex.upsert({
        item_id: game.id,
        item_type: 'game',
        condition,
        index_value: value,
        range_low: Math.round(value * 0.75 * 100) / 100,
        range_high: Math.round(value * 1.3 * 100) / 100,
        confidence_pct: 15,
        sources_editorial: 0,
        sources_community: 0,
        trend: 'stable',
        trend_pct: 0,
        sample_count: 0,
        last_computed_at: new Date(),
      })
    }

    ok += 1
    if (ok % 50 === 0) {
      console.log(`  [${ok}/${targets.length}] en cours...`)
    }
  }

  const withPrice = await Game.count({
    where: {
      type: 'game',
      loosePrice: { [Op.gt]: 0 },
    },
  })
  const totalGames = await Game.count({ where: { type: 'game' } })

  console.log('\n╔══════════════════════════════╗')
  console.log('║        RÉSUMÉ FINAL          ║')
  console.log('╚══════════════════════════════╝')
  console.log(`  Traités    : ${ok}`)
  console.log(`  Skip       : ${skip}`)
  console.log(`  Avec prix  : ${withPrice} / ${totalGames}`)
  console.log(`  Couverture : ${Math.round((withPrice / totalGames) * 100)}%`)

  await sequelize.close()
}

main().catch(async (err) => {
  console.error('[FATAL]', err.message)
  try {
    await sequelize.close()
  } catch (_error) {
    // noop
  }
  process.exit(1)
})
