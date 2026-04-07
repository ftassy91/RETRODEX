#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Game Boy Color — notable (verified IDs)
  {
    gameId: 'alone-in-the-dark-the-new-nightmare-game-boy-color',
    title: 'Alone in the Dark: The New Nightmare',
    summary: 'Pocket Studios\' GBC adaptation of the survival horror entry scales the mansion investigation into a top-down format, preserving the atmosphere and monster encounters of the console version in a dramatically reduced portable structure.',
  },
  {
    gameId: 'bionic-commando-elite-forces-game-boy-color',
    title: 'Bionic Commando: Elite Forces',
    summary: 'Nintendo\'s GBC original expands the Bionic Commando franchise with two selectable agents, bringing the grapple-hook traversal mechanic to the Color hardware with new missions and an updated visual presentation.',
  },
  // Game Boy — corrected from GBC (verified IDs)
  {
    gameId: 'dragon-warrior-monsters-game-boy',
    title: 'Dragon Warrior Monsters',
    summary: 'Enix\'s Game Boy monster-collecting RPG launches the Dragon Quest Monsters subseries with a breeding system that fuses captured enemies into new creatures, blending the Dragon Quest universe with a monster-taming loop that rivaled Pokémon on the handheld.',
  },
  {
    gameId: 'metal-gear-ghost-babel-game-boy',
    title: 'Metal Gear: Ghost Babel',
    summary: 'KCEJ\'s Game Boy Color sequel to Metal Gear Solid tells an original story with Solid Snake infiltrating a Central African fortress, translating the stealth mechanics of the PS1 game into top-down gameplay faithful to the MSX original\'s perspective.',
  },
  {
    gameId: 'pokemon-gold-game-boy',
    title: 'Pokémon Gold',
    summary: 'Game Freak\'s landmark GBC sequel doubles the scope of the original games with a new Johto region and 100 new Pokémon, introducing day-night mechanics, held items, and a post-game return to Kanto that defined the franchise\'s second generation.',
  },
  {
    gameId: 'pokemon-silver-game-boy',
    title: 'Pokémon Silver',
    summary: 'The paired version to Gold, Game Freak\'s second-generation sequel offers the same Johto adventure with version-exclusive Pokémon, solidifying the dual-release model and all mechanical advances of the era that set the series template for future games.',
  },
  {
    gameId: 'oracle-of-ages-game-boy',
    title: 'The Legend of Zelda: Oracle of Ages',
    summary: 'Capcom\'s Game Boy Color Zelda centers on time-travel puzzles using the Harp of Ages to shift between past and present Labrynna, pairing with Oracle of Seasons as a linked two-game system that unlocks a combined final boss when completed in sequence.',
  },
  {
    gameId: 'oracle-of-seasons-game-boy',
    title: 'The Legend of Zelda: Oracle of Seasons',
    summary: 'Capcom\'s Game Boy Color Zelda uses the Rod of Seasons to change environmental conditions across Holodrum, focusing on action and combat in contrast to Ages\' puzzle emphasis, with both games designed as a linked pair sharing a unified narrative conclusion.',
  },
  // Nintendo DS — notable (verified IDs)
  {
    gameId: 'children-of-mana-nintendo-ds',
    title: 'Children of Mana',
    summary: 'Nex Entertainment\'s DS Mana entry shifts to a dungeon-crawling action RPG format with four selectable heroes and weapon-type specializations, revisiting the Mana universe in a more compact structure suited to the dual-screen portable hardware.',
  },
  {
    gameId: 'chrono-trigger-nintendo-ds',
    title: 'Chrono Trigger',
    summary: 'Square Enix\'s DS port of the SNES RPG classic adds a new dungeon, animated cutscenes, and dual-screen presentation to the time-traveling adventure, making the beloved 1995 original accessible to a new handheld generation with bonus content.',
  },
  {
    gameId: 'ghost-trick-phantom-detective-nintendo-ds',
    title: 'Ghost Trick: Phantom Detective',
    summary: 'Shu Takumi\'s DS puzzle adventure stars a ghost who manipulates objects to prevent murders and alter past events, building a tightly constructed mystery narrative around an original mechanic that earned it a devoted cult following.',
  },
  {
    gameId: 'hotel-dusk-room-215-nintendo-ds',
    title: 'Hotel Dusk: Room 215',
    summary: 'Cing\'s DS visual novel mystery is played with the handheld held sideways like a book, following ex-detective Kyle Hyde through a noir investigation at a California hotel in a conversation-driven adventure with distinctive watercolor-sketch visuals.',
  },
  {
    gameId: 'mario-kart-ds-nintendo-ds',
    title: 'Mario Kart DS',
    summary: 'Nintendo\'s first DS Mario Kart introduces the Nintendo Wi-Fi Connection for online play, a mission mode, and retro cups of classic tracks, establishing the dual-screen portable entry as the definitive handheld kart racer of its era.',
  },
  {
    gameId: 'pokemon-diamond-nintendo-ds',
    title: 'Pokémon Diamond',
    summary: 'Game Freak\'s DS flagship launches the fourth generation with 107 new Pokémon in the Sinnoh region, introducing the physical-special attack split, the Underground multiplayer mode, and online trading via the Global Trade Station.',
  },
  {
    gameId: 'professor-layton-and-the-curious-village-nintendo-ds',
    title: 'Professor Layton and the Curious Village',
    summary: 'Level-5\'s DS puzzle adventure introduces the gentleman professor and his apprentice solving over 100 logic puzzles woven into a mystery narrative about a hidden treasure, launching one of the DS era\'s most distinctive original franchises.',
  },
  // PlayStation — wave 4 (verified IDs)
  {
    gameId: 'breath-of-fire-iv-playstation',
    title: 'Breath of Fire IV',
    summary: 'Capcom\'s fourth RPG entry introduces dual protagonists in parallel stories converging across a world on the edge of war, featuring the Infinity system for chaining attacks and the series\' most elaborate dragon transformation mythology.',
  },
  {
    gameId: 'bushido-blade-playstation',
    title: 'Bushido Blade',
    summary: 'Light Weight\'s PS1 sword fighting game eliminates health bars in favor of a body-location injury system where a single decisive strike ends a duel, building a realistic and deliberate combat rhythm unlike any contemporaneous fighting game.',
  },
  {
    gameId: 'castlevania-symphony-of-the-night-playstation',
    title: 'Castlevania: Symphony of the Night',
    summary: 'Konami\'s PS1 landmark recasts the Castlevania series as an open-castle RPG where Alucard collects equipment and levels up through a sprawling inverted palace, defining the Metroidvania subgenre and setting a design template followed for decades.',
  },
  {
    gameId: 'chrono-cross-playstation',
    title: 'Chrono Cross',
    summary: 'Square\'s PS1 spiritual successor to Chrono Trigger features a cast of 45 recruitable characters and an Element-based combat system, building a parallel-world narrative that interrogates the nature of fate and identity across two versions of the same world.',
  },
  {
    gameId: 'castlevania-chronicles-playstation',
    title: 'Castlevania Chronicles',
    summary: 'Konami\'s PS1 port of the Sharp X68000 Castlevania offers both the original 1993 Japan-only release and an Arrange Mode with updated visuals, presenting one of the most demanding entries in the pre-Symphony era of the series.',
  },
  {
    gameId: 'dino-crisis-playstation',
    title: 'Dino Crisis',
    summary: 'Capcom\'s PS1 survival horror replaces the undead of Resident Evil with living dinosaurs in a research facility, using the same fixed-camera tension framework while substituting fast-moving predators for slower shambling enemies across a claustrophobic setting.',
  },
  {
    gameId: 'final-fantasy-tactics-playstation',
    title: 'Final Fantasy Tactics',
    summary: 'Square\'s PS1 tactical RPG sets political betrayal and class warfare against isometric battlefields with deep job customization, establishing a benchmark for the strategy RPG genre and a darker narrative register than the mainline Final Fantasy series.',
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
          notes = 'G2 summary batch 14'
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
      'G2 summary batch 14'
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
    ) VALUES (?, 'g2_summary_batch_14', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 14 — GBC notable, NDS notable, PS1 wave 4')

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
  const runKey = `g2-summary-batch-14-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 14 applied locally on staging sqlite',
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
