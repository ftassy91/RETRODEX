#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Genesis — priority missing summaries
  {
    gameId: 'castle-of-illusion-starring-mickey-mouse-sega-genesis',
    title: 'Castle of Illusion Starring Mickey Mouse',
    summary: 'Sega\'s landmark Genesis platformer sends Mickey through imaginative fairy-tale worlds with buoyant jumping and enemy-stomping mechanics, representing some of the platform\'s most polished early 16-bit visuals.',
  },
  {
    gameId: 'altered-beast-sega-genesis',
    title: 'Altered Beast',
    summary: 'Sega\'s mythological beat-\'em-up launched as a Genesis pack-in, featuring power orb collection that transforms players into a werewolf, bear, or dragon across five stages of Greek-inspired monster combat.',
  },
  {
    gameId: 'alex-kidd-in-the-enchanted-castle-sega-genesis',
    title: 'Alex Kidd in the Enchanted Castle',
    summary: 'Sega\'s pre-Sonic mascot platformer bridges the Master System era to Genesis, bringing rock-paper-scissors boss battles and power-fist side-scrolling to 16-bit hardware as one of the platform\'s launch titles.',
  },
  {
    gameId: 'alien-storm-sega-genesis',
    title: 'Alien Storm',
    summary: 'Sega\'s alien-invasion beat-\'em-up alternates brawling stages with overhead shooter corridors, offering three playable characters and two-player co-op in a format that extends the Golden Axe engine into sci-fi.',
  },
  {
    gameId: 'another-world-sega-genesis',
    title: 'Another World',
    summary: 'Eric Chahi\'s rotoscoped sci-fi adventure translates faithfully to Genesis, preserving the wordless alien-world narrative and precise environmental puzzle logic that made the original a landmark of cinematic design.',
  },
  {
    gameId: 'arrow-flash-sega-genesis',
    title: 'Arrow Flash',
    summary: 'Toho\'s horizontal shooter adds a dash transformation that briefly turns the ship into an invulnerable giant robot, demanding precise timing to exploit the mechanic against escalating enemy formations.',
  },
  {
    gameId: 'assault-suit-leynos-sega-genesis',
    title: 'Assault Suit Leynos',
    summary: 'Masaya\'s demanding mech action game sends an armored assault suit through hostile armored waves with a mission-select structure and multiple endings tied to performance, rewarding mastery of its precise combat systems.',
  },
  {
    gameId: 'alisia-dragoon-sega-genesis',
    title: 'Alisia Dragoon',
    summary: 'Game Arts\' action game features a sorceress with auto-targeting chain lightning and four companion dragons, balancing recharge-based combat with resource management in a striking sci-fantasy Genesis exclusive.',
  },
  {
    gameId: 'art-of-fighting-sega-genesis',
    title: 'Art of Fighting',
    summary: 'SNK\'s spirit-meter fighter arrives on Genesis with its character close-up taunts, desperation moves, and the two-protagonist roster in a port that captures the arcade\'s visual personality despite hardware limitations.',
  },
  {
    gameId: 'ariel-the-little-mermaid-sega-genesis',
    title: 'Ariel the Little Mermaid',
    summary: 'Sega\'s licensed platformer adapts the Disney film with bright underwater visuals and side-scrolling swimming stages, offering competent Disney-branded action with music lifted from the animated feature.',
  },
  {
    gameId: 'batman-sega-genesis',
    title: 'Batman',
    summary: 'Sega\'s 1990 Genesis tie-in sends Batman through Gotham\'s rooftops and Axis Chemicals in a side-scrolling action game that captures the dark palette and oppressive mood of Tim Burton\'s film.',
  },
  {
    gameId: 'batman-returns-sega-genesis',
    title: 'Batman Returns',
    summary: 'Konami\'s Genesis take emphasizes scrolling brawler combat through Gotham\'s circus-invaded streets, offering a play style distinct from the SNES platformer version and a grimmer tone than the source film.',
  },
  {
    gameId: 'battletoads-sega-genesis',
    title: 'Battletoads',
    summary: 'Rare\'s notoriously difficult brawler arrives on Genesis retaining the punishing combat and kinetic vehicle sequences that made the NES original a benchmark for extreme challenge in 16-bit co-op action.',
  },
  {
    gameId: 'battletoads-double-dragon-sega-genesis',
    title: 'Battletoads & Double Dragon',
    summary: 'The Genesis port of the franchise crossover maintains the brawling set pieces and alien-invasion premise, combining both series\' heroes across shared stages with platform-specific visual adjustments.',
  },
  {
    gameId: 'bio-hazard-battle-sega-genesis',
    title: 'Bio-Hazard Battle',
    summary: 'Sega\'s biological-warfare horizontal shooter presents four organic spacecraft battling mutated enemies with power-up chaining and two-player co-op, anchored by a distinctive biomechanical visual identity.',
  },
  {
    gameId: 'bio-ship-paladin-sega-genesis',
    title: 'Bio-ship Paladin',
    summary: 'UPL\'s multi-directional shooter sends an organic spacecraft through free-scrolling stages, drawing on the developer\'s arcade catalog with a distinctive biological ship aesthetic and demanding enemy patterns.',
  },
  {
    gameId: 'blades-of-vengeance-sega-genesis',
    title: 'Blades of Vengeance',
    summary: 'Beam Software\'s fantasy side-scroller sends one of three warriors through dark swords-and-sorcery stages with responsive combat and moody visuals that outpace many licensed contemporaries on Genesis.',
  },
  {
    gameId: 'blaster-master-2-sega-genesis',
    title: 'Blaster Master 2',
    summary: 'The Genesis sequel shifts to a fully top-down perspective, trading the NES original\'s celebrated dual-mode platform-action design for a single-vehicle format that divided fans of the mixed-genre formula.',
  },
  {
    gameId: 'bomberman-94-sega-genesis',
    title: "Bomberman '94",
    summary: 'Hudson\'s polished maze-bombing game introduces ridable Louie dinosaurs and a world-map progression, bringing PC Engine-era Bomberman refinements to Genesis in a definitive pre-Saturn franchise entry.',
  },
  {
    gameId: 'bonanza-bros-sega-genesis',
    title: 'Bonanza Bros.',
    summary: 'Sega\'s arcade heist game pits two cartoon thieves against bumbling security guards in light stealth stages, rewarding precise movement and co-operative timing with a breezy cartoon visual identity.',
  },
  {
    gameId: 'buck-rogers-countdown-to-doomsday-sega-genesis',
    title: 'Buck Rogers: Countdown to Doomsday',
    summary: 'SSI\'s Gold Box RPG adapts the Buck Rogers franchise with the engine\'s turn-based tactical combat system, offering character-building depth and strategic space opera battles on Genesis.',
  },
  {
    gameId: 'burning-force-sega-genesis',
    title: 'Burning Force',
    summary: 'Namco\'s third-person space-skiing shooter propels a rider down a corridor toward the screen, porting the arcade\'s sense of forward momentum and obstacle-lane dodging faithfully to Genesis.',
  },
  {
    gameId: 'cadash-sega-genesis',
    title: 'Cadash',
    summary: 'Taito\'s arcade RPG-action hybrid blends side-scrolling combat with leveling, equipment shops, and four playable classes, constrained by a per-credit timer that rewards preparation and efficient play.',
  },
  {
    gameId: 'california-games-sega-genesis',
    title: 'California Games',
    summary: 'Epyx\'s West Coast sports compilation brings skateboarding, surfing, BMX, and footbag events to Genesis in a laid-back multi-event format with competitive scoring and a sun-bleached aesthetic.',
  },
  {
    gameId: 'captain-commando-sega-genesis',
    title: 'Captain Commando',
    summary: 'Capcom\'s futuristic beat-\'em-up brings its four-character sci-fi roster to Genesis, delivering the franchise\'s combo-heavy arcade brawling in a 1995 Mega Drive port of the 2090s-set original.',
  },
  {
    gameId: 'centurion-defender-of-rome-sega-genesis',
    title: 'Centurion: Defender of Rome',
    summary: 'EA\'s ambitious historical strategy game combines turn-based Roman conquest with real-time battle sequences, gladiatorial events, and diplomacy across a fully realized ancient Mediterranean world.',
  },
  {
    gameId: 'chakan-the-forever-man-sega-genesis',
    title: 'Chakan: The Forever Man',
    summary: 'A dark atmospheric Genesis action game built around a cursed warrior seeking release from immortality, featuring deliberate scythe-based combat and a foreboding visual style drawn from Robert A. Kraus\'s comic.',
  },
  // SNES continued — more platform-sorted priority
  {
    gameId: 'aero-the-acro-bat-super-nintendo',
    title: 'Aero the Acro-Bat',
    summary: 'Sunsoft\'s circus-themed platformer sends a bat acrobat through imaginative themed stages with power-up stakes and standard early 90s mascot platformer structure, polished by Sunsoft\'s quality control of the era.',
  },
  {
    gameId: 'aero-the-acro-bat-sega-genesis',
    title: 'Aero the Acro-Bat',
    summary: 'The Genesis version of Sunsoft\'s circus platformer delivers largely equivalent content to its SNES counterpart, presenting the acrobatic bat through the Mega Drive\'s color capabilities.',
  },
  {
    gameId: 'aerobiz-super-nintendo',
    title: 'Aerobiz',
    summary: 'Koei\'s airline management simulation tasks players with building a global carrier from a regional hub, balancing route acquisition, competition, and external events across decades of commercial aviation history.',
  },
  {
    gameId: 'aerobiz-supersonic-super-nintendo',
    title: 'Aerobiz Supersonic',
    summary: 'Koei\'s improved airline sequel expands the original\'s route network and competitive mechanics with the jet age and Concorde-era technology, deepening the management simulation for SNES strategy fans.',
  },
  {
    gameId: 'aerobiz-sega-genesis',
    title: 'Aerobiz',
    summary: 'Koei\'s airline management simulation challenges players to build a global carrier from scratch, balancing route investments, competitor pressure, and world events across commercial aviation eras on Genesis.',
  },
  {
    gameId: 'aerobiz-supersonic-sega-genesis',
    title: 'Aerobiz Supersonic',
    summary: 'Koei\'s expanded airline sequel brings jet-age competition and deeper route mechanics to the Genesis in a management simulation that rewards long-term strategic thinking over arcade reflexes.',
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
          notes = 'G2 summary batch 6'
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
      'G2 summary batch 6'
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
    ) VALUES (?, 'g2_summary_batch_6', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 6 — Genesis priority missing summaries')

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
  const runKey = `g2-summary-batch-6-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 6 applied locally on staging sqlite',
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
