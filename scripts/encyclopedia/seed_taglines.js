'use strict'

const path = require('path')
const { Op, DataTypes } = require(path.join(__dirname, '../../backend/node_modules/sequelize'))
const sequelize = require(path.join(__dirname, '../../backend/config/database'))
const Game = require(path.join(__dirname, '../../backend/src/models/Game'))

async function ensureTaglineColumn() {
  const queryInterface = sequelize.getQueryInterface()
  const columns = await queryInterface.describeTable('games').catch(() => null)

  if (!columns || columns.tagline) {
    return
  }

  await queryInterface.addColumn('games', 'tagline', {
    type: DataTypes.TEXT,
    allowNull: true
  })
}

async function main() {
  await sequelize.sync({ alter: false })
  await ensureTaglineColumn()

  const games = await Game.findAll({
    where: {
      synopsis: { [Op.not]: null },
      tagline: null
    }
  })

  console.log(`[INFO] ${games.length} jeux avec synopsis à traiter`)
  let ok = 0

  for (const game of games) {
    const sentences = String(game.synopsis || '')
      .replace(/\.\s+/g, '.|')
      .split('|')
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 20)

    const tagline = sentences.slice(0, 2).join(' ').slice(0, 200)
    if (tagline) {
      await game.update({ tagline })
      console.log(`[OK] ${game.title} → ${tagline.slice(0, 60)}...`)
      ok++
    }
  }

  const rarityTaglines = {
    LEGENDARY: 'Un des jeux les plus rares et recherches de l\'histoire du retro-gaming.',
    EPIC: 'Un titre culte recherche par les collectionneurs du monde entier.',
    RARE: 'Un titre rare avec une communaute de fans passionnes.'
  }

  const withoutTagline = await Game.findAll({
    where: {
      tagline: null,
      rarity: { [Op.in]: ['LEGENDARY', 'EPIC', 'RARE'] }
    },
    limit: 200
  })

  for (const game of withoutTagline) {
    const tagline = rarityTaglines[game.rarity]
    if (tagline) {
      await game.update({ tagline })
      ok++
    }
  }

  console.log(`\n[DONE] ${ok} taglines generees`)
  await sequelize.close()
}

main().catch((err) => {
  console.error('[FATAL]', err.message)
  process.exit(1)
})
