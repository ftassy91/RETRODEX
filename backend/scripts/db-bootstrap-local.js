#!/usr/bin/env node
'use strict'

const { bootstrapLocalSandbox } = require('../src/runtime/local-bootstrap')
const { getLegacyRuntime } = require('../src/runtime/legacy-runtime')

async function main() {
  const result = await bootstrapLocalSandbox()
  console.log(JSON.stringify({
    ok: true,
    ...result,
  }, null, 2))
}

main().catch(async (error) => {
  console.error('[db:bootstrap-local] Failed:', error)
  process.exitCode = 1
}).finally(async () => {
  const { sequelize } = getLegacyRuntime()
  await sequelize.close().catch(() => {})
})
