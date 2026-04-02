#!/usr/bin/env node
'use strict'

const { seedPrototypeLocal } = require('../src/runtime/local-bootstrap')
const { getLegacyRuntime } = require('../src/runtime/legacy-runtime')

async function main() {
  const args = new Set(process.argv.slice(2))
  const force = args.has('--force')
  const result = await seedPrototypeLocal({ force })
  console.log(JSON.stringify({
    ok: true,
    ...result,
  }, null, 2))
}

main().catch(async (error) => {
  console.error('[db:seed-prototype-local] Failed:', error)
  process.exitCode = 1
}).finally(async () => {
  const { sequelize } = getLegacyRuntime()
  await sequelize.close().catch(() => {})
})
