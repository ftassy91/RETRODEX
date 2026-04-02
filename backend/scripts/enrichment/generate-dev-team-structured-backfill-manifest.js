#!/usr/bin/env node
'use strict'

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

function uniqueMembers(values) {
  const seen = new Set()
  return values.filter((entry) => {
    const key = `${String(entry.role || '').toLowerCase()}::${String(entry.name || '').toLowerCase()}`
    if (!entry.name || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function loadCandidates(db, band) {
  const ids = band.ids.slice(0, 1200)
  if (!ids.length) return []

  const rows = db.prepare(`
    WITH company_dev AS (
      SELECT
        gc.game_id,
        c.name,
        ROW_NUMBER() OVER (PARTITION BY gc.game_id ORDER BY c.name COLLATE NOCASE) AS ord
      FROM game_companies gc
      JOIN companies c ON c.id = gc.company_id
      WHERE gc.role = 'developer'
    ),
    people_dev AS (
      SELECT
        gp.game_id,
        p.name,
        ROW_NUMBER() OVER (PARTITION BY gp.game_id ORDER BY p.name COLLATE NOCASE) AS ord
      FROM game_people gp
      JOIN people p ON p.id = gp.person_id
      WHERE gp.role = 'developer'
    )
    SELECT
      g.id,
      g.title,
      g.dev_team,
      cd.name AS company_name,
      cd.ord AS company_ord,
      pd.name AS person_name,
      pd.ord AS person_ord
    FROM games g
    LEFT JOIN company_dev cd ON cd.game_id = g.id
    LEFT JOIN people_dev pd ON pd.game_id = g.id
    WHERE g.type = 'game'
      AND g.id IN (${ids.map(() => '?').join(', ')})
      AND (g.dev_team IS NULL OR TRIM(g.dev_team) = '')
      AND (cd.name IS NOT NULL OR pd.name IS NOT NULL)
    ORDER BY g.id, cd.ord, pd.ord
  `).all(...ids)

  const metaById = new Map(band.items.map((item) => [String(item.entityId), item]))
  const grouped = new Map()

  for (const row of rows) {
    const gameId = String(row.id)
    if (!grouped.has(gameId)) {
      grouped.set(gameId, {
        gameId,
        title: row.title,
        companies: [],
        people: [],
        meta: metaById.get(gameId) || {},
      })
    }
    const entry = grouped.get(gameId)
    if (row.company_name) {
      entry.companies.push({ role: 'Developer', name: row.company_name })
    }
    if (row.person_name) {
      entry.people.push({ role: 'Developer', name: row.person_name })
    }
  }

  return Array.from(grouped.values())
    .map((entry) => {
      const companies = uniqueMembers(entry.companies)
      const people = uniqueMembers(entry.people)
      const devTeam = companies.length ? companies : people
      const autofillMode = companies.length ? 'company_developer_link' : 'developer_people_fallback'
      const confidenceLevel = companies.length ? 0.9 : 0.84
      return {
        gameId: entry.gameId,
        title: entry.title,
        devTeam,
        sourceName: 'internal',
        sourceType: 'structured_credits',
        sourceUrl: null,
        confidenceLevel,
        notes: companies.length
          ? 'Backfilled dev_team from existing game_companies developer links.'
          : 'Backfilled dev_team from existing game_people developer credits.',
        isInferred: true,
        candidateContext: {
          band: entry.meta.band || null,
          tier: entry.meta.tier || null,
          rank: Number(entry.meta.rank || 0) || null,
          curationStatus: entry.meta.curationStatus || null,
          priorityScore: Number(entry.meta.priorityScore || 0),
          completenessScore: Number(entry.meta.completenessScore || 0),
          confidenceScore: Number(entry.meta.confidenceScore || 0),
          autofillMode,
          companyDeveloperCount: companies.length,
          peopleDeveloperCount: people.length,
        },
      }
    })
    .filter((entry) => entry.devTeam.length)
    .sort((left, right) => {
      const leftMeta = left.candidateContext
      const rightMeta = right.candidateContext
      const statusWeight = (value) => {
        if (value === 'published') return 0
        if (value === 'locked') return 1
        if (value === 'complete') return 2
        return 3
      }
      const statusDelta = statusWeight(String(leftMeta.curationStatus || '')) - statusWeight(String(rightMeta.curationStatus || ''))
      if (statusDelta !== 0) return statusDelta
      const rankDelta = Number(leftMeta.rank || 999999) - Number(rightMeta.rank || 999999)
      if (rankDelta !== 0) return rankDelta
      return String(left.title || '').localeCompare(String(right.title || ''))
    })
}

function main() {
  const top1200Path = parseStringFlag(process.argv, 'top1200', latestJsonFile(TOP1200_DIR))
  const limit = parseNumberFlag(process.argv, 'limit', 1200)
  const publishedOnly = parseBooleanFlag(process.argv, 'published-only')
  const reviewStatus = parseStringFlag(process.argv, 'review-status', 'ready')
  const batchKey = parseStringFlag(
    process.argv,
    'batch-key',
    buildBatchKey('generated_dev_team_structured_backfill')
  )

  const band = loadSelectionBand(top1200Path)
  const db = new Database(SQLITE_PATH, { readonly: true })

  try {
    let selected = loadCandidates(db, band)
    if (publishedOnly) {
      selected = selected.filter((entry) => entry.candidateContext.curationStatus === 'published')
    }
    selected = selected.slice(0, limit)

    if (!selected.length) {
      throw new Error('No structured dev_team backfill candidates matched the requested filters')
    }

    const manifest = {
      batchKey,
      batchType: 'dev_team',
      reviewStatus,
      notes: `Generated structured dev_team backfill batch (${selected.length} targets)`,
      generatedFrom: {
        source: 'internal_structured_credits_backfill',
        generatedAt: new Date().toISOString(),
        filters: {
          top1200Path,
          limit,
          publishedOnly,
        },
      },
      sources: ['internal'],
      writeTargets: ['games', 'game_people', 'people', 'source_records', 'field_provenance'],
      publishDomains: ['records', 'credits_music', 'ui'],
      postChecks: ['records', 'credits_music', 'ui'],
      ids: selected.map((entry) => entry.gameId),
      payload: selected,
    }

    const manifestPath = writeGeneratedManifest(batchKey, manifest)
    console.log(JSON.stringify({
      mode: 'generate',
      batchType: 'dev_team',
      reviewStatus: manifest.reviewStatus,
      manifestPath,
      top1200Path,
      targetCount: manifest.ids.length,
      companyBackfills: manifest.payload.filter((entry) => entry.candidateContext.autofillMode === 'company_developer_link').length,
      peopleFallbackBackfills: manifest.payload.filter((entry) => entry.candidateContext.autofillMode === 'developer_people_fallback').length,
      ids: manifest.ids.slice(0, 50),
    }, null, 2))
  } finally {
    db.close()
  }
}

try {
  main()
} catch (error) {
  console.error('[generate-dev-team-structured-backfill-manifest]', error && error.stack ? error.stack : error)
  process.exitCode = 1
}
