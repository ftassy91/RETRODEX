#!/usr/bin/env node
'use strict'

const path = require('path')
const Database = require('better-sqlite3')
const {
  SQLITE_PATH,
  AUDIT_DIR,
  TOP1000_DIR,
  EXTENSION200_DIR,
  TOP1200_DIR,
  latestJsonFile,
  loadSelectionBand,
  parseStringFlag,
  readJson,
  uniqueStrings,
} = require('./_work-catalog-common')

function latestAuditGamesFile() {
  const fs = require('fs')
  const files = fs.readdirSync(AUDIT_DIR)
    .filter((entry) => entry.endsWith('_games.json'))
    .map((entry) => ({
      name: entry,
      path: path.join(AUDIT_DIR, entry),
      stat: fs.statSync(path.join(AUDIT_DIR, entry)),
      scoped: entry.includes('_scoped_'),
    }))
    .sort((left, right) => {
      if (Number(left.scoped) !== Number(right.scoped)) {
        return Number(left.scoped) - Number(right.scoped)
      }
      return right.stat.mtimeMs - left.stat.mtimeMs
    })

  if (!files.length) {
    throw new Error(`No *_games.json files found in ${AUDIT_DIR}`)
  }
  return files[0].path
}

function loadAuditMap(auditGamesPath) {
  const rows = readJson(auditGamesPath)
  return new Map((Array.isArray(rows) ? rows : []).map((entry) => [String(entry.entityId), entry]))
}

function loadStateMaps() {
  const db = new Database(SQLITE_PATH, { readonly: true })
  try {
    const states = db.prepare(`
      SELECT game_id, status
      FROM game_curation_states
    `).all()
    const published = db.prepare(`
      SELECT game_id
      FROM console_publication_slots
      WHERE is_active = 1
    `).all()

    return {
      statusById: new Map(states.map((row) => [String(row.game_id), String(row.status || '').trim() || null])),
      publishedIds: new Set(published.map((row) => String(row.game_id))),
    }
  } finally {
    db.close()
  }
}

function summarizeBand(ids, auditMap, statusById, publishedIds) {
  const rows = uniqueStrings(ids).map((id) => {
    const audit = auditMap.get(id) || {}
    const curationStatus = statusById.get(id) || null
    const published = publishedIds.has(id)
    return {
      id,
      completenessScore: Number(audit.completenessScore || 0),
      confidenceScore: Number(audit.confidenceScore || 0),
      missingCriticalFields: Array.isArray(audit.missingCriticalFields) ? audit.missingCriticalFields : [],
      curationStatus,
      isPublished: published,
      completeOrBetter: ['complete', 'locked', 'published'].includes(String(curationStatus || '')),
      lockedOrPublished: ['locked', 'published'].includes(String(curationStatus || '')),
    }
  })

  const remainingRows = rows.filter((row) => !row.completeOrBetter)

  return {
    total: rows.length,
    complete_or_better: rows.filter((row) => row.completeOrBetter).length,
    locked_or_published: rows.filter((row) => row.lockedOrPublished).length,
    published: rows.filter((row) => row.isPublished).length,
    missingDevTeam: rows.filter((row) => row.missingCriticalFields.includes('dev_team')).length,
    missingComposers: rows.filter((row) => row.missingCriticalFields.includes('ost_composers')).length,
    remainingSample: remainingRows.slice(0, 20).map((row) => ({
      id: row.id,
      completenessScore: row.completenessScore,
      confidenceScore: row.confidenceScore,
      curationStatus: row.curationStatus,
      isPublished: row.isPublished,
      missingCriticalFields: row.missingCriticalFields,
    })),
  }
}

function main() {
  const top1000Path = parseStringFlag(process.argv, 'top1000', latestJsonFile(TOP1000_DIR))
  const extension200Path = parseStringFlag(process.argv, 'extension200', latestJsonFile(EXTENSION200_DIR))
  const top1200Path = parseStringFlag(process.argv, 'top1200', latestJsonFile(TOP1200_DIR))
  const auditGamesPath = parseStringFlag(process.argv, 'audit-games', latestAuditGamesFile())

  const top1000 = loadSelectionBand(top1000Path)
  const extension200 = loadSelectionBand(extension200Path)
  const top1200 = loadSelectionBand(top1200Path)
  const auditMap = loadAuditMap(auditGamesPath)
  const { statusById, publishedIds } = loadStateMaps()

  const coreIds = top1000.ids.slice(0, 1000)
  const extensionIds = extension200.ids.slice(0, 200)
  const totalIds = top1200.ids.length ? top1200.ids : uniqueStrings([...coreIds, ...extensionIds])

  const output = {
    generatedAt: new Date().toISOString(),
    sources: {
      top1000: top1000Path,
      extension200: extension200Path,
      top1200: top1200Path,
      auditGames: auditGamesPath,
    },
    core1000: summarizeBand(coreIds, auditMap, statusById, publishedIds),
    extension200: summarizeBand(extensionIds, auditMap, statusById, publishedIds),
    top1200: summarizeBand(totalIds, auditMap, statusById, publishedIds),
  }
  output.top1200.total_target = totalIds.length
  output.top1200.remaining = Math.max(0, output.top1200.total_target - output.top1200.complete_or_better)

  console.log(JSON.stringify(output, null, 2))
}

try {
  main()
} catch (error) {
  console.error('[report-top1200-progress]', error && error.stack ? error.stack : error)
  process.exitCode = 1
}
