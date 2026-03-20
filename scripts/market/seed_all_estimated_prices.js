'use strict'

const path = require('path')
const { Op } = require(path.join(__dirname, '../../backend/node_modules/sequelize'))
const sequelize = require(path.join(__dirname, '../../backend/config/database'))
const Game = require(path.join(__dirname, '../../backend/src/models/Game'))

const RARITY_RANGES = {
  LEGENDARY: { loose: [400, 900], cib: [800, 2000], mint: [1200, 3500] },
  EPIC: { loose: [80, 300], cib: [150, 600], mint: [300, 1200] },
  RARE: { loose: [25, 80], cib: [45, 150], mint: [80, 300] },
  UNCOMMON: { loose: [8, 25], cib: [15, 50], mint: [25, 100] },
  COMMON: { loose: [3, 12], cib: [6, 20], mint: [12, 40] },
}

function estimate(range) {
  const mid = (range[0] + range[1]) / 2
  const variance = mid * 0.15 * (Math.random() * 2 - 1)
  return Math.round((mid + variance) * 100) / 100
}

async function main() {
  await sequelize.sync({ alter: false })

  const games = await Game.findAll({
    where: {
      type: 'game',
      loosePrice: { [Op.or]: [null, 0] },
    },
  })

  console.log(`[INFO] ${games.length} jeux sans prix à traiter`)

  let ok = 0

  for (const game of games) {
    const rarity = RARITY_RANGES[game.rarity] ? game.rarity : 'COMMON'
    const ranges = RARITY_RANGES[rarity]

    await game.update({
      loosePrice: estimate(ranges.loose),
      cibPrice: estimate(ranges.cib),
      mintPrice: estimate(ranges.mint),
    })

    ok += 1
    if (ok % 100 === 0) {
      console.log(`  [${ok}/${games.length}] traités...`)
    }
  }

  const total = await Game.count({ where: { type: 'game' } })
  const withPrice = await Game.count({
    where: {
      type: 'game',
      loosePrice: { [Op.gt]: 0 },
    },
  })

  console.log('\n╔══════════════════════════════╗')
  console.log('║        RÉSUMÉ FINAL          ║')
  console.log('╚══════════════════════════════╝')
  console.log(`  Traités    : ${ok}`)
  console.log(`  Avec prix  : ${withPrice} / ${total}`)
  console.log(`  Couverture : ${Math.round(withPrice / total * 100)}%`)

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
