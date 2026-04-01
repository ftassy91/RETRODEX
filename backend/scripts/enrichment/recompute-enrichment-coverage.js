#!/usr/bin/env node
'use strict'

const { sequelize } = require('../../src/database')
const { runMigrations } = require('../../src/services/migration-runner')
const {
  buildPremiumCoverageEntries,
  summarizePremiumCoverage,
  selectTopPremiumCandidates,
} = require('../../src/services/admin/enrichment')

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
  const candidateLimit = parseNumberFlag('candidate-limit', 100)
  const sampleLimit = parseNumberFlag('sample-limit', 10)

  await runMigrations(sequelize)

  const entries = await buildPremiumCoverageEntries()
  const summary = summarizePremiumCoverage(entries)
  const candidates = selectTopPremiumCandidates(entries, {
    limit: candidateLimit,
  })

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    summary,
    candidateLimit,
    sampleLimit,
    topCandidates: candidates.slice(0, sampleLimit).map((entry) => ({
      gameId: entry.gameId,
      title: entry.title,
      console: entry.console,
      completionTier: entry.completionTier,
      completenessScore: entry.completenessScore,
      premiumPriorityScore: entry.premiumPriorityScore,
      isPublishable: entry.isPublishable,
      isTop100Candidate: entry.isTop100Candidate,
      curationStatus: entry.curation?.status || null,
      auditTier: entry.audit?.tier || null,
      missingCoreRequirements: entry.missingCoreRequirements,
      missingDomainSignals: entry.missingDomainSignals.slice(0, 8),
    })),
  }, null, 2))
}

main()
  .catch((error) => {
    console.error('[recompute-enrichment-coverage]', error && error.stack ? error.stack : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await sequelize.close()
  })
