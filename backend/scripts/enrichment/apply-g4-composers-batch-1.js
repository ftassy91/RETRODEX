#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G4_BATCH = [
  {
    gameId: 'chrono-trigger-nintendo-ds',
    title: 'Chrono Trigger',
    ostComposers: [
      { name: 'Yasunori Mitsuda', role: 'composer' },
      { name: 'Nobuo Uematsu', role: 'composer' },
    ],
    sourceName: 'internal',
    sourceType: 'canonical_variant',
    sourceUrl: null,
    notes: 'Composer carryover from Chrono Trigger (Super Nintendo) canonical people credits',
  },
  {
    gameId: 'ghost-trick-phantom-detective-nintendo-ds',
    title: 'Ghost Trick: Phantom Detective',
    ostComposers: [
      { name: 'Masakazu Sugimori', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Ghost_Trick:_Phantom_Detective',
    notes: 'Composer curated from Ghost Trick: Phantom Detective reference credits',
  },
  {
    gameId: 'thunder-force-v-sega-saturn',
    title: 'Thunder Force V',
    ostComposers: [
      { name: 'Hyakutaro Tsukumo', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Thunder_Force_V',
    notes: 'Composer curated from Thunder Force V reference credits',
  },
  {
    gameId: 'samurai-shodown-ii-neo-geo',
    title: 'Samurai Shodown II',
    ostComposers: [
      { name: 'Yasumasa Yamada', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Samurai_Shodown_II',
    notes: 'Composer curated from Samurai Shodown II reference credits',
  },
  {
    gameId: 'snatcher-sega-cd',
    title: 'Snatcher',
    ostComposers: [
      { name: 'Motoaki Furukawa', role: 'composer' },
    ],
    sourceName: 'junkerhq',
    sourceType: 'reference',
    sourceUrl: 'https://junkerhq.net/Snatcher/PCE/info.html',
    notes: 'Composer curated from Snatcher reference credits',
  },
  {
    gameId: 'final-fantasy-wonderswan',
    title: 'Final Fantasy',
    ostComposers: [
      { name: 'Nobuo Uematsu', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Final_Fantasy',
    notes: 'Composer curated from Final Fantasy reference credits',
  },
  {
    gameId: 'wonder-boy-iii-the-dragons-trap-sega-master-system',
    title: "Wonder Boy III: The Dragon's Trap",
    ostComposers: [
      { name: 'Shinichi Sakamoto', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Wonder_Boy_III:_The_Dragon%27s_Trap',
    notes: 'Composer curated from Wonder Boy III: The Dragon\'s Trap reference credits',
  },
  {
    gameId: 'the-gg-shinobi-game-gear',
    title: 'The GG Shinobi',
    ostComposers: [
      { name: 'Yuzo Koshiro', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/The_G.G._Shinobi',
    notes: 'Composer curated from The G.G. Shinobi reference credits',
  },
  {
    gameId: 'sonic-the-hedgehog-game-gear',
    title: 'Sonic the Hedgehog',
    ostComposers: [
      { name: 'Yuzo Koshiro', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Sonic_the_Hedgehog_(8-bit_video_game)',
    notes: 'Composer curated from Sonic the Hedgehog (8-bit) reference credits',
  },
  {
    gameId: 'sonic-the-hedgehog-sega-master-system',
    title: 'Sonic the Hedgehog',
    ostComposers: [
      { name: 'Yuzo Koshiro', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Sonic_the_Hedgehog_(8-bit_video_game)',
    notes: 'Composer curated from Sonic the Hedgehog (8-bit) reference credits',
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
      'g4_composers_batch_1',
      'apply',
      'manual_curated',
      'running',
      ?,
      ?,
      0,
      0,
      0,
      0,
      0,
      0,
      'G4 composers batch 1 applied on staging sqlite'
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
        items_created = 0,
        items_updated = ?,
        items_skipped = ?,
        items_flagged = ?,
        error_count = 0,
        notes = ?
    WHERE id = ?
  `).run(timestamp, metrics.itemsSeen, metrics.itemsUpdated, metrics.itemsSkipped, metrics.itemsFlagged, metrics.notes, runId)
}

function readBefore(db, payload) {
  const rows = db.prepare(`
    SELECT id, ost_composers
    FROM games
    WHERE id IN (${payload.map(() => '?').join(', ')})
  `).all(...payload.map((entry) => entry.gameId))

  return new Map(rows.map((row) => [String(row.id), String(row.ost_composers || '')]))
}

function dryRun(db) {
  const before = readBefore(db, G4_BATCH)
  return {
    targetedGames: G4_BATCH.length,
    composerUpdates: G4_BATCH.filter((entry) => !before.get(entry.gameId).trim()).length,
    targets: G4_BATCH.map((entry) => ({
      gameId: entry.gameId,
      title: entry.title,
      hadComposersBefore: Boolean(before.get(entry.gameId).trim()),
      composers: entry.ostComposers.map((composer) => composer.name),
      sourceName: entry.sourceName,
    })),
  }
}

function applyBatch(db) {
  const timestamp = nowIso()
  const runKey = `g4-composers-batch-1-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G4_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G4 composers batch 1 applied locally on staging sqlite',
    sourceRecordsTouched: 0,
    provenanceTouched: 0,
  }

  const transaction = db.transaction(() => {
    for (const entry of G4_BATCH) {
      const sourceRecordId = ensureSourceRecord(db, entry, timestamp)
      const composerJson = JSON.stringify(entry.ostComposers)
      db.prepare(`
        UPDATE games
        SET ost_composers = ?
        WHERE id = ?
      `).run(composerJson, entry.gameId)
      ensureFieldProvenance(db, entry, sourceRecordId, composerJson, timestamp)
      metrics.sourceRecordsTouched += 1
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
    ensureGameIds(db, G4_BATCH)
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
