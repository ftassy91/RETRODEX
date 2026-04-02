'use strict'

const { sequelize, storagePath, databaseMode, databaseTarget } = require('../database')

let legacyRuntime = null

function getLegacyRuntime() {
  if (legacyRuntime) {
    return legacyRuntime
  }

  require('../models/associations')

  legacyRuntime = {
    sequelize,
    storagePath,
    databaseMode,
    databaseTarget,
    Game: require('../models/Game'),
    Franchise: require('../models/Franchise'),
    Console: require('../models/Console'),
    CollectionItem: require('../models/CollectionItem'),
    RetrodexIndex: require('../../models/RetrodexIndex'),
  }

  return legacyRuntime
}

function bindRuntimeLocals(app, runtime = getLegacyRuntime()) {
  const dbSupabase = require('../../db_supabase')
  if (dbSupabase.setSequelize) {
    dbSupabase.setSequelize(runtime.sequelize)
  }

  app.locals.sequelize = runtime.sequelize
  app.locals.databaseMode = runtime.databaseMode
}

module.exports = {
  bindRuntimeLocals,
  getLegacyRuntime,
}
