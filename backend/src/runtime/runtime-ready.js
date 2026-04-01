'use strict'

const { assertRuntimeSchemaReady } = require('./runtime-schema')

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
