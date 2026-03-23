'use strict'
const path = require('path')
require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
})

process.env.SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPERDATA_Project_URL
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPERDATA_SERVICE_KEY
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPERDATA_Anon_Key

const express = require('express')
const cors = require('cors')
const { DataTypes } = require('sequelize')

const { sequelize, storagePath, databaseMode, databaseTarget } = require('./database')
const { mode: supabaseMode, db: supabaseDb } = require('../db_supabase')
const Game = require('./models/Game')
const Franchise = require('./models/Franchise')
const RetrodexIndex = require('../models/RetrodexIndex')
const { syncGamesFromPrototype } = require('./syncGames')
const { handleAsync } = require('./helpers/query')

const gamesRoutes = require('./routes/games')
const collectionRoutes = require('./routes/collection')
const franchisesRoutes = require('./routes/franchises')
const marketRoutes = require('./routes/market')
const pricesRouter = require('./routes/prices')
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

// SYNC: A7 - migre le 2026-03-23 - health check expose le mode DB reel
// Décision source : SYNC.md § A7
app.get('/api/health', handleAsync(async (_req, res) => {
  let games = await Game.count()

  if (supabaseMode === 'supabase') {
    const { count, error } = await supabaseDb
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'game')

    if (error) {
      throw new Error(error.message)
    }

    games = Number(count) || 0
  }

  res.json({
    ok: true,
    env: process.env.NODE_ENV || 'development',
    db: process.env.DATABASE_URL ? 'postgres' : 'sqlite',
    status: 'running',
    backend: 'retrodex-express-sequelize',
    database: supabaseMode === 'none' ? databaseMode : supabaseMode,
    storage: databaseTarget || storagePath,
    games,
    timestamp: new Date().toISOString(),
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
app.use('/api/prices', pricesRouter)
app.use(syncRoutes)

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'))
})

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
  const shouldAlterSchema = process.env.NODE_ENV !== 'production'
  let effectiveAlter = shouldAlterSchema

  try {
    await sequelize.sync({ alter: effectiveAlter })
  } catch (error) {
    if (effectiveAlter && databaseMode === 'sqlite') {
      console.warn('[DB] alter sync failed on SQLite, retrying with alter:false')
      effectiveAlter = false
      await sequelize.sync({ alter: false })
    } else {
      throw error
    }
  }
  await ensureGameEncyclopediaColumns()
  await Franchise.sync({ alter: effectiveAlter })
  let shouldBootstrap = true

  try {
    shouldBootstrap = databaseMode === 'sqlite' && (await Game.count()) === 0
  } catch (_error) {
    shouldBootstrap = databaseMode === 'sqlite'
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

module.exports = app
module.exports.app = app
module.exports.startServer = startServer
