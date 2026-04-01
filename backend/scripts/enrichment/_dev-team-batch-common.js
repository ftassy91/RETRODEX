'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

function nowIso() {
  return new Date().toISOString()
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
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

function tableExists(db, tableName) {
  const row = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name = ?
  `).get(tableName)
  return Boolean(row)
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
      AND field_name = 'dev_team'
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
          confidence_level = ?,
          notes = ?
      WHERE id = ?
    `).run(
      entry.sourceType || 'knowledge_registry',
      entry.sourceUrl || null,
      timestamp,
      Number(entry.confidenceLevel ?? 0.72),
      entry.notes || null,
      existing.id
    )
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
      ?,
      ?,
      ?,
      NULL,
      'approved',
      ?,
      ?,
      ?,
      ?
    )
  `).run(
    entry.gameId,
    entry.sourceName,
    entry.sourceType || 'knowledge_registry',
    entry.sourceUrl || null,
    timestamp,
    timestamp,
    Number(entry.confidenceLevel ?? 0.72),
    entry.notes || null
  )

  return Number(result.lastInsertRowid)
}

function ensureFieldProvenance(db, entry, sourceRecordId, devTeamJson, timestamp) {
  const existing = db.prepare(`
    SELECT id
    FROM field_provenance
    WHERE entity_type = 'game'
      AND entity_id = ?
      AND field_name = 'dev_team'
    ORDER BY id DESC
    LIMIT 1
  `).get(entry.gameId)

  const valueHash = hashValue(devTeamJson)
  const inferred = entry.isInferred === false ? 0 : 1
  if (existing) {
    db.prepare(`
      UPDATE field_provenance
      SET source_record_id = ?,
          value_hash = ?,
          is_inferred = ?,
          confidence_level = ?,
          verified_at = ?
      WHERE id = ?
    `).run(sourceRecordId, valueHash, inferred, Number(entry.confidenceLevel ?? 0.72), timestamp, existing.id)
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
    ) VALUES ('game', ?, 'dev_team', ?, ?, ?, ?, ?)
  `).run(entry.gameId, sourceRecordId, valueHash, inferred, Number(entry.confidenceLevel ?? 0.72), timestamp)
}

function ensurePerson(db, member, sourceRecordId, timestamp) {
  const normalizedName = slugify(member.name)
  if (!normalizedName) {
    throw new Error(`Unable to normalize dev team member name: ${member.name}`)
  }

  const existing = db.prepare(`
    SELECT id
    FROM people
    WHERE normalized_name = ?
    LIMIT 1
  `).get(normalizedName)

  const primaryRole = String(member.role || 'developer').trim().toLowerCase() || 'developer'

  if (existing) {
    db.prepare(`
      UPDATE people
      SET name = ?,
          primary_role = ?,
          source_record_id = COALESCE(?, source_record_id),
          updated_at = ?
      WHERE id = ?
    `).run(member.name, primaryRole, sourceRecordId, timestamp, existing.id)
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(personId, member.name, normalizedName, primaryRole, sourceRecordId, timestamp, timestamp)
  return personId
}

function ensureGamePerson(db, gameId, personId, member, sourceRecordId) {
  db.prepare(`
    INSERT INTO game_people (
      game_id,
      person_id,
      role,
      billing_order,
      source_record_id,
      confidence,
      is_inferred
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(game_id, person_id, role) DO UPDATE SET
      billing_order = excluded.billing_order,
      source_record_id = excluded.source_record_id,
      confidence = excluded.confidence,
      is_inferred = excluded.is_inferred
  `).run(
    gameId,
    personId,
    String(member.role || 'developer').trim().toLowerCase() || 'developer',
    Number(member.billingOrder || 0) || null,
    sourceRecordId,
    Number(member.confidence ?? 0.72),
    member.isInferred === false ? 0 : 1
  )
}

function createRun(db, batchKey, timestamp, dryRun, notes) {
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
    ) VALUES (?, ?, 'apply', 'manual_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(`${batchKey}-${timestamp}`, batchKey, dryRun ? 1 : 0, timestamp, notes)

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
    SELECT id, dev_team
    FROM games
    WHERE id IN (${payload.map(() => '?').join(', ')})
  `).all(...payload.map((entry) => entry.gameId))

  return new Map(rows.map((row) => [String(row.id), String(row.dev_team || '')]))
}

function dryRun(db, payload) {
  const before = readBefore(db, payload)
  return {
    targetedGames: payload.length,
    devTeamUpdates: payload.filter((entry) => before.get(entry.gameId) !== JSON.stringify(entry.devTeam)).length,
    peopleBindings: payload.reduce((sum, entry) => sum + entry.devTeam.length, 0),
    targets: payload.map((entry) => ({
      gameId: entry.gameId,
      title: entry.title,
      hadDevTeamBefore: Boolean(before.get(entry.gameId).trim()),
      members: entry.devTeam.map((member) => member.name),
      sourceName: entry.sourceName,
    })),
  }
}

function applyBatch(db, batchKey, notes, payload) {
  const startedAt = nowIso()
  const runId = createRun(db, batchKey, startedAt, false, notes)
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
      const devTeamJson = JSON.stringify(entry.devTeam)
      db.prepare(`
        UPDATE games
        SET dev_team = ?
        WHERE id = ?
      `).run(devTeamJson, entry.gameId)
      ensureFieldProvenance(db, entry, sourceRecordId, devTeamJson, startedAt)

      if (canWriteCanonicalPeople) {
        for (let index = 0; index < entry.devTeam.length; index += 1) {
          const member = entry.devTeam[index]
          const personId = ensurePerson(db, member, sourceRecordId, startedAt)
          ensureGamePerson(db, entry.gameId, personId, {
            ...member,
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

  return { runId, metrics }
}

function runDevTeamBatch({ batchKey, notes, payload, argv = process.argv }) {
  const apply = argv.includes('--apply')
  const db = new Database(SQLITE_PATH)
  try {
    ensureGameIds(db, payload)
    if (!apply) {
      console.log(JSON.stringify({
        mode: 'dry-run',
        sqlitePath: SQLITE_PATH,
        summary: dryRun(db, payload),
      }, null, 2))
      return
    }

    console.log(JSON.stringify({
      mode: 'apply',
      sqlitePath: SQLITE_PATH,
      summary: dryRun(db, payload),
      result: applyBatch(db, batchKey, notes, payload),
    }, null, 2))
  } finally {
    db.close()
  }
}

module.exports = {
  runDevTeamBatch,
  SQLITE_PATH,
}
