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
const { mode: supabaseMode, db: supabaseDb } = require('../db_supabase')
const { handleAsync } = require('./helpers/query')

const pricesRouter = require('./routes/prices')
const contextualSearchRouter = require('./routes/contextual-search')

const hasServerlessSupabaseEnv = Boolean(process.env.SUPABASE_URL || process.env.SUPERDATA_Project_URL)
const isServerlessSupabaseRuntime = Boolean(process.env.VERCEL && hasServerlessSupabaseEnv)

let legacyRuntime = null

function getLegacyRuntime() {
  if (legacyRuntime) {
    return legacyRuntime
  }

  const { DataTypes } = require('sequelize')
  const { sequelize, storagePath, databaseMode, databaseTarget } = require('./database')
  const Game = require('./models/Game')
  const Franchise = require('./models/Franchise')
  const RetrodexIndex = require('../models/RetrodexIndex')
  const { syncGamesFromPrototype } = require('./syncGames')

  const baseRetrodexIndexSync = RetrodexIndex.sync.bind(RetrodexIndex)
  RetrodexIndex.sync = (options = {}) => baseRetrodexIndexSync({
    ...options,
    alter: false,
  }).catch(() => {})

  legacyRuntime = {
    DataTypes,
    sequelize,
    storagePath,
    databaseMode,
    databaseTarget,
    Game,
    Franchise,
    syncGamesFromPrototype,
  }

  return legacyRuntime
}

async function countSupabaseGames() {
  const { count, error } = await supabaseDb
    .from('games')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'game')

  if (error) {
    throw new Error(error.message)
  }

  return Number(count) || 0
}

async function ensureGameEncyclopediaColumns() {
  const { DataTypes, sequelize } = getLegacyRuntime()
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

const app = express()

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : '*',
}))
app.use(express.json())
app.use(express.static(path.join(__dirname, '..', 'public')))
app.use(contextualSearchRouter)

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
// Decision source : SYNC.md § A7
// SYNC: A8 - migre le 2026-03-23 - bootstrap Vercel sans charger Sequelize
// Decision source : SYNC.md § A8
app.get('/api/health', handleAsync(async (_req, res) => {
  let games = 0
  let database = supabaseMode
  let db = process.env.DATABASE_URL ? 'postgres' : 'sqlite'
  let storage = process.env.SUPABASE_URL || process.env.SUPERDATA_Project_URL || null

  if (supabaseMode === 'supabase') {
    games = await countSupabaseGames()
    db = 'supabase'
  } else {
    const {
      Game,
      storagePath,
      databaseMode,
      databaseTarget,
    } = getLegacyRuntime()

    games = await Game.count()
    database = databaseMode
    storage = databaseTarget || storagePath
  }

  res.json({
    ok: true,
    env: process.env.NODE_ENV || 'development',
    db,
    status: 'running',
    backend: 'retrodex-express-sequelize',
    database,
    storage,
    games,
    timestamp: new Date().toISOString(),
  })
}))

if (isServerlessSupabaseRuntime) {
  app.use(require('./routes/serverless'))
  app.use('/api/prices', pricesRouter)
} else {
  app.use(require('./routes/games'))
  app.use(require('./routes/collection'))
  app.use(require('./routes/market'))
  app.use('/api/prices', pricesRouter)
  app.use(require('./routes/franchises'))
  app.use(require('./routes/sync'))
}

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
  const {
    sequelize,
    databaseMode,
    Franchise,
    Game,
    syncGamesFromPrototype,
  } = getLegacyRuntime()
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
    const { sequelize } = getLegacyRuntime()
    console.error('Unable to start RetroDex backend:', error)
    await sequelize.close()
    process.exit(1)
  })
}

module.exports = app
module.exports.app = app
module.exports.startServer = startServer
