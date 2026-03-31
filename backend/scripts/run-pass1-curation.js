#!/usr/bin/env node
'use strict'

const { sequelize } = require('../src/database')
const { runMigrations } = require('../src/services/migration-runner')
const {
  PASS1_KEY,
  buildPass1CurationDataset,
  persistPass1Curation,
  writePass1Reports,
} = require('../src/services/admin/curation-service')

const APPLY = process.argv.includes('--apply')

async function main() {
  await runMigrations(sequelize)

  const dataset = await buildPass1CurationDataset({
    passKey: PASS1_KEY,
  })
  const reports = await writePass1Reports(dataset)
  const persisted = APPLY
    ? await persistPass1Curation(dataset, { passKey: PASS1_KEY })
    : null

  console.log(JSON.stringify({
    mode: APPLY ? 'apply' : 'dry-run',
    passKey: PASS1_KEY,
    summary: {
      linkedConsoles: dataset.targetConsoleIds.length,
      profiles: dataset.profiles.length,
      states: dataset.states.length,
      slots: dataset.publicationSlots.length,
      events: dataset.events.length,
      statusCounts: dataset.states.reduce((acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1
        return acc
      }, {}),
      underfilledConsoles: dataset.consoleMatrix.filter((row) => row.underfilled).map((row) => row.consoleId),
    },
    persisted,
    reports,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error('[run-pass1-curation]', error && error.stack ? error.stack : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await sequelize.close()
  })
