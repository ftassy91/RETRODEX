#!/usr/bin/env node
'use strict'

const { sequelize } = require('../src/database')
const { runMigrations } = require('../src/services/migration-runner')

async function main() {
  await sequelize.authenticate()
  const executed = await runMigrations(sequelize)
  console.log(JSON.stringify({
    ok: true,
    executedCount: executed.length,
    executed,
  }, null, 2))
}

main().catch(async (error) => {
  console.error('[db:migrate] Failed:', error)
  process.exitCode = 1
}).finally(async () => {
  await sequelize.close().catch(() => {})
})
