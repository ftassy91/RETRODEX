'use strict'

const path = require('path')

const cors = require('cors')
const express = require('express')

const { handleAsync } = require('../helpers/query')
const { errorHandler } = require('../middleware/error')

function createApp({
  ensureRuntimeReady,
  getLegacyRuntime,
  countSupabaseGames,
  supabaseMode,
  useSupabaseServerlessRoutes,
}) {
  const app = express()

  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
      : '*',
  }))
  app.use(express.json())
  app.use(express.static(path.join(__dirname, '..', '..', 'public')))

  app.use(handleAsync(async (_req, _res, next) => {
    if (useSupabaseServerlessRoutes) {
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

  app.get('/api/health', handleAsync(async (_req, res) => {
    let games = 0
    let database = supabaseMode
    let db = process.env.DATABASE_URL ? 'postgres' : 'sqlite'
    let storage = process.env.SUPABASE_URL || process.env.SUPERDATA_Project_URL || null

    if (!useSupabaseServerlessRoutes) {
      const runtime = getLegacyRuntime()
      games = await runtime.Game.count().catch(() => 0)
      database = runtime.databaseMode
      storage = runtime.databaseTarget || runtime.storagePath
    } else if (supabaseMode === 'supabase') {
      games = await countSupabaseGames()
      db = 'supabase'
    } else {
      const runtime = getLegacyRuntime()
      games = await runtime.Game.count().catch(() => 0)
      database = runtime.databaseMode
      storage = runtime.databaseTarget || runtime.storagePath
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

  app.use(require('../routes'))

  app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '..', '..', 'public', '404.html'))
  })

  app.use(errorHandler)

  return app
}

module.exports = {
  createApp,
}
