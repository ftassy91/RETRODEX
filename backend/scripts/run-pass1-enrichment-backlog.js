#!/usr/bin/env node
'use strict'

const { sequelize } = require('../src/database')
const { runMigrations } = require('../src/services/migration-runner')
const {
  PASS1_KEY,
} = require('../src/services/curation-service')
const {
  buildPass1EnrichmentBacklogReport,
  writePass1EnrichmentBacklogReport,
} = require('../src/services/enrichment-backlog-service')

function parseNumberFlag(name, fallback) {
  const prefix = `--${name}=`
  const raw = process.argv.find((entry) => String(entry).startsWith(prefix))
  if (!raw) {
    return fallback
  }

  const numeric = Number(String(raw).slice(prefix.length))
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback
}

async function main() {
  const perConsoleLimit = parseNumberFlag('per-console', 3)
  const globalLimit = parseNumberFlag('global-limit', 40)

  await runMigrations(sequelize)

  const report = await buildPass1EnrichmentBacklogReport({
    passKey: PASS1_KEY,
    perConsoleLimit,
    globalLimit,
  })
  const paths = await writePass1EnrichmentBacklogReport(report)

  console.log(JSON.stringify({
    passKey: report.passKey,
    generatedAt: report.generatedAt,
    summary: report.summary,
    topGames: report.globalTargets.slice(0, 10).map((entry) => ({
      gameId: entry.gameId,
      title: entry.title,
      consoleId: entry.consoleId,
      consoleName: entry.consoleName,
      status: entry.status,
      backlogScore: entry.backlogScore,
      opportunitySections: entry.opportunitySections,
      missingRelevantSections: entry.missingRelevantSections,
      rationale: entry.rationale,
    })),
    reports: paths,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error('[run-pass1-enrichment-backlog]', error && error.stack ? error.stack : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await sequelize.close()
  })
