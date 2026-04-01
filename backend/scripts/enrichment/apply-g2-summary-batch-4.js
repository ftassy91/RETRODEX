#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  {
    gameId: 'ancient-roman-power-of-dark-side-playstation',
    title: 'Ancient Roman: Power of Dark Side',
    summary: 'A dark fantasy-flavored PlayStation action game that leans on an ominous setting and direct combat rather than on deep simulation or adventure systems.',
  },
  {
    gameId: 'animal-snap-rescue-them-2-by-2-playstation',
    title: 'Animal Snap: Rescue Them 2 By 2',
    summary: 'A family-oriented PlayStation release built around animal-themed rescue challenges, aiming for simple, readable play and a lighthearted tone.',
  },
  {
    gameId: 'bakusho-ai-no-gekijo-nes',
    title: 'Bakusho! Ai no Gekijo',
    summary: "An NES comedic action title that leans on brisk scenes and playful presentation, reflecting the era's taste for compact, character-led cartridge entertainment.",
  },
  {
    gameId: 'battle-cross-super-nintendo',
    title: 'Battle Cross',
    summary: 'A Super Nintendo action game centered on fast stage-based combat, presenting its battles with an arcade sensibility rather than heavy strategic complexity.',
  },
  {
    gameId: 'battle-soccer-2-super-nintendo',
    title: 'Battle Soccer 2',
    summary: 'An arcade-style Super Nintendo football game that pushes exaggerated match flow and crossover spectacle over realistic sport simulation.',
  },
  {
    gameId: 'batty-zabella-game-boy',
    title: 'Batty Zabella',
    summary: "A modern Game Boy action release with a spooky, character-driven tone, designed to feel like a compact lost portable adventure from the handheld's prime years.",
  },
  {
    gameId: 'bio-evil-sega-mega-drive-tech-demo-sega-genesis',
    title: 'Bio Evil (SEGA Mega Drive Tech Demo)',
    summary: 'A Sega Genesis tech demo that imagines survival-horror style presentation on 16-bit hardware, functioning more as a proof of concept than a full commercial release.',
  },
  {
    gameId: 'bouncers-sega-genesis',
    title: 'Bouncers',
    summary: 'A Sega Genesis action title built around immediate arcade-style challenges, using short rounds and direct feedback instead of long-form progression.',
  },
  {
    gameId: 'carl-lewis-athletics-2000-game-boy-color',
    title: 'Carl Lewis Athletics 2000',
    summary: 'A portable track-and-field sports game that distills sprinting and event timing into quick Game Boy Color competitions with straightforward controls.',
  },
  {
    gameId: 'chalvo-55-game-boy',
    title: 'Chalvo 55',
    summary: 'A Game Boy action-platformer with a robotic lead and a compact stage-based structure, designed around precise movement and short portable sessions.',
  },
  {
    gameId: 'cult-jump-game-boy',
    title: 'Cult Jump',
    summary: 'A Game Boy action game built around committed jumps and obstacle timing, favoring concise handheld challenge over layered progression systems.',
  },
  {
    gameId: 'dt-lords-of-genomes-game-boy',
    title: 'DT: Lords of Genomes',
    summary: 'A Game Boy title with a sci-fi identity that frames its conflict around engineered creatures and compact portable progression rather than broad-scale spectacle.',
  },
  {
    gameId: 'dangan-gb2-game-boy',
    title: 'Dangan GB2',
    summary: 'A modern Game Boy sequel built around quick action, clean presentation, and focused handheld challenge in the tradition of small-footprint cartridge design.',
  },
  {
    gameId: 'dead-names-game-boy',
    title: 'Dead Names',
    summary: 'A modern Game Boy horror-leaning adventure that uses minimalism and unease to build atmosphere, treating the handheld format as part of its identity rather than a limitation.',
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
      AND field_name = 'summary'
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
          confidence_level = 0.8,
          notes = 'G2 summary batch 4'
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
      'summary',
      'internal',
      'knowledge_registry',
      NULL,
      NULL,
      'approved',
      ?,
      ?,
      0.8,
      'G2 summary batch 4'
    )
  `).run(gameId, timestamp, timestamp)

  return Number(result.lastInsertRowid)
}

function ensureFieldProvenance(db, gameId, sourceRecordId, summary, timestamp) {
  const existing = db.prepare(`
    SELECT id
    FROM field_provenance
    WHERE entity_type = 'game'
      AND entity_id = ?
      AND field_name = 'summary'
    ORDER BY id DESC
    LIMIT 1
  `).get(gameId)

  const valueHash = hashValue(summary)
  if (existing) {
    db.prepare(`
      UPDATE field_provenance
      SET source_record_id = ?,
          value_hash = ?,
          is_inferred = 0,
          confidence_level = 0.8,
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
    ) VALUES ('game', ?, 'summary', ?, ?, 0, 0.8, ?)
  `).run(gameId, sourceRecordId, valueHash, timestamp)
  return true
}

function upsertGameEditorialSummary(db, gameId, summary, sourceRecordId, timestamp) {
  db.prepare(`
    INSERT INTO game_editorial (
      game_id,
      summary,
      source_record_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(game_id) DO UPDATE SET
      summary = excluded.summary,
      source_record_id = excluded.source_record_id,
      updated_at = excluded.updated_at
  `).run(gameId, summary, sourceRecordId, timestamp, timestamp)
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
    ) VALUES (?, 'g2_summary_batch_4', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 4 final critical missing summaries')

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
    SELECT id, summary
    FROM games
    WHERE id IN (${payload.map(() => '?').join(', ')})
  `).all(...payload.map((entry) => entry.gameId))
  return new Map(rows.map((row) => [String(row.id), String(row.summary || '')]))
}

function dryRun(db) {
  const before = readBefore(db, G2_BATCH)
  return {
    targetedGames: G2_BATCH.length,
    summaryUpdates: G2_BATCH.filter((entry) => !before.get(entry.gameId).trim()).length,
    targets: G2_BATCH.map((entry) => ({
      gameId: entry.gameId,
      title: entry.title,
      hadSummaryBefore: Boolean(before.get(entry.gameId).trim()),
    })),
  }
}

function applyBatch(db) {
  const timestamp = nowIso()
  const runKey = `g2-summary-batch-4-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 4 applied locally on staging sqlite',
    sourceRecordsTouched: 0,
    provenanceTouched: 0,
  }

  const transaction = db.transaction(() => {
    for (const entry of G2_BATCH) {
      const sourceRecordId = ensureSourceRecord(db, entry.gameId, timestamp)
      metrics.sourceRecordsTouched += 1

      db.prepare(`
        UPDATE games
        SET summary = ?
        WHERE id = ?
      `).run(entry.summary, entry.gameId)

      upsertGameEditorialSummary(db, entry.gameId, entry.summary, sourceRecordId, timestamp)
      ensureFieldProvenance(db, entry.gameId, sourceRecordId, entry.summary, timestamp)
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
    ensureGameIds(db, G2_BATCH)

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
