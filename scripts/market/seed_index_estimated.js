'use strict'

const path = require('path')
const { Op } = require(path.join(__dirname, '../../backend/node_modules/sequelize'))
const sequelize = require(path.join(__dirname, '../../backend/config/database'))
const Game = require(path.join(__dirname, '../../backend/src/models/Game'))
const RetrodexIndex = require(path.join(__dirname, '../../backend/models/RetrodexIndex'))

async function main() {
  await sequelize.sync({ alter: false })
  await RetrodexIndex.sync({ alter: false })

  const games = await Game.findAll({
    where: {
      type: 'game',
      loosePrice: { [Op.gt]: 0 },
    },
    order: [['title', 'ASC']],
  })

  console.log(`[INFO] ${games.length} jeux avec prix à indexer`)

  let inserted = 0
  let skipped = 0

  for (const game of games) {
    for (const [condition, price] of [
      ['Loose', game.loosePrice],
      ['CIB', game.cibPrice],
      ['Mint', game.mintPrice],
    ]) {
      if (!price) {
        continue
      }

      const existing = await RetrodexIndex.findOne({
        where: { item_id: game.id, condition },
      })

      if (existing && Number(existing.confidence_pct) >= 60) {
        skipped += 1
        continue
      }

      if (existing && Number(existing.confidence_pct) === 15) {
        skipped += 1
        continue
      }

      await RetrodexIndex.upsert({
        item_id: game.id,
        item_type: 'game',
        condition,
        index_value: price,
        range_low: Math.round(price * 0.75 * 100) / 100,
        range_high: Math.round(price * 1.30 * 100) / 100,
        confidence_pct: 15,
        sources_editorial: 0,
        sources_community: 0,
        trend: 'stable',
        trend_pct: 0,
        sample_count: 0,
        last_computed_at: new Date(),
      })
      inserted += 1
    }

    if ((inserted + skipped) % 300 === 0 && (inserted + skipped) > 0) {
      console.log(`  [${inserted} insérés / ${skipped} skippés]`)
    }
  }

  const total = await RetrodexIndex.count()
  console.log('\n╔══════════════════════════════╗')
  console.log('║        RÉSUMÉ FINAL          ║')
  console.log('╚══════════════════════════════╝')
  console.log(`  Insérés  : ${inserted}`)
  console.log(`  Skippés  : ${skipped} (déjà T1/T2 ou T4)`)
  console.log(`  Total index : ${total}`)

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
