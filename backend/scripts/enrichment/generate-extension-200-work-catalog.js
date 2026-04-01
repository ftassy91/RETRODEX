#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { sequelize } = require('../../src/database')
const { runMigrations } = require('../../src/services/migration-runner')
const { getGameAuditEntries } = require('../../src/services/admin/audit')
const {
  EXTENSION200_DIR,
  timestamp,
  ensureDir,
  parseNumberFlag,
  loadCurationMaps,
  normalizeCatalogEntry,
} = require('./_work-catalog-common')

async function main() {
  const limit = parseNumberFlag(process.argv, 'limit', 200)
  const minCompleteness = parseNumberFlag(process.argv, 'min-completeness', 95)
  const minConfidence = parseNumberFlag(process.argv, 'min-confidence', 90)

  await runMigrations(sequelize)
  ensureDir(EXTENSION200_DIR)

  const { curationStatusById, publishedIds } = loadCurationMaps()
  const entries = await getGameAuditEntries({ limit: 5000, persist: false })

  const eligible = entries
    .filter((entry) => String(entry.tier || '') !== 'Tier A')
    .filter((entry) => Number(entry.completenessScore || 0) >= minCompleteness)
    .filter((entry) => Number(entry.confidenceScore || 0) >= minConfidence)
    .filter((entry) => Array.isArray(entry.missingCriticalFields) && entry.missingCriticalFields.length === 0)
    .sort((left, right) => Number(right.priorityScore || 0) - Number(left.priorityScore || 0)
      || Number(right.confidenceScore || 0) - Number(left.confidenceScore || 0)
      || Number(right.sourceCoverageScore || 0) - Number(left.sourceCoverageScore || 0)
      || Number(right.freshnessScore || 0) - Number(left.freshnessScore || 0)
      || String(left.title || '').localeCompare(String(right.title || ''), 'fr', { sensitivity: 'base' }))

  const selected = eligible.slice(0, limit)
  const buffer = eligible.slice(limit)

  const catalog = selected.map((entry, index) => normalizeCatalogEntry(entry, curationStatusById, publishedIds, {
    rank: index + 1,
    band: 'extension200',
  }))

  const output = {
    generatedAt: new Date().toISOString(),
    label: 'extension200',
    source: 'getGameAuditEntries(limit=5000,persist=false)',
    selection: {
      tier: 'non-Tier A',
      selected: catalog.length,
      buffer: buffer.length,
      minCompleteness,
      minConfidence,
    },
    metrics: {
      completeOrBetter: catalog.filter((entry) => ['complete', 'locked', 'published'].includes(String(entry.curationStatus || ''))).length,
      lockedOrPublished: catalog.filter((entry) => ['locked', 'published'].includes(String(entry.curationStatus || ''))).length,
      published: catalog.filter((entry) => entry.isPublished).length,
    },
    ids: catalog.map((entry) => entry.entityId),
    catalog,
    buffer: buffer.map((entry, index) => normalizeCatalogEntry(entry, curationStatusById, publishedIds, {
      rank: limit + index + 1,
      band: 'extension200-buffer',
    })),
  }

  const outputPath = path.join(EXTENSION200_DIR, `${timestamp()}_extension200_work_catalog.json`)
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))

  console.log(JSON.stringify({
    mode: 'generate',
    outputPath,
    selected: catalog.length,
    buffer: buffer.length,
    metrics: output.metrics,
    firstIds: catalog.slice(0, 10).map((entry) => entry.entityId),
  }, null, 2))
}

main()
  .catch((error) => {
    console.error('[generate-extension-200-work-catalog]', error && error.stack ? error.stack : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await sequelize.close()
  })
