#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G3_BATCH = [
  {
    gameId: 'air-race-championship-playstation',
    title: 'Air Race Championship',
    devTeam: [
      { role: 'Developer', name: 'Eutechnyx' },
    ],
  },
  {
    gameId: 'air-traffic-controller-playstation',
    title: 'Air Traffic Controller',
    devTeam: [
      { role: 'Developer', name: 'Technobrain' },
    ],
  },
  {
    gameId: 'aironauts-playstation',
    title: 'Aironauts',
    devTeam: [
      { role: 'Developer', name: 'Image Space' },
    ],
  },
  {
    gameId: 'aitakute-your-smiles-in-my-heart-playstation',
    title: 'Aitakute...Your Smiles in My Heart',
    devTeam: [
      { role: 'Developer', name: 'Cocktail Soft' },
    ],
  },
  {
    gameId: 'alive-playstation',
    title: 'Alive',
    devTeam: [
      { role: 'Developer', name: 'Studio Egg' },
    ],
  },
  {
    gameId: 'all-kamen-rider-rider-generation-nintendo-ds',
    title: 'All Kamen Rider: Rider Generation',
    devTeam: [
      { role: 'Developer', name: 'Eighting' },
    ],
  },
  {
    gameId: 'all-star-racing-2-playstation',
    title: 'All-Star Racing 2',
    devTeam: [
      { role: 'Developer', name: 'Acclaim Studios Austin' },
    ],
  },
  {
    gameId: 'alnam-no-tsubasa-shoujin-no-sora-no-kanata-e-playstation',
    title: 'Alnam no Tsubasa: Shoujin no Sora no Kanata e',
    devTeam: [
      { role: 'Developer', name: 'Light Staff' },
    ],
  },
  {
    gameId: 'angelique-tenku-no-requiem-playstation',
    title: 'Angelique Tenku no Requiem',
    devTeam: [
      { role: 'Developer', name: 'Ruby Party' },
    ],
  },
  {
    gameId: 'ao-no-6-gou-antarctica-playstation',
    title: 'Ao No 6-Gou: Antarctica',
    devTeam: [
      { role: 'Developer', name: 'Gear' },
    ],
  },
]

function nowIso() {
  return new Date().toISOString()
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

function ensureGameIds(db, payload) {
  const rows = db.prepare(`
    SELECT id
    FROM games
    WHERE id IN (${payload.map(() => '?').join(', ')})
  `).all(...payload.map((entry) => entry.gameId))

  const ids = new Set(rows.map((row) => String(row.id)))
  const missing = payload.map((entry) => entry.gameId).filter((id) => !ids.has(id))
  if (missing.length) {
    throw new Error(`Missing target games in sqlite: ${missing.join(', ')}`)
  }
}

function ensureSourceRecord(db, gameId, timestamp) {
  const existing = db.prepare(`
    SELECT id
    FROM source_records
    WHERE entity_type = 'game'
      AND entity_id = ?
      AND field_name = 'dev_team'
      AND source_name = 'internal'
      AND source_type = 'knowledge_registry'
    ORDER BY id DESC
    LIMIT 1
  `).get(gameId)

  if (existing) {
    db.prepare(`
      UPDATE source_records
      SET compliance_status = 'approved',
          last_verified_at = ?,
          confidence_level = 0.72,
          notes = 'G3 dev team batch 4'
      WHERE id = ?
    `).run(timestamp, existing.id)
    return Number(existing.id)
  }

  const result = db.prepare(`
    INSERT INTO source_records (
      entity_type,
      entity_id,
      field_name,
      source_name,
      source_type,
      source_url,
      source_license,
      compliance_status,
      ingested_at,
      last_verified_at,
      confidence_level,
      notes
    ) VALUES (
      'game',
      ?,
      'dev_team',
      'internal',
      'knowledge_registry',
      NULL,
      NULL,
      'approved',
      ?,
      ?,
      0.72,
      'G3 dev team batch 4'
    )
  `).run(gameId, timestamp, timestamp)

  return Number(result.lastInsertRowid)
}

function ensureFieldProvenance(db, gameId, sourceRecordId, devTeamJson, timestamp) {
  const existing = db.prepare(`
    SELECT id
    FROM field_provenance
    WHERE entity_type = 'game'
      AND entity_id = ?
      AND field_name = 'dev_team'
    ORDER BY id DESC
    LIMIT 1
  `).get(gameId)

  const valueHash = hashValue(devTeamJson)
  if (existing) {
    db.prepare(`
      UPDATE field_provenance
      SET source_record_id = ?,
          value_hash = ?,
          is_inferred = 1,
          confidence_level = 0.72,
          verified_at = ?
      WHERE id = ?
    `).run(sourceRecordId, valueHash, timestamp, existing.id)
    return false
  }

  db.prepare(`
    INSERT INTO field_provenance (
      entity_type,
      entity_id,
      field_name,
      source_record_id,
      value_hash,
      is_inferred,
      confidence_level,
      verified_at
    ) VALUES ('game', ?, 'dev_team', ?, ?, 1, 0.72, ?)
  `).run(gameId, sourceRecordId, valueHash, timestamp)
  return true
}

function createRun(db, runKey, timestamp, dryRun) {
  const result = db.prepare(`
    INSERT INTO enrichment_runs (
      run_key,
      pipeline_name,
      mode,
      source_name,
      status,
      dry_run,
      started_at,
      items_seen,
      items_created,
      items_updated,
      items_skipped,
      items_flagged,
      error_count,
      notes
    ) VALUES (?, 'g3_dev_team_batch_4', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G3 batch 4 inferred developer team seed')

  return Number(result.lastInsertRowid)
}

function finalizeRun(db, runId, timestamp, metrics) {
  db.prepare(`
    UPDATE enrichment_runs
    SET status = 'completed',
        finished_at = ?,
        items_seen = ?,
        items_created = 0,
        items_updated = ?,
        items_skipped = ?,
        items_flagged = ?,
        error_count = 0,
        notes = ?
    WHERE id = ?
  `).run(
    timestamp,
    metrics.itemsSeen,
    metrics.itemsUpdated,
    metrics.itemsSkipped,
    metrics.itemsFlagged,
    metrics.notes,
    runId
  )
}

function readBefore(db, payload) {
  const rows = db.prepare(`
    SELECT id, dev_team
    FROM games
    WHERE id IN (${payload.map(() => '?').join(', ')})
  `).all(...payload.map((entry) => entry.gameId))
  return new Map(rows.map((row) => [String(row.id), String(row.dev_team || '')]))
}

function dryRun(db) {
  const before = readBefore(db, G3_BATCH)
  return {
    targetedGames: G3_BATCH.length,
    devTeamUpdates: G3_BATCH.filter((entry) => !before.get(entry.gameId).trim()).length,
    targets: G3_BATCH.map((entry) => ({
      gameId: entry.gameId,
      title: entry.title,
      hadDevTeamBefore: Boolean(before.get(entry.gameId).trim()),
    })),
  }
}

function applyBatch(db) {
  const timestamp = nowIso()
  const runKey = `g3-dev-team-batch-4-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G3_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G3 dev team batch 4 applied locally on staging sqlite',
    sourceRecordsTouched: 0,
    provenanceTouched: 0,
  }

  const transaction = db.transaction(() => {
    for (const entry of G3_BATCH) {
      const sourceRecordId = ensureSourceRecord(db, entry.gameId, timestamp)
      const devTeamJson = JSON.stringify(entry.devTeam)
      metrics.sourceRecordsTouched += 1

      db.prepare(`
        UPDATE games
        SET dev_team = ?
        WHERE id = ?
      `).run(devTeamJson, entry.gameId)

      ensureFieldProvenance(db, entry.gameId, sourceRecordId, devTeamJson, timestamp)
      metrics.provenanceTouched += 1
      metrics.itemsUpdated += 1
    }
  })

  transaction()
  finalizeRun(db, runId, nowIso(), metrics)

  return {
    runId,
    runKey,
    metrics,
  }
}

function main() {
  const db = new Database(SQLITE_PATH)
  try {
    ensureGameIds(db, G3_BATCH)

    if (!APPLY) {
      console.log(JSON.stringify({
        mode: 'dry-run',
        sqlitePath: SQLITE_PATH,
        summary: dryRun(db),
      }, null, 2))
      return
    }

    console.log(JSON.stringify({
      mode: 'apply',
      sqlitePath: SQLITE_PATH,
      summary: dryRun(db),
      result: applyBatch(db),
    }, null, 2))
  } finally {
    db.close()
  }
}

main()
