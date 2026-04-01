#!/usr/bin/env node
'use strict'

const { sequelize } = require('../../src/database')
const { runMigrations } = require('../../src/services/migration-runner')
const { getGameAuditEntries } = require('../../src/services/admin/audit')
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
  const limit = parseNumberFlag(process.argv, 'limit', 15)
  const explicitIds = parseIds(process.argv)
  const publishedOnly = process.argv.includes('--published-only')
  const tier = parseStringFlag(process.argv, 'tier', null)
  const batchKey = parseStringFlag(process.argv, 'batch-key', buildBatchKey('generated_summary'))

  await runMigrations(sequelize)

  const entries = await getGameAuditEntries({
    limit: 5000,
    persist: false,
    gameIds: explicitIds,
  })

  const selected = entries
    .filter((entry) => entry.missingCriticalFields.includes('summary'))
    .filter((entry) => !publishedOnly || String(entry.curationStatus || '') === 'published')
    .filter((entry) => !tier || String(entry.tier || '') === tier)
    .slice(0, limit)

  if (!selected.length) {
    throw new Error('No summary candidates matched the requested filters')
  }

  const manifest = {
    batchKey,
    batchType: 'summary',
    reviewStatus: 'review_required',
    notes: `Generated summary candidate batch from audit (${selected.length} targets)`,
    generatedFrom: {
      source: 'audit',
      filters: {
        limit,
        publishedOnly,
        tier,
        explicitIds,
      },
      generatedAt: new Date().toISOString(),
    },
    sources: ['audit'],
    writeTargets: ['games', 'game_editorial', 'source_records', 'field_provenance'],
    publishDomains: ['records', 'editorial', 'ui'],
    postChecks: ['records', 'editorial', 'ui'],
    ids: selected.map((entry) => entry.entityId),
    payload: selected.map((entry) => ({
      gameId: entry.entityId,
      title: entry.title,
      summary: '',
      sourceName: 'internal',
      sourceType: 'knowledge_registry',
      sourceUrl: null,
      confidenceLevel: 0.8,
      notes: `TODO curate summary for ${entry.title}`,
      candidateContext: {
        tier: entry.tier,
        curationStatus: entry.curationStatus || null,
        platform: entry.platform || null,
        priorityScore: entry.priorityScore,
      },
    })),
  }

  const manifestPath = writeGeneratedManifest(batchKey, manifest)
  console.log(JSON.stringify({
    mode: 'generate',
    batchType: 'summary',
    reviewStatus: manifest.reviewStatus,
    manifestPath,
    targetCount: selected.length,
    ids: manifest.ids,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error('[generate-summary-batch-manifest]', error && error.stack ? error.stack : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await sequelize.close()
  })
