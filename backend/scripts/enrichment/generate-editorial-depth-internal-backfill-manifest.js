#!/usr/bin/env node
'use strict'

const path = require('path')
const Database = require('better-sqlite3')
const { writeGeneratedManifest } = require('./_manifest-output-common')
const {
  SQLITE_PATH,
  TOP1200_DIR,
  latestJsonFile,
  loadSelectionBand,
  parseNumberFlag,
  parseStringFlag,
} = require('./_work-catalog-common')

function parseBooleanFlag(argv, name) {
  return argv.includes(`--${name}`)
}

function buildBatchKey(prefix) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${prefix}_${stamp}`
}

function selectCandidates(db, band) {
  const ids = band.ids.slice(0, 1200)
  if (!ids.length) return []

  const rows = db.prepare(`
    SELECT
      g.id,
      g.title,
      g.summary AS game_summary,
      g.synopsis AS game_synopsis,
      ge.summary AS editorial_summary,
      ge.synopsis AS editorial_synopsis
    FROM games g
    LEFT JOIN game_editorial ge ON ge.game_id = g.id
    WHERE g.type = 'game'
      AND g.id IN (${ids.map(() => '?').join(', ')})
      AND (
        (ge.summary IS NOT NULL AND TRIM(ge.summary) <> '' AND (g.summary IS NULL OR TRIM(g.summary) = ''))
        OR
        (ge.synopsis IS NOT NULL AND TRIM(ge.synopsis) <> '' AND (g.synopsis IS NULL OR TRIM(g.synopsis) = ''))
      )
  `).all(...ids)

  const metaById = new Map(
    band.items
      .map((item) => [String(item.entityId), item])
  )

  return rows
    .map((row) => {
      const meta = metaById.get(String(row.id)) || {}
      return {
        gameId: String(row.id),
        title: row.title,
        summary: row.editorial_summary && !row.game_summary ? row.editorial_summary : '',
        synopsis: row.editorial_synopsis && !row.game_synopsis ? row.editorial_synopsis : '',
        candidateContext: {
          band: meta.band || null,
          tier: meta.tier || null,
          rank: Number(meta.rank || 0) || null,
          curationStatus: meta.curationStatus || null,
          priorityScore: Number(meta.priorityScore || 0),
          completenessScore: Number(meta.completenessScore || 0),
          confidenceScore: Number(meta.confidenceScore || 0),
        },
      }
    })
    .filter((entry) => entry.summary || entry.synopsis)
    .sort((left, right) => {
      const leftStatus = String(left.candidateContext.curationStatus || '')
      const rightStatus = String(right.candidateContext.curationStatus || '')
      const statusWeight = (value) => {
        if (value === 'published') return 0
        if (value === 'locked') return 1
        if (value === 'complete') return 2
        return 3
      }
      const statusDelta = statusWeight(leftStatus) - statusWeight(rightStatus)
      if (statusDelta !== 0) return statusDelta

      const rankDelta = Number(left.candidateContext.rank || 999999) - Number(right.candidateContext.rank || 999999)
      if (rankDelta !== 0) return rankDelta

      return String(left.title || '').localeCompare(String(right.title || ''))
    })
}

function main() {
  const top1200Path = parseStringFlag(process.argv, 'top1200', latestJsonFile(TOP1200_DIR))
  const limit = parseNumberFlag(process.argv, 'limit', 200)
  const publishedOnly = parseBooleanFlag(process.argv, 'published-only')
  const reviewStatus = parseStringFlag(process.argv, 'review-status', 'ready')
  const batchKey = parseStringFlag(
    process.argv,
    'batch-key',
    buildBatchKey('generated_editorial_depth_internal_backfill')
  )

  const band = loadSelectionBand(top1200Path)
  const db = new Database(SQLITE_PATH, { readonly: true })

  try {
    let selected = selectCandidates(db, band)
    if (publishedOnly) {
      selected = selected.filter((entry) => entry.candidateContext.curationStatus === 'published')
    }
    selected = selected.slice(0, limit)

    if (!selected.length) {
      throw new Error('No internal editorial-depth backfill candidates matched the requested filters')
    }

    const manifest = {
      batchKey,
      batchType: 'richness',
      reviewStatus,
      notes: `Generated internal editorial-depth backfill batch (${selected.length} targets)`,
      generatedFrom: {
        source: 'internal_editorial_backfill',
        generatedAt: new Date().toISOString(),
        filters: {
          top1200Path,
          limit,
          publishedOnly,
        },
      },
      sources: ['internal'],
      writeTargets: ['games', 'game_editorial', 'source_records', 'field_provenance'],
      publishDomains: ['records', 'editorial', 'ui'],
      postChecks: ['records', 'editorial', 'ui'],
      ids: selected.map((entry) => entry.gameId),
      payload: selected.map((entry) => ({
        gameId: entry.gameId,
        title: entry.title,
        summary: entry.summary,
        synopsis: entry.synopsis,
        sourceName: 'internal',
        sourceType: 'knowledge_registry',
        sourceUrl: null,
        confidenceLevel: 0.94,
        notes: [
          entry.summary ? 'Backfilled games.summary from existing game_editorial.summary.' : null,
          entry.synopsis ? 'Backfilled games.synopsis from existing game_editorial.synopsis.' : null,
        ].filter(Boolean).join(' '),
        candidateContext: entry.candidateContext,
      })),
    }

    const manifestPath = writeGeneratedManifest(batchKey, manifest)
    console.log(JSON.stringify({
      mode: 'generate',
      batchType: 'richness',
      reviewStatus: manifest.reviewStatus,
      manifestPath,
      top1200Path,
      targetCount: manifest.ids.length,
      summaryCount: manifest.payload.filter((entry) => entry.summary).length,
      synopsisCount: manifest.payload.filter((entry) => entry.synopsis).length,
      ids: manifest.ids,
    }, null, 2))
  } finally {
    db.close()
  }
}

try {
  main()
} catch (error) {
  console.error('[generate-editorial-depth-internal-backfill-manifest]', error && error.stack ? error.stack : error)
  process.exitCode = 1
}
