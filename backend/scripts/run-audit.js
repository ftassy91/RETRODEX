'use strict'

const { sequelize } = require('../src/database')
const { runMigrations } = require('../src/services/migration-runner')
const { writeAuditReports } = require('../src/services/admin/audit-service')

function parseIdsFlag(argv) {
  const token = argv.find((entry) => String(entry).startsWith('--ids='))
  if (!token) {
    return []
  }
  return Array.from(new Set(
    String(token).slice('--ids='.length).split(',').map((value) => value.trim()).filter(Boolean)
  ))
}

async function main() {
  await runMigrations(sequelize)
  const gameIds = parseIdsFlag(process.argv)
  const result = await writeAuditReports({ gameIds })
  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((error) => {
    console.error('[run-audit]', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await sequelize.close()
  })
