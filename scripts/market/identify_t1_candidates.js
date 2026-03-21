'use strict'

const path = require('path')
const sequelize = require(path.join(__dirname, '../../backend/config/database'))
const Game = require(path.join(__dirname, '../../backend/src/models/Game'))
const RetrodexIndex = require(path.join(__dirname, '../../backend/models/RetrodexIndex'))
const { Op } = require(path.join(__dirname, '../../backend/node_modules/sequelize'))

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function main() {
  await sequelize.sync({ alter: false })
  await RetrodexIndex.sync({ alter: false })

  const candidates = await Game.findAll({
    where: {
      type: 'game',
      rarity: { [Op.in]: ['EPIC', 'RARE', 'LEGENDARY'] },
      mintPrice: { [Op.gt]: 0 },
    },
    order: [
      ['rarity', 'ASC'],
      ['mintPrice', 'DESC'],
    ],
    limit: 50,
  })

  const results = []
  for (const game of candidates) {
    const idx = await RetrodexIndex.findOne({
      where: {
        item_id: game.id,
        condition: 'Mint',
        confidence_pct: { [Op.gte]: 60 },
      },
    })

    if (!idx) {
      results.push(game)
    }

    if (results.length >= 30) {
      break
    }
  }

  console.log('\n=== 30 CANDIDATS T1 ===\n')
  console.log('ID | Titre | Rareté | Console | Mint estimé')
  console.log('---|---|---|---|---')
  results.forEach((g, i) => {
    console.log(`${i + 1}. ${g.id}`)
    console.log(`   ${g.title} | ${g.rarity} | ${g.console} | ~$${g.mintPrice}`)
    console.log(`   https://www.pricecharting.com/game/${slugify(g.console)}/${slugify(g.title)}`)
    console.log()
  })

  console.log(`\nTotal candidats : ${results.length}`)
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
