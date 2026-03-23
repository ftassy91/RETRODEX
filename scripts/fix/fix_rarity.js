'use strict'

const path = require('path')
module.paths.push(path.join(__dirname, '../../backend/node_modules'))

const { Op } = require('sequelize')
const { sequelize, databaseMode, databaseTarget } = require('../../backend/src/database')
const Game = require('../../backend/src/models/Game')

function computeRarity(loosePrice) {
  const price = Number(loosePrice)

  if (!Number.isFinite(price)) return 'COMMON'
  if (price >= 500) return 'LEGENDARY'
  if (price >= 100) return 'EPIC'
  if (price >= 30) return 'RARE'
  if (price >= 12) return 'UNCOMMON'
  return 'COMMON'
}

async function main() {
  console.log(`[fix_rarity] mode=${databaseMode} target=${databaseTarget}`)
  await sequelize.authenticate()

  const games = await Game.findAll({
    attributes: ['id', 'title', 'type', 'rarity', 'loosePrice', 'source_confidence'],
    where: {
      type: 'game',
      rarity: {
        [Op.is]: null,
      },
    },
  })

  const counts = {
    LEGENDARY: 0,
    EPIC: 0,
    RARE: 0,
    UNCOMMON: 0,
    COMMON: 0,
  }

  for (const game of games) {
    const rarity = computeRarity(game.loosePrice)
    game.rarity = rarity

    const confidence = Number(game.source_confidence)
    if (!Number.isFinite(confidence) || confidence <= 0.6) {
      game.source_confidence = 0.35
    }

    await game.save({ fields: ['rarity', 'source_confidence'] })
    counts[rarity] += 1
  }

  console.log(`[fix_rarity] updated=${games.length}`)
  Object.entries(counts).forEach(([rarity, count]) => {
    console.log(`[fix_rarity] ${rarity}=${count}`)
  })
}

main()
  .catch((error) => {
    console.error('[fix_rarity] failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await sequelize.close()
  })
