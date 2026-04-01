#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')
const {
  SQLITE_PATH,
  AUDIT_DIR,
  TOP1200_DIR,
  latestJsonFile,
  loadSelectionBand,
  parseStringFlag,
  readJson,
  ensureDir,
  timestamp,
  uniqueStrings,
} = require('./_work-catalog-common')

const WIKIDATA_DIR = path.join(AUDIT_DIR, '..', 'enrichment', 'wikidata')
const OUTPUT_DIR = path.join(AUDIT_DIR, '..', 'enrichment', 'credits')

function latestAuditGamesFile() {
  const files = fs.readdirSync(AUDIT_DIR)
    .filter((entry) => entry.endsWith('_games.json') && !entry.includes('_scoped_'))
    .map((entry) => ({
      path: path.join(AUDIT_DIR, entry),
      stat: fs.statSync(path.join(AUDIT_DIR, entry)),
    }))
    .sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs)

  if (!files.length) {
    throw new Error(`No unscoped audit games found in ${AUDIT_DIR}`)
  }

  return files[0].path
}

function latestWikidataSnapshotFile() {
  if (!fs.existsSync(WIKIDATA_DIR)) return null

  const files = fs.readdirSync(WIKIDATA_DIR)
    .filter((entry) => entry.endsWith('_wikidata_credit_snapshot.json'))
    .map((entry) => ({
      path: path.join(WIKIDATA_DIR, entry),
      stat: fs.statSync(path.join(WIKIDATA_DIR, entry)),
    }))
    .sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs)

  return files[0]?.path || null
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function buildSiblingComposerMap(targetIds) {
  const db = new Database(SQLITE_PATH, { readonly: true })
  try {
    const rows = db.prepare('SELECT id, title, console, ost_composers FROM games').all()
    const byTitle = new Map()
    for (const row of rows) {
      const key = normalizeText(row.title)
      if (!byTitle.has(key)) byTitle.set(key, [])
      byTitle.get(key).push(row)
    }

    const result = new Map()
    for (const gameId of targetIds) {
      const row = rows.find((entry) => String(entry.id) === String(gameId))
      if (!row) continue
      const siblings = (byTitle.get(normalizeText(row.title)) || [])
        .filter((entry) => String(entry.id) !== String(gameId))
        .filter((entry) => String(entry.ost_composers || '').trim())
        .map((entry) => ({
          gameId: String(entry.id),
          console: entry.console,
        }))
      if (siblings.length) {
        result.set(String(gameId), siblings)
      }
    }

    return result
  } finally {
    db.close()
  }
}

function buildSourcesTested(debtType, snapshotEntry, siblingComposerMap, hasMusicbrainzDataset) {
  const tested = []

  if (debtType === 'composers') {
    tested.push({
      source: 'internal_canonical_records',
      status: 'checked',
      detail: 'Existing games/game_people/ost_composers evaluated before open-source escalation.',
    })

    const siblingHits = siblingComposerMap.get(String(snapshotEntry?.gameId || '')) || []
    tested.push({
      source: 'retrodex_internal_exact_title_sibling',
      status: siblingHits.length ? 'available_but_not_safe_enough' : 'no_match',
      detail: siblingHits.length
        ? siblingHits.map((entry) => `${entry.gameId} (${entry.console})`).join(', ')
        : 'No exact-title sibling with canonical composers.',
    })
  } else {
    tested.push({
      source: 'internal_canonical_records',
      status: 'checked',
      detail: 'Existing local credits and canonical developer bindings evaluated first.',
    })
  }

  tested.push({
    source: 'wikidata_open_snapshot',
    status: snapshotEntry ? snapshotEntry.status : 'not_attempted',
    detail: snapshotEntry
      ? snapshotEntry.reason || `Resolved in snapshot with qid ${snapshotEntry.wikidataQid || 'unknown'}`
      : 'No Wikidata snapshot entry found.',
  })

  if (debtType === 'composers') {
    tested.push({
      source: 'musicbrainz_core_dataset',
      status: hasMusicbrainzDataset ? 'dataset_present_not_used_in_this_wave' : 'blocked_no_local_dataset',
      detail: hasMusicbrainzDataset
        ? 'Local MusicBrainz dataset directory exists but this closure wave stayed on safer internal/Wikidata yield first.'
        : 'No local MusicBrainz core snapshot available under backend/data/musicbrainz.',
    })
  }

  return tested
}

function main() {
  const top1200Path = parseStringFlag(process.argv, 'top1200', latestJsonFile(TOP1200_DIR))
  const auditGamesPath = parseStringFlag(process.argv, 'audit-games', latestAuditGamesFile())
  const wikidataSnapshotPath = parseStringFlag(process.argv, 'wikidata-snapshot', latestWikidataSnapshotFile())
  const musicbrainzDir = path.join(path.dirname(AUDIT_DIR), 'musicbrainz')
  const hasMusicbrainzDataset = fs.existsSync(musicbrainzDir) && fs.readdirSync(musicbrainzDir).length > 0

  const top1200 = loadSelectionBand(top1200Path)
  const auditRows = readJson(auditGamesPath)
  const auditMap = new Map((Array.isArray(auditRows) ? auditRows : []).map((entry) => [String(entry.entityId), entry]))
  const snapshot = wikidataSnapshotPath ? readJson(wikidataSnapshotPath) : { entries: [] }
  const snapshotByDebtKey = new Map(
    (Array.isArray(snapshot.entries) ? snapshot.entries : []).map((entry) => [`${entry.debtType}:${entry.gameId}`, entry])
  )

  const unresolved = []
  const siblingComposerMap = buildSiblingComposerMap(top1200.ids)

  for (const gameId of uniqueStrings(top1200.ids)) {
    const audit = auditMap.get(String(gameId))
    if (!audit) continue

    const debts = (audit.missingCriticalFields || []).filter((field) => field === 'dev_team' || field === 'ost_composers')
    for (const field of debts) {
      const debtType = field === 'dev_team' ? 'dev_team' : 'composers'
      const snapshotEntry = snapshotByDebtKey.get(`${debtType}:${gameId}`) || null
      unresolved.push({
        gameId: String(gameId),
        title: audit.title,
        platform: audit.platform || null,
        debtType,
        missingField: field,
        completenessScore: Number(audit.completenessScore || 0),
        confidenceScore: Number(audit.confidenceScore || 0),
        curationStatus: audit.curationStatus || null,
        reason: snapshotEntry?.reason || 'no_safe_open_source_yield_in_current_wave',
        sourcesTested: buildSourcesTested(debtType, snapshotEntry ? { ...snapshotEntry, gameId } : { gameId }, siblingComposerMap, hasMusicbrainzDataset),
      })
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    top1200Path,
    auditGamesPath,
    wikidataSnapshotPath,
    musicbrainzDatasetPresent: hasMusicbrainzDataset,
    summary: {
      totalBlocked: unresolved.length,
      devTeamBlocked: unresolved.filter((entry) => entry.debtType === 'dev_team').length,
      composersBlocked: unresolved.filter((entry) => entry.debtType === 'composers').length,
    },
    blocked: unresolved,
  }

  ensureDir(OUTPUT_DIR)
  const outputPath = path.join(OUTPUT_DIR, `${timestamp()}_top1200_credit_blocked_residue.json`)
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))

  console.log(JSON.stringify({
    outputPath,
    summary: output.summary,
  }, null, 2))
}

try {
  main()
} catch (error) {
  console.error('[generate-top1200-credit-blocked-residue]', error && error.stack ? error.stack : error)
  process.exit(1)
}
