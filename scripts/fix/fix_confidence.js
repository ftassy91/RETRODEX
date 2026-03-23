'use strict'

const path = require('path')
module.paths.push(path.join(__dirname, '../../backend/node_modules'))

const { sequelize } = require('../../backend/src/database')
const Game = require('../../backend/src/models/Game')

function hasText(value) {
  return String(value || '').trim() !== ''
}

function computeConfidence(game) {
  let score = 0.3

  if (Number(game.loosePrice) > 0) score += 0.1
  if (hasText(game.developer)) score += 0.1
  if (hasText(game.genre) && game.genre !== 'Other') score += 0.1
  if (hasText(game.synopsis)) score += 0.15
  if (game.metascore != null) score += 0.1

  return Number(Math.min(score, 0.75).toFixed(2))
}

async function main() {
  await sequelize.authenticate()

  const games = await Game.findAll({
    attributes: ['id', 'title', 'source_confidence', 'loosePrice', 'developer', 'genre', 'synopsis', 'metascore'],
    where: {
      source_confidence: 0.5,
    },
  })

  const distribution = {}

  for (const game of games) {
    const score = computeConfidence(game)
    game.source_confidence = score
    await game.save({ fields: ['source_confidence'] })
    distribution[score.toFixed(2)] = (distribution[score.toFixed(2)] || 0) + 1
  }

  console.log(`[fix_confidence] updated=${games.length}`)
  Object.keys(distribution)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((score) => {
      console.log(`[fix_confidence] ${score}=${distribution[score]}`)
    })
}

main()
  .catch((error) => {
    console.error('[fix_confidence] failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await sequelize.close()
  })
