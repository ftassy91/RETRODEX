#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // NES — wave 2 (A-B range, verified IDs)
  {
    gameId: 'arkanoid-nes',
    title: 'Arkanoid',
    summary: 'Taito\'s NES adaptation of the 1986 arcade breakout classic challenges players to steer the Vaus paddle and destroy brick formations across 33 stages, introducing power-up capsules and a final boss encounter to the block-clearing formula.',
  },
  {
    gameId: 'arkanoid-revenge-of-doh-nes',
    title: 'Arkanoid: Revenge of Doh',
    summary: 'Taito\'s NES sequel to Arkanoid expands the brick-breaking formula with new power-ups, enemy types, and the return of the DOH boss across 99 stages, building on the original\'s arcade pedigree with increased mechanical complexity.',
  },
  {
    gameId: 'arkista-s-ring-nes',
    title: "Arkista's Ring",
    summary: 'American Sammy\'s NES top-down action RPG follows Christine, an elf warrior, across 100 overhead stages recovering a stolen ring from goblins, blending arcade action with light role-playing elements in a compact quest format.',
  },
  {
    gameId: 'asterix-nes',
    title: 'Asterix',
    summary: 'Infogrames\' NES side-scrolling platformer based on the French comic series lets players control Asterix and Obelix across European stages, capturing the comic\'s humor and setting with two-player cooperative play across Roman-occupied Gaul.',
  },
  {
    gameId: 'athena-nes',
    title: 'Athena',
    summary: 'SNK\'s NES port of the 1986 arcade action game follows Princess Athena escaping the Palace of Dreams through fantastical stages, equipping found weapons and armor in an early action-RPG hybrid that predates the company\'s later fighting game fame.',
  },
  {
    gameId: 'atlantis-no-nazo-nes',
    title: 'Atlantis no Nazo',
    summary: 'Sunsoft\'s Japan-only NES action platformer sends super-spy Ultra to rescue Dr. Sphinx across 100 stages set in and around a lost underwater civilization, featuring branching stage paths and warp zones that enabled considerable sequence-breaking.',
  },
  {
    gameId: 'attack-of-the-killer-tomatoes-nes',
    title: 'Attack of the Killer Tomatoes',
    summary: 'THQ\'s NES platformer based on the cult horror-comedy film and animated series pits Chad against mutant tomatoes across side-scrolling stages, offering a licensed action game that closely followed the cartoon\'s visual style.',
  },
  {
    gameId: 'b-wings-nes',
    title: 'B-Wings',
    summary: 'Data East\'s vertical-scrolling NES shooter sends a modular fighter through enemy waves with a detachable B-Wing auxiliary craft, featuring a unique formation-attack mechanic and support options that distinguish it from standard genre contemporaries.',
  },
  {
    gameId: 'back-to-the-future-nes',
    title: 'Back to the Future',
    summary: 'LJN\'s NES tie-in to the 1985 film has Marty McFly navigating 1950s Hill Valley through multiple mini-game stages to collect clock parts, regarded as a notoriously loose adaptation that prioritized variety over faithful recreation of the film.',
  },
  {
    gameId: 'back-to-the-future-part-ii-iii-nes',
    title: 'Back to the Future Part II & III',
    summary: 'LJN\'s NES game covering both Back to the Future sequels compresses key film scenes into stage-by-stage action sequences across 2015 and the Old West, combining the two films into a single cartridge release for the NES library.',
  },
  {
    gameId: 'bad-dudes-vs-dragonninja-nes',
    title: 'Bad Dudes Vs. DragonNinja',
    summary: 'Data East\'s NES port of the 1988 beat-\'em-up arcade game sends two street fighters through eight stages to rescue President Ronnie from DragonNinja, featuring two-player simultaneous co-op and the memorable presidential rescue premise.',
  },
  {
    gameId: 'bad-street-brawler-nes',
    title: 'Bad Street Brawler',
    summary: 'Mattel\'s NES scrolling beat-\'em-up follows Duke Davis punching and kicking through city streets against a variety of street criminals, notable as one of the few NES Power Glove-compatible games alongside the standard controller option.',
  },
  {
    gameId: 'balloon-fight-nes',
    title: 'Balloon Fight',
    summary: 'Nintendo\'s 1984 NES action game adapts the Joust-inspired concept to a balloon-popping format, tasking players with bursting enemies\' balloons across single-screen stages while avoiding water hazards, featuring a bonus Balloon Trip endless mode.',
  },
  {
    gameId: 'balloon-kid-nes',
    title: 'Balloon Kid',
    summary: 'Nintendo\'s 1990 NES platformer follows Alice using balloons to float across stages, with the core mechanic toggling between inflation for vertical lift and ground traversal, serving as a standalone Western sequel to the Game Boy\'s Balloon Fight adaptation.',
  },
  {
    gameId: 'bandit-kings-of-ancient-china-nes',
    title: 'Bandit Kings of Ancient China',
    summary: 'Koei\'s NES strategy simulation adapts the classic Chinese novel Water Margin into a political and military conquest game, combining turn-based troop management with diplomatic recruitment of the 108 outlaw heroes from the source story.',
  },
  {
    gameId: 'base-wars-nes',
    title: 'Base Wars',
    summary: 'Konami\'s NES baseball game set in the future replaces conventional rules with robot players who settle close plays through one-on-one combat, blending the sport\'s strategic base management with action-game brawling sequences at each contested base.',
  },
  {
    gameId: 'baseball-nes',
    title: 'Baseball',
    summary: 'Nintendo\'s 1983 launch-era NES sports title delivers a straightforward nine-inning baseball simulation with selectable team compositions, serving as one of the platform\'s foundational sports releases despite its simple presentation by later standards.',
  },
  {
    gameId: 'baseball-stars-nes',
    title: 'Baseball Stars',
    summary: 'SNK\'s NES baseball game pioneered battery-backed save functionality for sports titles, allowing players to build and develop a custom team across a full season, influencing the sports simulation genre with its persistent franchise management approach.',
  },
  {
    gameId: 'bases-loaded-nes',
    title: 'Bases Loaded',
    summary: 'Jaleco\'s 1987 NES baseball simulation earned praise for its behind-the-pitcher batting perspective and realistic player fatigue system, providing statistical depth and a full season mode that set a quality benchmark among early NES sports titles.',
  },
  {
    gameId: 'batman-the-video-game-nes',
    title: 'Batman: The Video Game',
    summary: 'Sunsoft\'s acclaimed NES action platformer based on the 1989 film follows Batman through Gotham stages using wall-jumping and a Batarang, widely regarded as one of the platform\'s best licensed games for its tight mechanics and strong presentation.',
  },
  {
    gameId: 'battle-chess-nes',
    title: 'Battle Chess',
    summary: 'Interplay\'s NES port of the 1988 PC chess game animates each capture move with a unique combat sequence between the opposing pieces, offering a fully functional chess engine alongside the visual novelty of watching pieces fight rather than simply disappearing.',
  },
  {
    gameId: 'battle-city-nes',
    title: 'Battle City',
    summary: 'Namco\'s 1985 NES tank combat game tasks players with defending their base and destroying enemy tanks across a series of maze-like stages, supporting two-player co-op and offering a construction mode for designing custom battle arenas.',
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
          notes = 'G2 summary batch 25'
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
      'G2 summary batch 25'
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
    ) VALUES (?, 'g2_summary_batch_25', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 25 — NES wave 2 (A-B range)')

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
  const runKey = `g2-summary-batch-25-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 25 applied locally on staging sqlite',
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
