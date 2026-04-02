#!/usr/bin/env node
'use strict'

const { sequelize } = require('../../src/database')
const { runMigrations } = require('../../src/services/migration-runner')
const { buildPremiumCoverageEntries, selectTopPremiumCandidates } = require('../../src/services/admin/enrichment')
const { writeGeneratedManifest } = require('./_manifest-output-common')

function parseNumberFlag(argv, name, fallback) {
  const token = argv.find((value) => String(value).startsWith(`--${name}=`))
  if (!token) return fallback
  const numeric = Number(String(token).split('=').slice(1).join('='))
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback
}

function parseStringFlag(argv, name, fallback = null) {
  const token = argv.find((value) => String(value).startsWith(`--${name}=`))
  if (!token) return fallback
  return String(token).split('=').slice(1).join('=').trim() || fallback
}

function parseIds(argv) {
  const token = argv.find((value) => String(value).startsWith('--ids='))
  if (!token) return []
  return Array.from(new Set(String(token).slice('--ids='.length).split(',').map((value) => value.trim()).filter(Boolean)))
}

function buildBatchKey(prefix) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${prefix}_${stamp}`
}

async function main() {
  const limit = parseNumberFlag(process.argv, 'limit', 10)
  const explicitIds = parseIds(process.argv)
  const minTier = parseStringFlag(process.argv, 'from-tier', 'bronze')
  const publishedOnly = !process.argv.includes('--include-unpublished')
  const batchKey = parseStringFlag(process.argv, 'batch-key', buildBatchKey('generated_premium'))

  await runMigrations(sequelize)

  const entries = await buildPremiumCoverageEntries({ gameIds: explicitIds })
  const tierOrder = { none: 0, bronze: 1, silver: 2, gold: 3 }
  const minTierRank = tierOrder[String(minTier || 'bronze').toLowerCase()] ?? 1

  const selected = selectTopPremiumCandidates(entries, {
    limit: Math.max(limit * 3, 25),
    includeNonCandidates: true,
  })
    .filter((entry) => tierOrder[String(entry.completionTier || 'none').toLowerCase()] >= minTierRank)
    .filter((entry) => publishedOnly ? String(entry.curation?.status || '') === 'published' : true)
    .filter((entry) => String(entry.completionTier || 'none') !== 'gold')
    .slice(0, limit)

  if (!selected.length) {
    throw new Error('No premium candidates matched the requested filters')
  }

  const manifest = {
    batchKey,
    batchType: 'premium',
    reviewStatus: 'review_required',
    notes: `Generated premium candidate batch from coverage (${selected.length} targets)`,
    generatedFrom: {
      source: 'premium_coverage',
      filters: {
        limit,
        minTier,
        publishedOnly,
        explicitIds,
      },
      generatedAt: new Date().toISOString(),
    },
    sources: ['premium_coverage'],
    writeTargets: ['games', 'game_editorial', 'media_references', 'source_records', 'field_provenance'],
    publishDomains: ['records', 'editorial', 'media', 'ui'],
    postChecks: ['records', 'editorial', 'media', 'ui'],
    ids: selected.map((entry) => entry.gameId),
    payload: selected.map((entry) => ({
      gameId: entry.gameId,
      title: entry.title,
      media: [],
      candidateContext: {
        console: entry.console,
        completionTier: entry.completionTier,
        completenessScore: entry.completenessScore,
        premiumPriorityScore: entry.premiumPriorityScore || null,
        curationStatus: entry.curation?.status || null,
        auditTier: entry.audit?.tier || null,
        missingCoreRequirements: entry.missingCoreRequirements || [],
        missingDomainSignals: entry.missingDomainSignals || [],
      },
    })),
  }

  const manifestPath = writeGeneratedManifest(batchKey, manifest)
  console.log(JSON.stringify({
    mode: 'generate',
    batchType: 'premium',
    reviewStatus: manifest.reviewStatus,
    manifestPath,
    targetCount: selected.length,
    ids: manifest.ids,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error('[generate-premium-batch-manifest]', error && error.stack ? error.stack : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await sequelize.close()
  })
