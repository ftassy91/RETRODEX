#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G4_BATCH = [
  {
    gameId: 'chrono-trigger-super-nintendo',
    title: 'Chrono Trigger',
    ostComposers: [
      { name: 'Yasunori Mitsuda', role: 'composer' },
      { name: 'Nobuo Uematsu', role: 'composer' },
    ],
    sourceName: 'internal',
    sourceType: 'canonical_variant',
    sourceUrl: null,
    notes: 'Composer carryover from Chrono Trigger Nintendo DS canonical credits',
  },
  {
    gameId: 'final-fantasy-nintendo-entertainment-system',
    title: 'Final Fantasy',
    ostComposers: [
      { name: 'Nobuo Uematsu', role: 'composer' },
    ],
    sourceName: 'internal',
    sourceType: 'canonical_variant',
    sourceUrl: null,
    notes: 'Composer carryover from Final Fantasy WonderSwan canonical credits',
  },
  {
    gameId: 'castlevania-circle-of-the-moon-game-boy-advance',
    title: 'Castlevania: Circle of the Moon',
    ostComposers: [
      { name: 'Sotaro Tojima', role: 'composer' },
      { name: 'Hiroshi Mitsuoka', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Castlevania%3A_Circle_of_the_Moon',
    notes: 'Composer curated from Castlevania: Circle of the Moon reference credits',
  },
  {
    gameId: 'mega-man-2-nintendo-entertainment-system',
    title: 'Mega Man 2',
    ostComposers: [
      { name: 'Takashi Tateishi', role: 'composer' },
      { name: 'Manami Matsumae', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Mega_Man_2',
    notes: 'Composer curated from Mega Man 2 reference credits',
  },
  {
    gameId: 'mega-man-3-nintendo-entertainment-system',
    title: 'Mega Man 3',
    ostComposers: [
      { name: 'Yasuaki Fujita', role: 'composer' },
      { name: 'Harumi Fujita', role: 'composer' },
      { name: 'Mari Yamaguchi', role: 'composer' },
    ],
    sourceName: 'vgmdb',
    sourceType: 'reference',
    sourceUrl: 'https://vgmdb.net/album/114735',
    notes: 'Composer curated from Mega Man 3 soundtrack credits',
  },
  {
    gameId: 'mega-man-x-super-nintendo',
    title: 'Mega Man X',
    ostComposers: [
      { name: 'Setsuo Yamamoto', role: 'composer' },
      { name: 'Yuki Iwai', role: 'composer' },
      { name: 'Toshihiko Horiyama', role: 'composer' },
      { name: 'Yuko Takehara', role: 'composer' },
      { name: 'Makoto Tomozawa', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Mega_Man_X_%28video_game%29',
    notes: 'Composer curated from Mega Man X reference credits',
  },
  {
    gameId: 'resident-evil-3-nemesis-playstation',
    title: 'Resident Evil 3: Nemesis',
    ostComposers: [
      { name: 'Masami Ueda', role: 'composer' },
      { name: 'Saori Maeda', role: 'composer' },
      { name: 'Shusaku Uchiyama', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Resident_Evil_3%3A_Nemesis',
    notes: 'Composer curated from Resident Evil 3: Nemesis reference credits',
  },
  {
    gameId: 'the-legend-of-zelda-ocarina-of-time-nintendo-64',
    title: 'The Legend of Zelda: Ocarina of Time',
    ostComposers: [
      { name: 'Koji Kondo', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/The_Legend_of_Zelda%3A_Ocarina_of_Time',
    notes: 'Composer curated from Ocarina of Time reference credits',
  },
  {
    gameId: 'new-super-mario-bros-nintendo-ds',
    title: 'New Super Mario Bros.',
    ostComposers: [
      { name: 'Asuka Ohta', role: 'composer' },
      { name: 'Hajime Wakai', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/New_Super_Mario_Bros.',
    notes: 'Composer curated from New Super Mario Bros. reference credits',
  },
  {
    gameId: 'pokemon-red-game-boy',
    title: 'Pokémon Red',
    ostComposers: [
      { name: 'Junichi Masuda', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Pok%C3%A9mon_Red%2C_Blue%2C_and_Yellow',
    notes: 'Composer curated from Pokémon Red, Blue, and Yellow reference credits',
  },
  {
    gameId: 'pokemon-blue-game-boy',
    title: 'Pokémon Blue',
    ostComposers: [
      { name: 'Junichi Masuda', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Pok%C3%A9mon_Red%2C_Blue%2C_and_Yellow',
    notes: 'Composer curated from Pokémon Red, Blue, and Yellow reference credits',
  },
  {
    gameId: 'rocket-knight-adventures-sega-genesis',
    title: 'Rocket Knight Adventures',
    ostComposers: [
      { name: 'Masanori Oouchi', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Rocket_Knight_Adventures',
    notes: 'Composer curated from Rocket Knight Adventures reference credits',
  },
  {
    gameId: 'super-castlevania-iv-super-nintendo',
    title: 'Super Castlevania IV',
    ostComposers: [
      { name: 'Masanori Adachi', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Super_Castlevania_IV',
    notes: 'Composer curated from Super Castlevania IV reference credits',
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
      'g4_composers_batch_6',
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
      'G4 composers batch 6 applied on staging sqlite'
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
  const runKey = `g4-composers-batch-6-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G4_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G4 composers batch 6 applied locally on staging sqlite',
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
