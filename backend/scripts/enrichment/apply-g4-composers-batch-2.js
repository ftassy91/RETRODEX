#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G4_BATCH = [
  {
    gameId: 'sonic-the-hedgehog-2-game-gear',
    title: 'Sonic the Hedgehog 2',
    ostComposers: [
      { name: 'Naofumi Hataya', role: 'composer' },
      { name: 'Masafumi Ogata', role: 'composer' },
      { name: 'Tomonori Sawada', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Sonic_the_Hedgehog_2_(8-bit_video_game)',
    notes: 'Composer curated from Sonic the Hedgehog 2 (8-bit) reference credits',
  },
  {
    gameId: 'sonic-triple-trouble-game-gear',
    title: 'Sonic Triple Trouble',
    ostComposers: [
      { name: 'Yayoi Fujimori', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Sonic_the_Hedgehog:_Triple_Trouble',
    notes: 'Composer curated from Sonic Triple Trouble reference credits',
  },
  {
    gameId: 'cratermaze-turbografx-16',
    title: 'Cratermaze',
    ostComposers: [
      { name: 'Jun Chikuma', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Jun_Chikuma',
    notes: 'Composer carryover from Jun Chikuma credits list including Cratermaze',
  },
  {
    gameId: 'bomberman-turbografx-16',
    title: 'Bomberman',
    ostComposers: [
      { name: 'Jun Chikuma', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Bomberman_(1990_video_game)',
    notes: 'Composer curated from Bomberman (TurboGrafx-16) reference credits',
  },
  {
    gameId: 'military-madness-turbografx-16',
    title: 'Military Madness',
    ostComposers: [
      { name: 'Jun Chikuma', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Military_Madness',
    notes: 'Composer curated from Military Madness reference credits',
  },
  {
    gameId: 'puzzle-bobble-neo-geo',
    title: 'Puzzle Bobble',
    ostComposers: [
      { name: 'Kazuko Umino', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Puzzle_Bobble',
    notes: 'Composer curated from Puzzle Bobble reference credits',
  },
  {
    gameId: 'splatterhouse-turbografx-16',
    title: 'Splatterhouse',
    ostComposers: [
      { name: 'Katsuro Tajima', role: 'composer' },
      { name: 'Yoshinori Kawamoto', role: 'composer' },
      { name: 'Yuichiro Komoriya', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Splatterhouse',
    notes: 'Composer curated from Splatterhouse reference credits',
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

function ensureSourceRecord(db, entry, timestamp) {
  const existing = db.prepare(`
    SELECT id
    FROM source_records
    WHERE entity_type = 'game'
      AND entity_id = ?
      AND field_name = 'ost_composers'
      AND source_name = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(entry.gameId, entry.sourceName)

  if (existing) {
    db.prepare(`
      UPDATE source_records
      SET source_type = ?,
          source_url = ?,
          compliance_status = 'approved',
          last_verified_at = ?,
          confidence_level = 0.88,
          notes = ?
      WHERE id = ?
    `).run(entry.sourceType, entry.sourceUrl, timestamp, entry.notes, existing.id)
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
      'ost_composers',
      ?,
      ?,
      ?,
      NULL,
      'approved',
      ?,
      ?,
      0.88,
      ?
    )
  `).run(entry.gameId, entry.sourceName, entry.sourceType, entry.sourceUrl, timestamp, timestamp, entry.notes)

  return Number(result.lastInsertRowid)
}

function ensureFieldProvenance(db, entry, sourceRecordId, composerJson, timestamp) {
  const existing = db.prepare(`
    SELECT id
    FROM field_provenance
    WHERE entity_type = 'game'
      AND entity_id = ?
      AND field_name = 'ost_composers'
    ORDER BY id DESC
    LIMIT 1
  `).get(entry.gameId)

  const valueHash = hashValue(composerJson)

  if (existing) {
    db.prepare(`
      UPDATE field_provenance
      SET source_record_id = ?,
          value_hash = ?,
          is_inferred = 0,
          confidence_level = 0.88,
          verified_at = ?
      WHERE id = ?
    `).run(sourceRecordId, valueHash, timestamp, existing.id)
    return
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
    ) VALUES (
      'game',
      ?,
      'ost_composers',
      ?,
      ?,
      0,
      0.88,
      ?
    )
  `).run(entry.gameId, sourceRecordId, valueHash, timestamp)
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
    ) VALUES (
      ?,
      'g4_composers_batch_2',
      'apply',
      'internal_curated',
      'running',
      ?,
      ?,
      0,
      0,
      0,
      0,
      0,
      0,
      'Composer uplift batch 2 for published Tier A games'
    )
  `).run(runKey, dryRun ? 1 : 0, timestamp)

  return Number(result.lastInsertRowid)
}

function finalizeRun(db, runId, timestamp, metrics) {
  db.prepare(`
    UPDATE enrichment_runs
    SET status = 'completed',
        finished_at = ?,
        items_seen = ?,
        items_created = ?,
        items_updated = ?,
        items_skipped = ?,
        items_flagged = ?,
        error_count = 0,
        notes = ?
    WHERE id = ?
  `).run(
    timestamp,
    metrics.itemsSeen,
    metrics.itemsCreated,
    metrics.itemsUpdated,
    metrics.itemsSkipped,
    metrics.itemsFlagged,
    metrics.notes,
    runId
  )
}

function applyBatch(db, payload) {
  const timestamp = nowIso()
  const runKey = `g4-composers-batch-2-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: payload.length,
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G4 composers batch 2 applied locally on staging sqlite',
  }

  const transaction = db.transaction(() => {
    for (const entry of payload) {
      const composerJson = JSON.stringify(entry.ostComposers)
      const sourceRecordId = ensureSourceRecord(db, entry, timestamp)

      db.prepare(`
        UPDATE games
        SET ost_composers = ?
        WHERE id = ?
      `).run(composerJson, entry.gameId)

      ensureFieldProvenance(db, entry, sourceRecordId, composerJson, timestamp)
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
    ensureGameIds(db, G4_BATCH)

    if (!APPLY) {
      console.log(JSON.stringify({
        mode: 'dry-run',
        sqlitePath: SQLITE_PATH,
        targetedGames: G4_BATCH.length,
        targets: G4_BATCH.map((entry) => ({
          gameId: entry.gameId,
          title: entry.title,
          composerCount: entry.ostComposers.length,
          sourceName: entry.sourceName,
        })),
      }, null, 2))
      return
    }

    const result = applyBatch(db, G4_BATCH)
    console.log(JSON.stringify({
      mode: 'apply',
      sqlitePath: SQLITE_PATH,
      targetedGames: G4_BATCH.length,
      result,
    }, null, 2))
  } finally {
    db.close()
  }
}

main()
