#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

function nowIso() {
  return new Date().toISOString()
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

function listCandidates(db) {
  return db.prepare(`
    SELECT
      g.id AS gameId,
      g.title,
      g.console,
      g.dev_team AS existingDevTeam,
      g.developer,
      g.developerId,
      c.name AS companyName
    FROM quality_records qr
    INNER JOIN games g
      ON g.id = qr.entity_id
     AND qr.entity_type = 'game'
    LEFT JOIN companies c
      ON c.id = g.developerId
    WHERE qr.missing_critical_fields LIKE '%dev_team%'
      AND (g.dev_team IS NULL OR TRIM(g.dev_team) = '')
      AND (
        c.id IS NOT NULL
        OR COALESCE(TRIM(g.developer), '') <> ''
      )
    ORDER BY
      CASE WHEN c.id IS NOT NULL THEN 0 ELSE 1 END,
      g.title ASC,
      g.id ASC
  `).all()
}

function buildDevTeam(candidate) {
  const companyName = String(candidate.companyName || '').trim()
  const developerText = String(candidate.developer || '').trim()

  if (companyName) {
    return {
      devTeam: [{ role: 'Developer', name: companyName }],
      evidenceMode: 'company_match',
      evidenceNote: `Auto-filled from companies.id=${candidate.developerId}`,
    }
  }

  if (developerText) {
    return {
      devTeam: [{ role: 'Developer', name: developerText }],
      evidenceMode: 'developer_text',
      evidenceNote: 'Auto-filled from games.developer',
    }
  }

  return null
}

function ensureSourceRecord(db, candidate, timestamp, evidence) {
  const existing = db.prepare(`
    SELECT id
    FROM source_records
    WHERE entity_type = 'game'
      AND entity_id = ?
      AND field_name = 'dev_team'
      AND source_name = 'internal'
    ORDER BY id DESC
    LIMIT 1
  `).get(candidate.gameId)

  const notes = `G3 dev team autofill (${evidence.evidenceMode}) — ${evidence.evidenceNote}`

  if (existing) {
    db.prepare(`
      UPDATE source_records
      SET source_type = 'master_data',
          compliance_status = 'approved',
          last_verified_at = ?,
          confidence_level = 0.72,
          notes = ?
      WHERE id = ?
    `).run(timestamp, notes, existing.id)
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
      'master_data',
      NULL,
      NULL,
      'approved',
      ?,
      ?,
      0.72,
      ?
    )
  `).run(candidate.gameId, timestamp, timestamp, notes)

  return Number(result.lastInsertRowid)
}

function ensureFieldProvenance(db, candidate, sourceRecordId, devTeamJson, timestamp) {
  const existing = db.prepare(`
    SELECT id
    FROM field_provenance
    WHERE entity_type = 'game'
      AND entity_id = ?
      AND field_name = 'dev_team'
    ORDER BY id DESC
    LIMIT 1
  `).get(candidate.gameId)

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
      'dev_team',
      ?,
      ?,
      1,
      0.72,
      ?
    )
  `).run(candidate.gameId, sourceRecordId, valueHash, timestamp)
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
      'g3_dev_team_autofill',
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
      'Auto-fill missing critical dev_team from companies/developer fields'
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

function buildSummary(candidates) {
  const normalized = candidates.map((candidate) => ({
    ...candidate,
    evidence: buildDevTeam(candidate),
  }))

  const companyMatch = normalized.filter((candidate) => candidate.evidence?.evidenceMode === 'company_match')
  const developerText = normalized.filter((candidate) => candidate.evidence?.evidenceMode === 'developer_text')

  return {
    targetedGames: normalized.length,
    companyMatches: companyMatch.length,
    developerTextFallbacks: developerText.length,
    targetsSample: normalized.slice(0, 25).map((candidate) => ({
      gameId: candidate.gameId,
      title: candidate.title,
      console: candidate.console,
      developerId: candidate.developerId || null,
      developer: candidate.developer || null,
      companyName: candidate.companyName || null,
      source: candidate.evidence?.evidenceMode || null,
    })),
  }
}

function applyBatch(db, candidates) {
  const timestamp = nowIso()
  const runKey = `g3-dev-team-autofill-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: candidates.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G3 dev team autofill applied locally on staging sqlite',
    sourceRecordsTouched: 0,
    provenanceTouched: 0,
    companyMatches: 0,
    developerTextFallbacks: 0,
  }

  const transaction = db.transaction(() => {
    for (const candidate of candidates) {
      const evidence = buildDevTeam(candidate)
      if (!evidence) {
        metrics.itemsSkipped += 1
        continue
      }

      const sourceRecordId = ensureSourceRecord(db, candidate, timestamp, evidence)
      const devTeamJson = JSON.stringify(evidence.devTeam)
      db.prepare(`
        UPDATE games
        SET dev_team = ?
        WHERE id = ?
      `).run(devTeamJson, candidate.gameId)

      ensureFieldProvenance(db, candidate, sourceRecordId, devTeamJson, timestamp)

      metrics.sourceRecordsTouched += 1
      metrics.provenanceTouched += 1
      metrics.itemsUpdated += 1
      if (evidence.evidenceMode === 'company_match') {
        metrics.companyMatches += 1
      } else if (evidence.evidenceMode === 'developer_text') {
        metrics.developerTextFallbacks += 1
      }
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
    const candidates = listCandidates(db)
    const summary = buildSummary(candidates)

    if (!APPLY) {
      console.log(JSON.stringify({
        mode: 'dry-run',
        sqlitePath: SQLITE_PATH,
        summary,
      }, null, 2))
      return
    }

    console.log(JSON.stringify({
      mode: 'apply',
      sqlitePath: SQLITE_PATH,
      summary,
      result: applyBatch(db, candidates),
    }, null, 2))
  } finally {
    db.close()
  }
}

main()
