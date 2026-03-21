'use strict'

const path = require('path')
const { DataTypes } = require(path.join(__dirname, '../../backend/node_modules/sequelize'))

const { sequelize } = require(path.join(__dirname, '../../backend/src/database'))
const Game = require(path.join(__dirname, '../../backend/src/models/Game'))
const Franchise = require(path.join(__dirname, '../../backend/src/models/Franchise'))

function normalizeValue(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function ensureFranchiseColumn() {
  const queryInterface = sequelize.getQueryInterface()
  const columns = await queryInterface.describeTable('games').catch(() => null)

  if (!columns) {
    throw new Error('games table not found')
  }

  if (!columns.franch_id) {
    await queryInterface.addColumn('games', 'franch_id', {
      type: DataTypes.STRING,
      allowNull: true,
    })
  }
}

async function main() {
  await ensureFranchiseColumn()

  const franchises = await Franchise.findAll({
    attributes: ['id', 'name'],
    order: [['name', 'ASC']],
  })

  const sortedFranchises = franchises
    .map((franchise) => ({
      id: franchise.id,
      name: franchise.name,
      normalized: normalizeValue(franchise.name),
    }))
    .filter((franchise) => franchise.normalized.length >= 3)
    .sort((left, right) => right.normalized.length - left.normalized.length || left.name.localeCompare(right.name))

  const games = await Game.findAll({
    attributes: ['id', 'title', 'franch_id'],
    where: {
      type: 'game',
    },
    order: [['title', 'ASC']],
  })

  console.log(`[INFO] ${sortedFranchises.length} franchises chargees`)
  console.log(`[INFO] ${games.length} jeux a analyser`)

  let matched = 0
  let unchanged = 0

  for (const game of games) {
    const normalizedTitle = normalizeValue(game.title)
    let franchiseId = null

    for (const franchise of sortedFranchises) {
      if (normalizedTitle.includes(franchise.normalized)) {
        franchiseId = franchise.id
        break
      }
    }

    if (game.franch_id === franchiseId) {
      unchanged += 1
      continue
    }

    await game.update({ franch_id: franchiseId })
    if (franchiseId) {
      matched += 1
      console.log(`[OK] ${game.title} -> ${franchiseId}`)
    }
  }

  console.log(`\n[DONE] franchises liees : ${matched}`)
  console.log(`[DONE] jeux inchanges : ${unchanged}`)

  await sequelize.close()
}

main().catch(async (error) => {
  console.error('[FATAL]', error.message)
  await sequelize.close().catch(() => {})
  process.exit(1)
})
