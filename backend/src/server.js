'use strict'

const path = require('path')
require('dotenv').config()

const express = require('express')
const cors = require('cors')
const { DataTypes } = require('sequelize')

const { sequelize, storagePath, databaseMode, databaseTarget } = require('./database')
const Game = require('./models/Game')
const Franchise = require('./models/Franchise')
const RetrodexIndex = require('../models/RetrodexIndex')
const { syncGamesFromPrototype } = require('./syncGames')
const { handleAsync } = require('./helpers/query')

const gamesRoutes = require('./routes/games')
const collectionRoutes = require('./routes/collection')
const franchisesRoutes = require('./routes/franchises')
const marketRoutes = require('./routes/market')
const statsRoutes = require('./routes/stats')
const syncRoutes = require('./routes/sync')

const baseRetrodexIndexSync = RetrodexIndex.sync.bind(RetrodexIndex)
RetrodexIndex.sync = (options = {}) => baseRetrodexIndexSync({
  ...options,
  alter: false,
}).catch(() => {})

const app = express()

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : '*',
}))
app.use(express.json())
app.use(express.static(path.join(__dirname, '..', 'public')))

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    message: 'RetroDex backend is running.',
    docs: '/home.html',
    consoles: '/consoles.html',
    gamesList: '/games-list.html',
    gameDetailExample: '/game-detail.html?id=tetris-game-boy',
    collection: '/collection.html',
    stats: '/stats.html',
    debug: '/debug.html',
    health: '/api/health',
  })
})

app.get('/api/health', handleAsync(async (_req, res) => {
  const games = await Game.count()
  res.json({
    ok: true,
    backend: 'retrodex-express-sequelize',
    database: databaseMode,
    storage: databaseTarget || storagePath,
    games,
  })
}))

async function ensureGameEncyclopediaColumns() {
  const queryInterface = sequelize.getQueryInterface()
  const columns = await queryInterface.describeTable('games').catch(() => null)

  if (!columns) {
    return
  }

  const missingColumns = [
    ['tagline', { type: DataTypes.TEXT, allowNull: true }],
    ['cover_url', { type: DataTypes.TEXT, allowNull: true }],
    ['synopsis', { type: DataTypes.TEXT, allowNull: true }],
    ['dev_anecdotes', { type: DataTypes.TEXT, allowNull: true }],
    ['dev_team', { type: DataTypes.TEXT, allowNull: true }],
    ['cheat_codes', { type: DataTypes.TEXT, allowNull: true }],
  ].filter(([name]) => !columns[name])

  for (const [name, definition] of missingColumns) {
    await queryInterface.addColumn('games', name, definition)
  }
}

app.use(gamesRoutes)
app.use(collectionRoutes)
app.use(franchisesRoutes)
app.use(marketRoutes)
app.use(statsRoutes)
app.use(syncRoutes)

app.use((error, req, res, _next) => {
  console.error(`RetroDex backend request failed: ${req.method} ${req.originalUrl}`, error)

  if (res.headersSent) {
    return
  }

  res.status(500).json({
    ok: false,
    error: 'Internal server error',
  })
})

async function startServer(portOverride) {
  await ensureGameEncyclopediaColumns()
  await Franchise.sync()
  let shouldBootstrap = true

  try {
    shouldBootstrap = (await Game.count()) === 0
  } catch (_error) {
    shouldBootstrap = true
  }

  if (shouldBootstrap) {
    await syncGamesFromPrototype()
  }

  const PORT = Number(portOverride || process.env.PORT || 3000)

  return app.listen(PORT, () => {
    console.log(`RetroDex backend running on http://localhost:${PORT}`)
  })
}

if (require.main === module) {
  startServer().catch(async (error) => {
    console.error('Unable to start RetroDex backend:', error)
    await sequelize.close()
    process.exit(1)
  })
}

module.exports = {
  app,
  startServer,
}
