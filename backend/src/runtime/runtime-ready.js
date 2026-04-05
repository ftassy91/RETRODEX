'use strict'

const { assertRuntimeSchemaReady } = require('./runtime-schema')
const { warmUp: warmUpCatalogCache } = require('../services/public-game/games-catalog-cache')

function createRuntimeReady({ app, getLegacyRuntime, bindRuntimeLocals }) {
  let runtimeReadyPromise = null

  async function ensureRuntimeReady() {
    if (runtimeReadyPromise) {
      return runtimeReadyPromise
    }

    runtimeReadyPromise = (async () => {
      const runtime = getLegacyRuntime()
      bindRuntimeLocals(app, runtime)
      await runtime.sequelize.authenticate()
      await assertRuntimeSchemaReady({ sequelize: runtime.sequelize })
      // Pre-populate catalog cache in the background — don't block runtime init
      warmUpCatalogCache().catch((err) => console.error('[runtime] catalog warm-up failed', err))
      return runtime
    })().catch((error) => {
      runtimeReadyPromise = null
      throw error
    })

    return runtimeReadyPromise
  }

  return ensureRuntimeReady
}

module.exports = {
  createRuntimeReady,
}
