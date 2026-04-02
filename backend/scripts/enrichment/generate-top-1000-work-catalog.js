#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { sequelize } = require('../../src/database')
const { runMigrations } = require('../../src/services/migration-runner')
const { getGameAuditEntries } = require('../../src/services/admin/audit')
const Database = require('better-sqlite3')

const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'data', 'audit', 'top1000')

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }
}

function loadCurationMaps() {
  const db = new Database(SQLITE_PATH, { readonly: true })
  try {
    const stateRows = db.prepare(`
      SELECT game_id, status
      FROM game_curation_states
    `).all()

    const publicationRows = db.prepare(`
      SELECT game_id
      FROM console_publication_slots
      WHERE is_active = 1
    `).all()

    return {
      curationStatusById: new Map(stateRows.map((row) => [String(row.game_id), String(row.status || '').trim() || null])),
      publishedIds: new Set(publicationRows.map((row) => String(row.game_id))),
    }
  } finally {
    db.close()
  }
}

async function main() {
  const limit = 1000
  await runMigrations(sequelize)
  ensureOutputDir()

  const { curationStatusById, publishedIds } = loadCurationMaps()
  const entries = await getGameAuditEntries({ limit: 5000, persist: false })

  const topTier = entries
    .filter((entry) => String(entry.tier || '') === 'Tier A')
    .slice(0, 1005)

  if (topTier.length < 1000) {
    throw new Error(`Expected at least 1000 Tier A entries, got ${topTier.length}`)
  }

  const selected = topTier.slice(0, limit)
  const buffer = topTier.slice(limit)
  const catalog = selected.map((entry, index) => ({
    rank: index + 1,
    entityId: entry.entityId,
    title: entry.title,
    platform: entry.platform,
    tier: entry.tier,
    priorityScore: entry.priorityScore,
    completenessScore: entry.completenessScore,
    confidenceScore: entry.confidenceScore,
    sourceCoverageScore: entry.sourceCoverageScore,
    freshnessScore: entry.freshnessScore,
    missingCriticalFields: Array.isArray(entry.missingCriticalFields) ? entry.missingCriticalFields : [],
    policies: Array.isArray(entry.policies) ? entry.policies : [],
    curationStatus: curationStatusById.get(String(entry.entityId)) || null,
    isPublished: publishedIds.has(String(entry.entityId)),
  }))

  const output = {
    generatedAt: new Date().toISOString(),
    source: 'getGameAuditEntries(limit=5000,persist=false)',
    selection: {
      tier: 'Tier A',
      selected: catalog.length,
      buffer: buffer.length,
      totalTierAObserved: topTier.length,
    },
    metrics: {
      missingDevTeam: catalog.filter((entry) => entry.missingCriticalFields.includes('dev_team')).length,
      missingComposers: catalog.filter((entry) => entry.missingCriticalFields.includes('ost_composers')).length,
      missingManual: catalog.filter((entry) => entry.missingCriticalFields.includes('manual_url')).length,
      missingMaps: catalog.filter((entry) => entry.missingCriticalFields.includes('maps')).length,
      lockedOrPublished: catalog.filter((entry) => ['locked', 'published'].includes(String(entry.curationStatus || ''))).length,
      published: catalog.filter((entry) => entry.isPublished).length,
    },
    catalog,
    buffer: buffer.map((entry, index) => ({
      rank: limit + index + 1,
      entityId: entry.entityId,
      title: entry.title,
      platform: entry.platform,
      priorityScore: entry.priorityScore,
      completenessScore: entry.completenessScore,
      confidenceScore: entry.confidenceScore,
      missingCriticalFields: entry.missingCriticalFields,
    })),
  }

  const outputPath = path.join(OUTPUT_DIR, `${timestamp()}_top1000_work_catalog.json`)
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
    console.error('[generate-top-1000-work-catalog]', error && error.stack ? error.stack : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await sequelize.close()
  })
