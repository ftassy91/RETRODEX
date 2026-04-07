#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // SNES — wave 3
  {
    gameId: 'abc-monday-night-football-super-nintendo',
    title: 'ABC Monday Night Football',
    summary: 'Data East\'s SNES football simulation ties its presentation to the ABC television broadcast format, offering licensed team rosters and stadium names in a standard early 16-bit sports game structure.',
  },
  {
    gameId: 'acrobat-mission-super-nintendo',
    title: 'Acrobat Mission',
    summary: 'A Japan-only SNES horizontal space shooter in the traditional mold, delivering wave-based enemy formations and a power-up system typical of the early Super Famicom library\'s arcade-to-console conversions.',
  },
  {
    gameId: '3rd-super-robot-wars-super-nintendo',
    title: '3rd Super Robot Wars',
    summary: 'Banpresto\'s third entry in the tactical mecha crossover series brings together robots from multiple anime franchises in a grid-based strategy RPG that deepens the franchise formula for Japanese SNES fans.',
  },
  {
    gameId: 'alfred-chicken-super-nintendo',
    title: 'Alfred Chicken',
    summary: 'Mindscape\'s platform adventure follows a chicken through surreal balloon-popping stages, offering a lighthearted puzzle-platformer structure with a distinctive British whimsy unusual among early SNES releases.',
  },
  {
    gameId: 'art-of-fighting-2-super-nintendo',
    title: 'Art of Fighting 2',
    summary: 'SNK\'s sequel expands the original\'s roster to ten fighters while refining the spirit meter system and character close-up reactions, bringing the Neo-Geo fighter\'s deeper mechanics to the SNES platform.',
  },
  {
    gameId: 'ballz-super-nintendo',
    title: 'Ballz',
    summary: 'PF Magic\'s 3D fighting game renders all characters from spheres, creating a unique rotoscoped ball-joint aesthetic in a one-on-one brawler with comedic timing and a deliberately absurd visual identity.',
  },
  {
    gameId: 'a-s-p-air-strike-patrol-super-nintendo',
    title: 'A.S.P. Air Strike Patrol',
    summary: 'Zoom\'s SNES flight action game simulates a Gulf War-era air campaign with fuel management, ordnance selection, and civilian casualty consequences, offering unusually sobering stakes for a 16-bit action title.',
  },
  {
    gameId: 'bill-walsh-college-football-super-nintendo',
    title: 'Bill Walsh College Football',
    summary: 'EA Sports\' licensed college football simulation brings Walsh\'s coaching identity to the SNES with team-specific playbooks, authentic conference structures, and the franchise\'s simulation-first design philosophy.',
  },
  {
    gameId: 'boxing-legends-of-the-ring-super-nintendo',
    title: 'Boxing Legends of the Ring',
    summary: 'Electro Brain\'s SNES boxing game features historical and fictional champions in a punch-based fighting format, offering career mode progression and a roster built around the sport\'s legendary figures.',
  },
  {
    gameId: 'bs-f-zero-grand-prix-super-nintendo',
    title: 'BS F-Zero Grand Prix',
    summary: 'A Satellaview broadcast extension of F-Zero using the original\'s engine with new track layouts, originally delivered via Nintendo\'s Japanese satellite service with live commentary and a limited broadcast window.',
  },
  {
    gameId: 'bs-fire-emblem-archanea-senki-hen-super-nintendo',
    title: 'BS Fire Emblem: Archanea Senki-hen',
    summary: 'A four-part Satellaview Fire Emblem series set in the Archanea timeline, delivering new tactical chapters with original characters exclusive to the Japanese broadcast service and now largely inaccessible.',
  },
  {
    gameId: 'bs-tantei-club-yuki-ni-kieta-kako-super-nintendo',
    title: 'BS Tantei Club: Yuki ni Kieta Kako',
    summary: 'A Satellaview visual novel mystery adventure in the Famicom Detective Club lineage, featuring a snowbound investigation exclusive to the Japanese satellite broadcast service.',
  },
  {
    gameId: 'battle-racers-super-nintendo',
    title: 'Battle Racers',
    summary: 'Banpresto\'s kart-style racing game uses Super Robot Wars franchise mechs as drivers, combining the vehicle combat racing genre with the mecha-crossover universe in a lighthearted Japan-only release.',
  },
  {
    gameId: 'battle-robot-retsuden-super-nintendo',
    title: 'Battle Robot Retsuden',
    summary: 'Banpresto\'s Japan-only strategy RPG deploys giant robots from multiple anime series across tactical grid maps, serving as a Super Robot Wars spinoff with a dedicated mech-assembly and upgrade layer.',
  },
  {
    gameId: 'battle-submarine-super-nintendo',
    title: 'Battle Submarine',
    summary: 'A Japan-only SNES submarine action game delivering underwater combat missions across multiple enemy fleets, offering a niche naval warfare alternative to the platform\'s air and land combat catalog.',
  },
  {
    gameId: 'bomberman-b-daman-super-nintendo',
    title: 'Bomberman B-Daman',
    summary: 'Hudson\'s Japan-only SNES game ties the Bomberman universe to the B-Daman marble-shooter toy line, offering a party action game built around firing marble bombs at opponents across competitive stages.',
  },
  {
    gameId: 'bass-masters-classic-pro-edition-super-nintendo',
    title: 'Bass Masters Classic: Pro Edition',
    summary: 'The SNES fishing simulation sequel expands tournament bass fishing with more lakes, improved tackle variety, and deeper tournament structures for players invested in the original\'s angling simulation.',
  },
  // Genesis — wave 3
  {
    gameId: 'captain-america-and-the-avengers-sega-genesis',
    title: 'Captain America and The Avengers',
    summary: 'Data East\'s beat-\'em-up brings the Marvel heroes to Genesis with four playable Avengers in scrolling brawler stages, porting the arcade\'s co-op action with a condensed but faithful level structure.',
  },
  {
    gameId: 'alien-3-sega-genesis',
    title: 'Alien 3',
    summary: 'Probe Software\'s mission-based action game tasks Ripley with rescuing prisoners and hunting xenomorphs across Fury 161\'s prison colony, delivering a side-scrolling structure distinct from the film\'s plot.',
  },
  {
    gameId: 'ayrton-senna-s-super-monaco-gp-ii-sega-genesis',
    title: "Ayrton Senna's Super Monaco GP II",
    summary: 'Sega\'s Formula 1 racing sequel carries Ayrton Senna\'s personal endorsement and likeness, adding player-managed team development and a championship season structure to the original Super Monaco GP engine.',
  },
  {
    gameId: 'budokan-the-martial-spirit-sega-genesis',
    title: 'Budokan: The Martial Spirit',
    summary: 'Electronic Arts\' martial arts simulation models the physics and techniques of four disciplines including karate, kendo, bo, and nunchaku, offering a more methodical fighting game than contemporaries.',
  },
  {
    gameId: 'american-gladiators-sega-genesis',
    title: 'American Gladiators',
    summary: 'Gametek\'s Genesis adaptation of the televised competition reproduces the show\'s physical events with a digitized-sprite competitive format, mirroring the SNES version\'s structure on Mega Drive hardware.',
  },
  {
    gameId: 'battle-golfer-yui-sega-genesis',
    title: 'Battle Golfer Yui',
    summary: 'Sega\'s Japan-only action-golf game frames standard golf mechanics within a manga-style story, featuring a teenage girl competing through supernatural golfing opponents in a genre fusion unusual for the Genesis library.',
  },
  {
    gameId: 'b-o-b-sega-genesis',
    title: 'B.O.B.',
    summary: 'Electronic Arts\' side-scrolling robot adventure delivers the same planet-hopping gadget-collecting gameplay as the SNES version, bringing the game\'s comedic sci-fi action to Mega Drive hardware.',
  },
  {
    gameId: 'cannon-fodder-sega-genesis',
    title: 'Cannon Fodder',
    summary: 'Sensible Software\'s satirical war game sends wave after wave of soldiers on top-down combat missions, using black humor and a snowballing casualty counter to comment on the expendability of soldiers in conflict.',
  },
  {
    gameId: 'zombies-ate-my-neighbors-sega-genesis',
    title: 'Zombies Ate My Neighbors',
    summary: 'LucasArts\' co-op action game sends two players through top-down horror movie parody stages, rescuing civilians from zombies, chainsaw maniacs, and giant ants with an absurdist monster-movie love letter.',
  },
  {
    gameId: 'bubsy-in-claws-encounters-of-the-furred-kind-sega-genesis',
    title: 'Bubsy in: Claws Encounters of the Furred Kind',
    summary: 'Accolade\'s bobcat platformer attempts to compete with Sonic and Mario with a fast-moving mascot and instant death mechanics, earning notoriety for its unforgiving one-hit design and boastful pre-release marketing.',
  },
  {
    gameId: 'arcus-odyssey-sega-genesis',
    title: 'Arcus Odyssey',
    summary: 'Wolfteam\'s top-down action RPG reaches Genesis with four playable characters and hack-and-slash dungeon combat across a fantasy narrative, offering co-op action in a compact isometric adventure.',
  },
  {
    gameId: 'beyond-oasis-sega-genesis',
    title: 'Beyond Oasis',
    summary: 'Sega\'s action RPG places Prince Ali in a Zelda-inspired adventure with elemental spirit summoning, delivering fluid real-time combat and a richly animated style that showcases the Genesis hardware at its peak.',
  },
  {
    gameId: 'barkley-shut-up-and-jam-sega-genesis',
    title: 'Barkley Shut Up and Jam!',
    summary: 'Accolade\'s Genesis Charles Barkley basketball game delivers two-on-two playground court action with signature moves, matching the SNES version\'s casual street-ball approach on Mega Drive hardware.',
  },
  {
    gameId: 'black-hole-assault-sega-genesis',
    title: 'Black Hole Assault',
    summary: 'NCS/Masaya\'s Genesis fighter offers 3D polygon-rendered characters in one-on-one combat, serving as an early example of the polygonal fighting game aesthetic years before the genre went mainstream.',
  },
  {
    gameId: 'bram-stoker-s-dracula-sega-genesis',
    title: "Bram Stoker's Dracula",
    summary: 'Psygnosis\'s Genesis adaptation of the Coppola film places Jonathan Harker through castle stages with an action-platformer structure, using digitized film imagery within the 16-bit hardware\'s constraints.',
  },
  {
    gameId: 'a-ressha-de-ikou-md-sega-genesis',
    title: 'A Ressha de Ikou MD',
    summary: 'Artdink\'s train simulation management game brings the Japanese railway strategy franchise to Genesis, challenging players to build and operate efficient train networks across growing city grids.',
  },
  {
    gameId: '2020-super-baseball-sega-genesis',
    title: '2020 Super Baseball',
    summary: 'SNK\'s sci-fi baseball game imagines the sport in 2020 with mechanically enhanced players, electrified field hazards, and augmented athlete abilities, delivering arcade-style baseball with a futuristic twist.',
  },
  {
    gameId: 'bill-walsh-college-football-sega-genesis',
    title: 'Bill Walsh College Football',
    summary: 'EA Sports\' Genesis college football simulation carries the same coaching philosophy as the SNES version, offering Walsh-branded playbooks and authentic conference structures on Mega Drive hardware.',
  },
  {
    gameId: 'boxing-legends-of-the-ring-sega-genesis',
    title: 'Boxing Legends of the Ring',
    summary: 'Electro Brain\'s Genesis boxing game translates the SNES version\'s roster of historical and fictional champions to Mega Drive hardware, keeping the career mode and punch-based combat structure intact.',
  },
  {
    gameId: 'battle-mania-daiginjo-sega-genesis',
    title: 'Battle Mania Daiginjō',
    summary: 'Toaplan\'s Japan-only horizontal shooter sequel demands technical mastery of its enemy formations and boss patterns, printed in small quantities that have made it one of the rarest and most valuable Genesis titles.',
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
          notes = 'G2 summary batch 9'
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
      'G2 summary batch 9'
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
    ) VALUES (?, 'g2_summary_batch_9', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 9 — SNES/Genesis wave 3')

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
  const runKey = `g2-summary-batch-9-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 9 applied locally on staging sqlite',
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
