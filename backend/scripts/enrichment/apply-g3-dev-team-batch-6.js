#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G3_BATCH = [
  { gameId: 'bio-evil-sega-mega-drive-tech-demo-sega-genesis', title: 'Bio Evil (SEGA Mega Drive Tech Demo)', devTeam: [{ role: 'Developer', name: 'Psygnosis' }] },
  { gameId: 'bishojo-senshi-sailor-moon-another-story-super-nintendo', title: 'Bishojo Senshi Sailor Moon: Another Story', devTeam: [{ role: 'Developer', name: 'Angel' }] },
  { gameId: 'black-fire-sega-saturn', title: 'Black Fire', devTeam: [{ role: 'Developer', name: 'Novalogic' }] },
  { gameId: 'bouncers-sega-genesis', title: 'Bouncers', devTeam: [{ role: 'Developer', name: 'Dynamix' }] },
  { gameId: 'capcom-generation-2-sega-saturn', title: 'Capcom Generation 2', devTeam: [{ role: 'Developer', name: 'Capcom' }] },
  { gameId: 'cat-the-ripper-13-ninme-no-tanteishi-sega-saturn', title: 'Cat the Ripper: 13-ninme no Tanteishi', devTeam: [{ role: 'Developer', name: 'Dataeast' }] },
  { gameId: 'chrono-resurrection-nintendo-64', title: 'Chrono Resurrection', devTeam: [{ role: 'Developer', name: 'Resurrection Games' }] },
  { gameId: 'cyber-doll-sega-saturn', title: 'Cyber Doll', devTeam: [{ role: 'Developer', name: 'Fill In Cafe' }] },
  { gameId: 'dx-jinsei-game-sega-saturn', title: 'DX Jinsei Game', devTeam: [{ role: 'Developer', name: 'Takara' }] },
  { gameId: 'dx-jinsei-game-ii-sega-saturn', title: 'DX Jinsei Game II', devTeam: [{ role: 'Developer', name: 'Takara' }] },
]

function nowIso() { return new Date().toISOString() }
function hashValue(value) { return crypto.createHash('sha256').update(String(value || '')).digest('hex') }
function ensureGameIds(db, payload) {
  const rows = db.prepare(`SELECT id FROM games WHERE id IN (${payload.map(() => '?').join(', ')})`).all(...payload.map((e) => e.gameId))
  const ids = new Set(rows.map((row) => String(row.id)))
  const missing = payload.map((entry) => entry.gameId).filter((id) => !ids.has(id))
  if (missing.length) throw new Error(`Missing target games in sqlite: ${missing.join(', ')}`)
}
function ensureSourceRecord(db, gameId, timestamp) {
  const existing = db.prepare(`SELECT id FROM source_records WHERE entity_type='game' AND entity_id=? AND field_name='dev_team' AND source_name='internal' AND source_type='knowledge_registry' ORDER BY id DESC LIMIT 1`).get(gameId)
  if (existing) {
    db.prepare(`UPDATE source_records SET compliance_status='approved', last_verified_at=?, confidence_level=0.72, notes='G3 dev team batch 6' WHERE id=?`).run(timestamp, existing.id)
    return Number(existing.id)
  }
  const result = db.prepare(`INSERT INTO source_records (entity_type,entity_id,field_name,source_name,source_type,source_url,source_license,compliance_status,ingested_at,last_verified_at,confidence_level,notes) VALUES ('game',?,'dev_team','internal','knowledge_registry',NULL,NULL,'approved',?,?,0.72,'G3 dev team batch 6')`).run(gameId, timestamp, timestamp)
  return Number(result.lastInsertRowid)
}
function ensureFieldProvenance(db, gameId, sourceRecordId, devTeamJson, timestamp) {
  const existing = db.prepare(`SELECT id FROM field_provenance WHERE entity_type='game' AND entity_id=? AND field_name='dev_team' ORDER BY id DESC LIMIT 1`).get(gameId)
  const valueHash = hashValue(devTeamJson)
  if (existing) {
    db.prepare(`UPDATE field_provenance SET source_record_id=?, value_hash=?, is_inferred=1, confidence_level=0.72, verified_at=? WHERE id=?`).run(sourceRecordId, valueHash, timestamp, existing.id)
    return
  }
  db.prepare(`INSERT INTO field_provenance (entity_type,entity_id,field_name,source_record_id,value_hash,is_inferred,confidence_level,verified_at) VALUES ('game',?,'dev_team',?,?,1,0.72,?)`).run(gameId, sourceRecordId, valueHash, timestamp)
}
function createRun(db, runKey, timestamp, dryRun) {
  const result = db.prepare(`INSERT INTO enrichment_runs (run_key,pipeline_name,mode,source_name,status,dry_run,started_at,items_seen,items_created,items_updated,items_skipped,items_flagged,error_count,notes) VALUES (?, 'g3_dev_team_batch_6', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)`).run(runKey, dryRun ? 1 : 0, timestamp, 'G3 batch 6 inferred developer team seed')
  return Number(result.lastInsertRowid)
}
function finalizeRun(db, runId, timestamp, metrics) {
  db.prepare(`UPDATE enrichment_runs SET status='completed', finished_at=?, items_seen=?, items_created=0, items_updated=?, items_skipped=?, items_flagged=?, error_count=0, notes=? WHERE id=?`).run(timestamp, metrics.itemsSeen, metrics.itemsUpdated, metrics.itemsSkipped, metrics.itemsFlagged, metrics.notes, runId)
}
function readBefore(db, payload) {
  const rows = db.prepare(`SELECT id, dev_team FROM games WHERE id IN (${payload.map(() => '?').join(', ')})`).all(...payload.map((e) => e.gameId))
  return new Map(rows.map((row) => [String(row.id), String(row.dev_team || '')]))
}
function dryRun(db) {
  const before = readBefore(db, G3_BATCH)
  return { targetedGames: G3_BATCH.length, devTeamUpdates: G3_BATCH.filter((entry) => !before.get(entry.gameId).trim()).length, targets: G3_BATCH.map((entry) => ({ gameId: entry.gameId, title: entry.title, hadDevTeamBefore: Boolean(before.get(entry.gameId).trim()) })) }
}
function applyBatch(db) {
  const timestamp = nowIso()
  const runKey = `g3-dev-team-batch-6-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = { itemsSeen: G3_BATCH.length, itemsUpdated: 0, itemsSkipped: 0, itemsFlagged: 0, notes: 'G3 dev team batch 6 applied locally on staging sqlite', sourceRecordsTouched: 0, provenanceTouched: 0 }
  const transaction = db.transaction(() => {
    for (const entry of G3_BATCH) {
      const sourceRecordId = ensureSourceRecord(db, entry.gameId, timestamp)
      const devTeamJson = JSON.stringify(entry.devTeam)
      metrics.sourceRecordsTouched += 1
      db.prepare(`UPDATE games SET dev_team = ? WHERE id = ?`).run(devTeamJson, entry.gameId)
      ensureFieldProvenance(db, entry.gameId, sourceRecordId, devTeamJson, timestamp)
      metrics.provenanceTouched += 1
      metrics.itemsUpdated += 1
    }
  })
  transaction()
  finalizeRun(db, runId, nowIso(), metrics)
  return { runId, runKey, metrics }
}
function main() {
  const db = new Database(SQLITE_PATH)
  try {
    ensureGameIds(db, G3_BATCH)
    if (!APPLY) {
      console.log(JSON.stringify({ mode: 'dry-run', sqlitePath: SQLITE_PATH, summary: dryRun(db) }, null, 2))
      return
    }
    console.log(JSON.stringify({ mode: 'apply', sqlitePath: SQLITE_PATH, summary: dryRun(db), result: applyBatch(db) }, null, 2))
  } finally {
    db.close()
  }
}
main()
