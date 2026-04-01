#!/usr/bin/env node
'use strict'

const path = require('path')
const { sequelize } = require('../../src/database')
const { runMigrations } = require('../../src/services/migration-runner')
const { getGameAuditEntries } = require('../../src/services/admin/audit')
const { writeGeneratedManifest } = require('./_manifest-output-common')
const Database = require('better-sqlite3')

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

function tableExists(db, tableName) {
  const row = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name = ?
  `).get(tableName)
  return Boolean(row)
}

function normalizeComposerList(rawValue) {
  let parsed = rawValue
  if (typeof rawValue === 'string') {
    try {
      parsed = JSON.parse(rawValue)
    } catch (error) {
      parsed = []
    }
  }

  const seen = new Set()
  return (Array.isArray(parsed) ? parsed : [])
    .map((entry) => {
      if (typeof entry === 'string') {
        return { name: entry.trim(), role: 'composer' }
      }
      if (!entry || typeof entry !== 'object') return null
      return {
        ...entry,
        name: String(entry.name || '').trim(),
        role: String(entry.role || 'composer').trim() || 'composer',
      }
    })
    .filter((entry) => entry && entry.name)
    .filter((entry) => {
      const dedupeKey = `${entry.name.toLowerCase()}::${entry.role.toLowerCase()}`
      if (seen.has(dedupeKey)) return false
      seen.add(dedupeKey)
      return true
    })
}

function buildAutofillMap(gameIds) {
  const db = new Database(SQLITE_PATH, { readonly: true })
  try {
    const canonicalMap = new Map()
    if (tableExists(db, 'game_people') && tableExists(db, 'people')) {
      const canonicalRows = db.prepare(`
        SELECT
          gp.game_id AS gameId,
          p.name AS personName,
          gp.billing_order AS billingOrder,
          gp.confidence AS confidence
        FROM game_people gp
        JOIN people p
          ON p.id = gp.person_id
        WHERE gp.role = 'composer'
          AND gp.game_id IN (${gameIds.map(() => '?').join(', ')})
        ORDER BY gp.game_id ASC,
                 CASE WHEN gp.billing_order IS NULL THEN 9999 ELSE gp.billing_order END ASC,
                 p.name ASC
      `).all(...gameIds)

      for (const row of canonicalRows) {
        const gameId = String(row.gameId)
        const composer = {
          name: String(row.personName || '').trim(),
          role: 'composer',
        }
        if (!composer.name) continue
        if (Number.isFinite(Number(row.billingOrder))) composer.billingOrder = Number(row.billingOrder)
        if (Number.isFinite(Number(row.confidence))) composer.confidence = Number(row.confidence)
        const existing = canonicalMap.get(gameId) || []
        existing.push(composer)
        canonicalMap.set(gameId, existing)
      }
    }

    const legacyRows = db.prepare(`
      SELECT
        g.id AS gameId,
        g.ost_composers AS ostComposers
      FROM games g
      WHERE g.id IN (${gameIds.map(() => '?').join(', ')})
        AND TRIM(COALESCE(g.ost_composers, '')) <> ''
    `).all(...gameIds)

    const legacyMap = new Map(legacyRows.map((row) => [String(row.gameId), normalizeComposerList(row.ostComposers)]))

    return new Map(gameIds.map((gameId) => {
      const canonicalComposers = normalizeComposerList(canonicalMap.get(gameId) || [])
      if (canonicalComposers.length) {
        return [String(gameId), {
          ostComposers: canonicalComposers,
          sourceName: 'internal',
          sourceType: 'canonical_people',
          sourceUrl: '',
          confidenceLevel: 0.88,
          notes: 'Auto-filled from canonical composer credits (game_people/people)',
          autofillMode: 'canonical_people',
          internalSource: 'game_people',
        }]
      }

      const legacyComposers = normalizeComposerList(legacyMap.get(gameId) || [])
      if (legacyComposers.length) {
        return [String(gameId), {
          ostComposers: legacyComposers,
          sourceName: 'internal',
          sourceType: 'legacy_runtime',
          sourceUrl: '',
          confidenceLevel: 0.72,
          notes: 'Auto-filled from existing games.ost_composers',
          autofillMode: 'legacy_runtime',
          internalSource: 'games.ost_composers',
        }]
      }

      return [String(gameId), null]
    }))
  } finally {
    db.close()
  }
}

async function main() {
  const limit = parseNumberFlag(process.argv, 'limit', 15)
  const explicitIds = parseIds(process.argv)
  const tier = parseStringFlag(process.argv, 'tier', 'Tier A')
  const publishedOnly = process.argv.includes('--published-only')
  const batchKey = parseStringFlag(process.argv, 'batch-key', buildBatchKey('generated_composers'))
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
    .filter((entry) => entry.missingCriticalFields.includes('ost_composers') || (allowExplicitIds && explicitIds.includes(entry.entityId)))
    .filter((entry) => !tier || String(entry.tier || '') === tier)
    .filter((entry) => !publishedOnly || String(entry.curationStatus || '') === 'published')
    .slice(0, limit)

  if (!selected.length) {
    throw new Error('No composer candidates matched the requested filters')
  }

  const autofillMap = autofillSafe ? buildAutofillMap(selected.map((entry) => entry.entityId)) : new Map()

  const payload = selected.map((entry) => {
    const autofill = autofillMap.get(entry.entityId) || null
    return {
      gameId: entry.entityId,
      title: entry.title,
      ostComposers: autofill?.ostComposers || [],
      sourceName: autofill?.sourceName || '',
      sourceType: autofill?.sourceType || 'credits_reference',
      sourceUrl: autofill?.sourceUrl || '',
      confidenceLevel: autofill?.confidenceLevel ?? null,
      notes: autofill?.notes || `TODO curate composers for ${entry.title}`,
      candidateContext: {
        tier: entry.tier,
        curationStatus: entry.curationStatus || null,
        platform: entry.platform || null,
        priorityScore: entry.priorityScore,
        missingCriticalFields: entry.missingCriticalFields,
        autofillMode: autofill?.autofillMode || null,
        internalSource: autofill?.internalSource || null,
      },
    }
  })

  const completeCount = payload.filter((entry) => Array.isArray(entry.ostComposers) && entry.ostComposers.length && String(entry.sourceName || '').trim() && String(entry.sourceType || '').trim()).length
  const reviewStatus = readyIfComplete && completeCount === payload.length ? 'ready' : 'review_required'

  const manifest = {
    batchKey,
    batchType: 'composers',
    reviewStatus,
    notes: `Generated composer candidate batch from audit (${selected.length} targets)`,
    generatedFrom: {
      source: 'audit',
      filters: {
        limit,
        tier,
        publishedOnly,
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
    batchType: 'composers',
    reviewStatus: manifest.reviewStatus,
    manifestPath,
    targetCount: selected.length,
    ids: manifest.ids,
    completeCount,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error('[generate-composer-batch-manifest]', error && error.stack ? error.stack : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await sequelize.close()
  })
