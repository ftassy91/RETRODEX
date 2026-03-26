'use strict'

const { sequelize } = require('../src/database')
const { runMigrations } = require('../src/services/migration-runner')
const { writeAuditReports } = require('../src/services/audit-service')

async function main() {
  await runMigrations(sequelize)
  const result = await writeAuditReports()
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
