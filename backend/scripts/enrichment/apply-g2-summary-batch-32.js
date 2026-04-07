#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Nintendo 64 — wave 5 (A-G range, verified IDs)
  {
    gameId: 'all-star-baseball-2000-nintendo-64',
    title: 'All-Star Baseball 2000',
    summary: "Acclaim's N64 baseball simulation uses MLB and MLBPA licenses with a full 162-game season mode, following up All-Star Baseball '99 with refined batting mechanics and updated 1999-season rosters for the baseball-on-N64 audience.",
  },
  {
    gameId: 'all-star-tennis-99-nintendo-64',
    title: "All Star Tennis '99",
    summary: "Ubi Soft's N64 tennis game features a circuit mode and multiple court surfaces with a roster of fictional pro players, offering a pick-up-and-play tennis alternative to the more simulation-focused titles competing in the console's sports catalog.",
  },
  {
    gameId: 'bass-hunter-64-nintendo-64',
    title: 'Bass Hunter 64',
    summary: "Vatical Entertainment's N64 bass fishing simulation features lake environments with realistic fish behavior and weather systems, delivering a compact angling game for the N64 library's fishing enthusiast segment.",
  },
  {
    gameId: 'bass-masters-2000-nintendo-64',
    title: 'Bass Masters 2000',
    summary: "Seta's N64 bass fishing game offers a tournament circuit format across American lake venues, featuring licensed fishing gear and a championship progression system in a dedicated angling simulation for the Nintendo 64 platform.",
  },
  {
    gameId: 'bass-rush-ecogear-powerworm-championship-nintendo-64',
    title: 'Bass Rush: ECOGEAR PowerWorm Championship',
    summary: "Seta's 1999 Japan-only N64 fishing game carries the ECOGEAR lure brand license in a tournament bass fishing simulation, representing the dedicated Japanese fishing game genre that sustained a substantial domestic N64 software market.",
  },
  {
    gameId: 'brunswick-circuit-pro-bowling-2-nintendo-64',
    title: 'Brunswick Circuit Pro Bowling 2',
    summary: "Adrenalin Entertainment's N64 bowling sequel carries the Brunswick alley brand with updated lane physics and a career tournament mode, refining the original Circuit Pro Bowling with improved ball trajectory modeling and additional competitive venues.",
  },
  {
    gameId: 'cybertiger-nintendo-64',
    title: 'CyberTiger',
    summary: "EA Sports' N64 Tiger Woods arcade golf game uses a simplified swing meter and fantastical power-up system, branching from the serious Tiger Woods PGA Tour simulation line into an accessible arcade-format golf experience for younger players.",
  },
  {
    gameId: 'dual-heroes-nintendo-64',
    title: 'Dual Heroes',
    summary: "Hudson's 1997 N64 3D fighting game features a roster of android combatants with energy-based special attacks, arriving early in the N64's library during a period of intense competition between the platform's fighting game offerings.",
  },
  {
    gameId: 'duck-dodgers-starring-daffy-duck-nintendo-64',
    title: 'Duck Dodgers Starring Daffy Duck',
    summary: "Infogrames' 2000 N64 3D platformer based on the Looney Tunes space parody character sends Daffy through futuristic 3D environments, arriving late in the N64's lifecycle as a licensed platformer built around the classic Warner Bros. space comedy short.",
  },
  {
    gameId: 'duke-nukem-3d-nintendo-64',
    title: 'Duke Nukem 3D',
    summary: "n-Space's N64 port of the 1996 PC first-person shooter brings Duke's irreverent alien-fighting action to Nintendo hardware with modified content, delivering the core level design and weapon variety of the original despite platform hardware limitations.",
  },
  {
    gameId: 'duke-nukem-zero-hour-nintendo-64',
    title: 'Duke Nukem: Zero Hour',
    summary: "Eurocom's N64 Duke Nukem game shifts from the franchise's FPS roots to a third-person action format with time-travel level themes, spanning Wild West and post-apocalyptic settings in a standalone N64 adventure built specifically for the platform.",
  },
  {
    gameId: 'earthworm-jim-3d-nintendo-64',
    title: 'Earthworm Jim 3D',
    summary: "Shiny Entertainment's N64 transition of the 2D platformer icon to 3D gameplay sends Jim through surreal mental landscape stages inside his own unconscious mind, struggling to recapture the personality and physical comedy of the original 16-bit games.",
  },
  {
    gameId: 'ecw-hardcore-revolution-nintendo-64',
    title: 'ECW Hardcore Revolution',
    summary: "Acclaim's N64 wrestling game uses Extreme Championship Wrestling's extreme rules format with the No Mercy engine, featuring ECW's hardcore roster including Tazz, RVD, and The Sandman in a licensed alternative to Acclaim's mainstream WWE wrestling titles.",
  },
  {
    gameId: 'extreme-g-2-nintendo-64',
    title: 'Extreme-G 2',
    summary: "Acclaim's N64 futuristic motorcycle racing sequel pushes speeds beyond the original Extreme-G with updated track design and new weapons, building on the first game's fast anti-gravity racing formula with improved handling and a more aggressive combat system.",
  },
  {
    gameId: 'f-1-world-grand-prix-ii-nintendo-64',
    title: 'F-1 World Grand Prix II',
    summary: "Video System's N64 Formula 1 sequel updates the 1997-season simulation with 1998 championship circuits and teams, continuing the licensed F1 franchise's focus on realistic race management and team setup options for simulation-oriented racing fans.",
  },
  {
    gameId: 'f1-pole-position-64-nintendo-64',
    title: 'F1 Pole Position 64',
    summary: "Human Entertainment's N64 Formula 1 racing game is a continuation of the F1 Pole Position series, offering the official circuit layouts and team rosters in a simulation-adjacent racing experience that prioritized licensed accuracy over arcade accessibility.",
  },
  {
    gameId: 'f1-racing-championship-nintendo-64',
    title: 'F1 Racing Championship',
    summary: "Ubisoft's N64 Formula 1 game features the official 2000-season circuits and constructor teams in a full championship mode with qualifying and race sessions, a late-era N64 F1 simulation competing with Video System's established franchise.",
  },
  {
    gameId: 'fifa-99-nintendo-64',
    title: 'FIFA 99',
    summary: "EA Sports' N64 edition of the long-running FIFA series delivers updated 1998-99 season club and international squads, continuing the platform's FIFA presence with improved player models and a championship season mode for N64 football fans.",
  },
  {
    gameId: 'fighters-destiny-nintendo-64',
    title: 'Fighters Destiny',
    summary: "KOEI's N64 3D fighting game introduces a unique point-scoring system where different moves earn different victory points rather than simple health depletion, a mechanical innovation that distinguished it from conventional life-bar fighting game contemporaries.",
  },
  {
    gameId: 'flying-dragon-nintendo-64',
    title: 'Flying Dragon',
    summary: "Culture Brain's N64 fighting game expands the SD Hiryu no Ken franchise with a full-scale 3D tournament fighter and a separate chibi-style RPG mode, offering two distinct game modes in a single cartridge that doubled the content scope of a standard fighter.",
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
          notes = 'G2 summary batch 32'
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
      'G2 summary batch 32'
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
    ) VALUES (?, 'g2_summary_batch_32', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 32 — N64 wave 5 (A-F range)')

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
  const runKey = `g2-summary-batch-32-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 32 applied locally on staging sqlite',
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
