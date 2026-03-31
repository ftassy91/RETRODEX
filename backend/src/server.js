'use strict'

const fs = require('fs')
const path = require('path')

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
})

const {
  applyResolvedSupabaseEnv,
  logRuntimeDbContext,
} = require('./config/env')

applyResolvedSupabaseEnv()
logRuntimeDbContext()

const express = require('express')
const cors = require('cors')
const { mode: supabaseMode, db: supabaseDb } = require('../db_supabase')
const { handleAsync } = require('./helpers/query')
const { errorHandler } = require('./middleware/error')
const { runMigrations } = require('./services/migration-runner')

const hasServerlessSupabaseEnv = Boolean(process.env.SUPABASE_URL || process.env.SUPERDATA_Project_URL)
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL)
const useSupabaseServerlessRoutes = Boolean(
  process.env.VERCEL
  && hasServerlessSupabaseEnv
  && !hasDatabaseUrl
  && supabaseMode === 'supabase'
)

let legacyRuntime = null
let runtimeReadyPromise = null

function getLegacyRuntime() {
  if (legacyRuntime) {
    return legacyRuntime
  }

  const { DataTypes } = require('sequelize')
  const { sequelize, storagePath, databaseMode, databaseTarget } = require('./database')
  require('./models/associations')
  const Game = require('./models/Game')
  const Franchise = require('./models/Franchise')
  const Console = require('./models/Console')
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
    Console,
    syncGamesFromPrototype,
  }

  return legacyRuntime
}

async function ensureRuntimeReady() {
  if (runtimeReadyPromise) {
    return runtimeReadyPromise
  }

  runtimeReadyPromise = (async () => {
    const {
      sequelize,
      databaseMode,
      Franchise,
      Game,
      syncGamesFromPrototype,
    } = getLegacyRuntime()

    const dbSupabase = require('../db_supabase')
    if (dbSupabase.setSequelize) {
      dbSupabase.setSequelize(sequelize)
    }

    app.locals.sequelize = sequelize
    app.locals.databaseMode = databaseMode

    if (databaseMode === 'postgres') {
      await sequelize.authenticate()
      await runMigrations(sequelize)
      return
    }

    if (process.env.VERCEL && databaseMode === 'sqlite') {
      return
    }

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
    await ensurePriceHistoryTable()
    await runMigrations(sequelize)
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

    await ensureConsolesSeeded()
  })().catch((error) => {
    runtimeReadyPromise = null
    throw error
  })

  return runtimeReadyPromise
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

async function ensurePriceHistoryTable() {
  const { sequelize, databaseMode } = getLegacyRuntime()

  if (databaseMode !== 'sqlite') {
    return
  }

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      price REAL NOT NULL,
      condition TEXT CHECK(condition IN ('loose','cib','mint')) DEFAULT 'loose',
      sale_date TEXT,
      source TEXT DEFAULT 'seed',
      listing_title TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
    )
  `)

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_ph_game_id
    ON price_history(game_id)
  `)

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_ph_sale_date
    ON price_history(sale_date)
  `)
}

function parseConsoleGeneration(value) {
  const raw = String(value || '').trim()
  if (!raw) {
    return null
  }

  const numeric = Number.parseInt(raw, 10)
  if (Number.isInteger(numeric)) {
    return numeric
  }

  const normalized = raw.toLowerCase()
  const map = new Map([
    ['first', 1],
    ['second', 2],
    ['third', 3],
    ['fourth', 4],
    ['fifth', 5],
    ['sixth', 6],
    ['seventh', 7],
    ['eighth', 8],
    ['ninth', 9],
  ])

  for (const [token, rank] of map.entries()) {
    if (normalized.includes(token)) {
      return rank
    }
  }

  return null
}

async function ensureConsolesSeeded() {
  const { Console } = getLegacyRuntime()

  const existingCount = await Console.count().catch(() => 0)
  if (existingCount > 0) {
    return
  }

  const seedPath = path.join(__dirname, '..', '..', 'data', 'consoles.json')
  const raw = await fs.promises.readFile(seedPath, 'utf8').catch(() => null)
  if (!raw) {
    return
  }

  const items = JSON.parse(raw)
  if (!Array.isArray(items) || !items.length) {
    return
  }

  const rows = items
    .map((item) => ({
      id: String(item.id || '').trim(),
      slug: String(item.id || item.slug || '').trim(),
      name: String(item.name || '').trim(),
      manufacturer: String(item.manufacturer || 'Unknown').trim(),
      generation: parseConsoleGeneration(item.generation),
      releaseYear: Number.isInteger(Number(item.release_year)) ? Number(item.release_year) : null,
    }))
    .filter((item) => item.id && item.slug && item.name)

  if (!rows.length) {
    return
  }

  await Console.bulkCreate(rows, {
    ignoreDuplicates: true,
  })
}

const app = express()

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : '*',
}))
app.use(express.json())
app.use(express.static(path.join(__dirname, '..', 'public')))

app.use(handleAsync(async (_req, _res, next) => {
  if (!process.env.VERCEL || useSupabaseServerlessRoutes) {
    return next()
  }

  await ensureRuntimeReady()
  return next()
}))

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

  if (!useSupabaseServerlessRoutes) {
    const {
      Game,
      storagePath,
      databaseMode,
      databaseTarget,
    } = getLegacyRuntime()

    games = await Game.count().catch(() => 0)
    database = databaseMode
    storage = databaseTarget || storagePath
  } else if (supabaseMode === 'supabase') {
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

app.use(require('./routes'))

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'))
})

app.use(errorHandler)

async function startServer(portOverride) {
  const {
    sequelize,
    databaseMode,
    Franchise,
    Game,
    syncGamesFromPrototype,
  } = getLegacyRuntime()
  // Patch db_supabase with the correct sequelize instance
  const dbSupabase = require('../db_supabase')
  if (dbSupabase.setSequelize) {
    dbSupabase.setSequelize(sequelize)
  }
  // Store the correct Sequelize instance on app.locals for route handlers
  app.locals.sequelize = sequelize
  app.locals.databaseMode = databaseMode
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
  await ensurePriceHistoryTable()
  await runMigrations(sequelize)
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

  await ensureConsolesSeeded()

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
