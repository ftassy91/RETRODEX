'use strict'

const path = require('path')
const fs = require('fs')
const sequelize = require('../config/database')
const Game = require('../src/models/Game')
const Franchise = require('../src/models/Franchise')
const RetrodexIndex = require('../models/RetrodexIndex')

async function main() {
  await sequelize.sync({ alter: false })

  const exportDir = path.join(__dirname, '../../data/exports')
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true })
  }

  const games = await Game.findAll()
  const franchises = await Franchise.findAll()
  const index = await RetrodexIndex.findAll()

  fs.writeFileSync(
    path.join(exportDir, 'games_export.json'),
    JSON.stringify(games.map((game) => game.toJSON()), null, 2)
  )
  fs.writeFileSync(
    path.join(exportDir, 'franchises_export.json'),
    JSON.stringify(franchises.map((franchise) => franchise.toJSON()), null, 2)
  )
  fs.writeFileSync(
    path.join(exportDir, 'index_export.json'),
    JSON.stringify(index.map((entry) => entry.toJSON()), null, 2)
  )

  console.log(`[OK] Export games: ${games.length}`)
  console.log(`[OK] Export franchises: ${franchises.length}`)
  console.log(`[OK] Export index: ${index.length}`)
  console.log('[OK] Fichiers dans data/exports/')

  await sequelize.close()
}

main().catch((err) => {
  console.error('[FATAL]', err.message)
  process.exit(1)
})
