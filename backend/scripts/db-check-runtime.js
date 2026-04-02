#!/usr/bin/env node
'use strict'

const { sequelize } = require('../src/database')
const { databaseMode, databaseTarget, storagePath } = require('../src/database')
const { getRuntimeSchemaReport } = require('../src/runtime/runtime-schema')

async function main() {
  await sequelize.authenticate()
  const report = await getRuntimeSchemaReport({ sequelize })

  console.log(JSON.stringify({
    ok: report.ok,
    databaseMode,
    databaseTarget: databaseTarget || storagePath,
    issues: report.issues,
  }, null, 2))

  if (!report.ok) {
    process.exitCode = 1
  }
}

main().catch(async (error) => {
  console.error('[db:check-runtime] Failed:', error)
  process.exitCode = 1
}).finally(async () => {
  await sequelize.close().catch(() => {})
})
