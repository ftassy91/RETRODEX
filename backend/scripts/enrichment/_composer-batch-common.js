'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

function nowIso() {
  return new Date().toISOString()
}

function normalizeComposerEntry(entry) {
  return {
    ...entry,
    sourceName: String(entry.sourceName || '').trim(),
    sourceType: String(entry.sourceType || '').trim(),
    sourceUrl: String(entry.sourceUrl || '').trim() || null,
    ostComposers: (Array.isArray(entry.ostComposers) ? entry.ostComposers : [])
      .map((composer) => {
        if (!composer || typeof composer !== 'object') return null
        const name = String(composer.name || '').trim()
        if (!name) return null
        return {
          ...composer,
          name,
          role: String(composer.role || 'composer').trim() || 'composer',
        }
      })
      .filter(Boolean),
  }
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
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

function slugify(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (normalized) {
    return normalized
  }
  return `u-${hashValue(value).slice(0, 16)}`
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
  if (!entry.sourceName) {
    throw new Error(`Composer entry missing sourceName for ${entry.gameId}`)
  }
  if (!entry.sourceType) {
    throw new Error(`Composer entry missing sourceType for ${entry.gameId}`)
  }

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

function ensurePerson(db, composer, sourceRecordId, timestamp) {
  const normalizedName = slugify(composer.name)
  if (!normalizedName) {
    throw new Error(`Unable to normalize composer name: ${composer.name}`)
  }

  const existing = db.prepare(`
    SELECT id
    FROM people
    WHERE normalized_name = ?
    LIMIT 1
  `).get(normalizedName)

  if (existing) {
    db.prepare(`
      UPDATE people
      SET name = ?,
          primary_role = 'composer',
          source_record_id = COALESCE(?, source_record_id),
          updated_at = ?
      WHERE id = ?
    `).run(composer.name, sourceRecordId, timestamp, existing.id)
    return String(existing.id)
  }

  const personId = `person:${normalizedName}`
  db.prepare(`
    INSERT INTO people (
      id,
      name,
      normalized_name,
      primary_role,
      source_record_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, 'composer', ?, ?, ?)
  `).run(personId, composer.name, normalizedName, sourceRecordId, timestamp, timestamp)

  return personId
}

function ensureGamePerson(db, gameId, personId, composer, sourceRecordId) {
  db.prepare(`
    INSERT INTO game_people (
      game_id,
      person_id,
      role,
      billing_order,
      source_record_id,
      confidence,
      is_inferred
    ) VALUES (?, ?, 'composer', ?, ?, ?, 0)
    ON CONFLICT(game_id, person_id, role) DO UPDATE SET
      billing_order = excluded.billing_order,
      source_record_id = excluded.source_record_id,
      confidence = excluded.confidence,
      is_inferred = 0
  `).run(
    gameId,
    personId,
    Number(composer.billingOrder || 0) || null,
    sourceRecordId,
    Number(composer.confidence ?? 0.88)
  )
}

function createRun(db, runKey, batchKey, startedAt, dryRun, notes) {
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
      ?,
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
      ?
    )
  `).run(runKey, batchKey, dryRun ? 1 : 0, startedAt, notes)

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

function dryRun(db, payload) {
  const before = readBefore(db, payload)
  return {
    targetedGames: payload.length,
    composerUpdates: payload.filter((entry) => before.get(entry.gameId) !== JSON.stringify(entry.ostComposers)).length,
    composerPeopleBindings: payload.reduce((sum, entry) => sum + entry.ostComposers.length, 0),
    targets: payload.map((entry) => ({
      gameId: entry.gameId,
      title: entry.title,
      hadComposersBefore: Boolean(before.get(entry.gameId).trim()),
      composers: entry.ostComposers.map((composer) => composer.name),
      sourceName: entry.sourceName,
    })),
  }
}

function applyBatch(db, batchKey, notes, payload) {
  const startedAt = nowIso()
  const runKey = `${batchKey}-${startedAt}`
  const runId = createRun(db, runKey, batchKey, startedAt, false, notes)
  const metrics = {
    itemsSeen: payload.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    peopleUpserted: 0,
    gamePeopleUpserted: 0,
    notes,
  }

  const transaction = db.transaction(() => {
    const canWriteCanonicalPeople = tableExists(db, 'people') && tableExists(db, 'game_people')
    for (const entry of payload) {
      const sourceRecordId = ensureSourceRecord(db, entry, startedAt)
      const composerJson = JSON.stringify(entry.ostComposers)
      db.prepare(`
        UPDATE games
        SET ost_composers = ?
        WHERE id = ?
      `).run(composerJson, entry.gameId)
      ensureFieldProvenance(db, entry, sourceRecordId, composerJson, startedAt)
      if (canWriteCanonicalPeople) {
        for (let index = 0; index < entry.ostComposers.length; index += 1) {
          const composer = entry.ostComposers[index]
          const personId = ensurePerson(db, composer, sourceRecordId, startedAt)
          ensureGamePerson(db, entry.gameId, personId, {
            ...composer,
            billingOrder: index + 1,
          }, sourceRecordId)
          metrics.peopleUpserted += 1
          metrics.gamePeopleUpserted += 1
        }
      }
      metrics.itemsUpdated += 1
    }
  })

  transaction()
  finalizeRun(db, runId, nowIso(), metrics)

  return { runId, runKey, metrics }
}

function runComposerBatch({ batchKey, notes, payload, argv = process.argv }) {
  const apply = argv.includes('--apply')
  const normalizedPayload = payload.map((entry) => normalizeComposerEntry(entry))
  const db = new Database(SQLITE_PATH)
  try {
    ensureGameIds(db, normalizedPayload)
    if (!apply) {
      console.log(JSON.stringify({
        mode: 'dry-run',
        sqlitePath: SQLITE_PATH,
        summary: dryRun(db, normalizedPayload),
      }, null, 2))
      return
    }
    console.log(JSON.stringify({
      mode: 'apply',
      sqlitePath: SQLITE_PATH,
      summary: dryRun(db, normalizedPayload),
      result: applyBatch(db, batchKey, notes, normalizedPayload),
    }, null, 2))
  } finally {
    db.close()
  }
}

module.exports = {
  runComposerBatch,
  SQLITE_PATH,
}
