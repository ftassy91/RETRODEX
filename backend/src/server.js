'use strict'

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

const { mode: supabaseMode, db: supabaseDb } = require('../db_supabase')
const { createApp } = require('./runtime/create-app')
const { createRuntimeReady } = require('./runtime/runtime-ready')

function loadLegacyRuntimeModule() {
  return require('./runtime/legacy-runtime')
}

function getLegacyRuntime(...args) {
  return loadLegacyRuntimeModule().getLegacyRuntime(...args)
}

function bindRuntimeLocals(...args) {
  return loadLegacyRuntimeModule().bindRuntimeLocals(...args)
}

const useSupabaseServerlessRoutes = Boolean(
  process.env.VERCEL
  && supabaseMode === 'supabase'
)

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

let ensureRuntimeReady = async () => {
  throw new Error('Runtime readiness is not initialized')
}

const app = createApp({
  countSupabaseGames,
  getLegacyRuntime,
  supabaseMode,
  useSupabaseServerlessRoutes,
  ensureRuntimeReady: (...args) => ensureRuntimeReady(...args),
})

ensureRuntimeReady = createRuntimeReady({
  app,
  getLegacyRuntime,
  bindRuntimeLocals,
})

async function startServer(portOverride) {
  if (!useSupabaseServerlessRoutes) {
    await ensureRuntimeReady()
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
    await sequelize.close().catch(() => {})
    process.exit(1)
  })
}

module.exports = app
module.exports.app = app
module.exports.startServer = startServer
