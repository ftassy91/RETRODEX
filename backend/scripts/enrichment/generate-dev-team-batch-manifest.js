#!/usr/bin/env node
'use strict'

const { sequelize } = require('../../src/database')
const { runMigrations } = require('../../src/services/migration-runner')
const { getGameAuditEntries } = require('../../src/services/admin/audit')
const { writeGeneratedManifest } = require('./_manifest-output-common')
const Database = require('better-sqlite3')
const path = require('path')

const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

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

function buildAutofillMap(gameIds) {
  const db = new Database(SQLITE_PATH, { readonly: true })
  try {
    const rows = db.prepare(`
      SELECT
        g.id AS gameId,
        g.developer,
        g.developerId,
        c.name AS companyName
      FROM games g
      LEFT JOIN companies c
        ON c.id = g.developerId
      WHERE g.id IN (${gameIds.map(() => '?').join(', ')})
    `).all(...gameIds)

    return new Map(rows.map((row) => {
      const companyName = String(row.companyName || '').trim()
      const developerText = String(row.developer || '').trim()
      if (companyName) {
        return [String(row.gameId), {
          devTeam: [{ role: 'developer', name: companyName }],
          sourceName: 'internal',
          sourceType: 'master_data',
          sourceUrl: null,
          confidenceLevel: 0.72,
          notes: `Auto-filled from companies.id=${row.developerId}`,
          isInferred: true,
          autofillMode: 'company_match',
        }]
      }
      if (developerText) {
        return [String(row.gameId), {
          devTeam: [{ role: 'developer', name: developerText }],
          sourceName: 'internal',
          sourceType: 'master_data',
          sourceUrl: null,
          confidenceLevel: 0.72,
          notes: 'Auto-filled from games.developer',
          isInferred: true,
          autofillMode: 'developer_text',
        }]
      }
      return [String(row.gameId), null]
    }))
  } finally {
    db.close()
  }
}

async function main() {
  const limit = parseNumberFlag(process.argv, 'limit', 15)
  const explicitIds = parseIds(process.argv)
  const publishedOnly = process.argv.includes('--published-only')
  const tier = parseStringFlag(process.argv, 'tier', 'Tier A')
  const batchKey = parseStringFlag(process.argv, 'batch-key', buildBatchKey('generated_dev_team'))
  const autofillSafe = process.argv.includes('--autofill-safe')
  const readyIfComplete = process.argv.includes('--ready-if-complete')
  const allowExplicitIds = process.argv.includes('--allow-explicit-ids')

  await runMigrations(sequelize)

  const entries = await getGameAuditEntries({
    limit: 5000,
    persist: false,
    gameIds: explicitIds,
  })

  const selected = entries
    .filter((entry) => entry.missingCriticalFields.includes('dev_team') || (allowExplicitIds && explicitIds.includes(entry.entityId)))
    .filter((entry) => !publishedOnly || String(entry.curationStatus || '') === 'published')
    .filter((entry) => !tier || String(entry.tier || '') === tier)
    .slice(0, limit)

  if (!selected.length) {
    throw new Error('No dev team candidates matched the requested filters')
  }

  const autofillMap = autofillSafe ? buildAutofillMap(selected.map((entry) => entry.entityId)) : new Map()

  const payload = selected.map((entry) => {
    const autofill = autofillMap.get(entry.entityId) || null
    return {
      gameId: entry.entityId,
      title: entry.title,
      devTeam: autofill?.devTeam || [],
      sourceName: autofill?.sourceName || 'internal',
      sourceType: autofill?.sourceType || 'knowledge_registry',
      sourceUrl: autofill?.sourceUrl || null,
      confidenceLevel: autofill?.confidenceLevel ?? 0.72,
      notes: autofill?.notes || `TODO curate dev team for ${entry.title}`,
      isInferred: autofill?.isInferred ?? true,
      candidateContext: {
        tier: entry.tier,
        curationStatus: entry.curationStatus || null,
        platform: entry.platform || null,
        priorityScore: entry.priorityScore,
        autofillMode: autofill?.autofillMode || null,
      },
    }
  })

  const completeCount = payload.filter((entry) => Array.isArray(entry.devTeam) && entry.devTeam.length).length
  const reviewStatus = readyIfComplete && completeCount === payload.length ? 'ready' : 'review_required'

  const manifest = {
    batchKey,
    batchType: 'dev_team',
    reviewStatus,
    notes: `Generated dev team candidate batch from audit (${selected.length} targets)`,
    generatedFrom: {
      source: 'audit',
      filters: {
        limit,
        publishedOnly,
        tier,
        explicitIds,
        allowExplicitIds,
        autofillSafe,
        readyIfComplete,
      },
      generatedAt: new Date().toISOString(),
    },
    sources: ['audit'],
    writeTargets: ['games', 'game_people', 'people', 'source_records', 'field_provenance'],
    publishDomains: ['records', 'credits_music', 'ui'],
    postChecks: ['records', 'credits_music', 'ui'],
    ids: selected.map((entry) => entry.entityId),
    payload,
  }

  const manifestPath = writeGeneratedManifest(batchKey, manifest)
  console.log(JSON.stringify({
    mode: 'generate',
    batchType: 'dev_team',
    reviewStatus: manifest.reviewStatus,
    manifestPath,
    targetCount: selected.length,
    ids: manifest.ids,
    completeCount,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error('[generate-dev-team-batch-manifest]', error && error.stack ? error.stack : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await sequelize.close()
  })
