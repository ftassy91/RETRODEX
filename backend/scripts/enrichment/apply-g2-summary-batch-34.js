#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Sega Genesis — wave 7 (A through M range, French-placeholder replacements)
  {
    gameId: 'castle-of-illusion-sega-genesis',
    title: 'Castle of Illusion',
    summary: "Sega's 1990 Genesis platformer sends Mickey Mouse through a fairy-tale castle to rescue Minnie from the witch Mizrabel, a technically polished early Genesis showcase with smooth sprite scaling and one of the platform's strongest 16-bit Disney titles.",
  },
  {
    gameId: 'dynamite-headdy-sega-genesis',
    title: 'Dynamite Headdy',
    summary: "Treasure's 1994 Genesis action-platformer stars a puppet hero who throws and swaps his own head as a weapon through a theatrical world run by the villain Dark Demon, delivering the developer's signature creative enemy design and precision gameplay.",
  },
  {
    gameId: 'earthworm-jim-sega-genesis',
    title: 'Earthworm Jim',
    summary: "Shiny Entertainment's 1994 Genesis action-platformer follows a worm in a super suit across absurdist stages filled with hand-drawn animation and irreverent humor, a technically impressive production that defined early-1990s licensed game craft at its ceiling.",
  },
  {
    gameId: 'ecco-the-dolphin-sega-genesis',
    title: 'Ecco the Dolphin',
    summary: "Appaloosa Interactive's 1992 Genesis adventure puts players in control of a dolphin navigating ocean depths in a near-silent atmospheric puzzle game, notable for its lonely tone, echolocation mechanics, and surreal alien storyline unlike any other platformer of its era.",
  },
  {
    gameId: 'ghouls-n-ghosts-sega-genesis',
    title: "Ghouls 'n Ghosts",
    summary: "Capcom's 1989 Genesis port of the arcade sequel to Ghosts 'n Goblins sends knight Arthur through relentless horror stages against undead hordes, a punishing side-scrolling action game renowned for its difficulty and tight two-weapon combat system.",
  },
  {
    gameId: 'golden-axe-sega-genesis',
    title: 'Golden Axe',
    summary: "Sega's 1989 Genesis port of the arcade fantasy beat-'em-up lets players choose between a warrior, amazon, or dwarf fighting through mythological stages against Death Adder, a landmark early Genesis title with magic system and rideable beast mechanics.",
  },
  {
    gameId: 'herzog-zwei-sega-genesis',
    title: 'Herzog Zwei',
    summary: "Technosoft's 1990 Genesis real-time strategy game is widely credited as a foundational ancestor of the modern RTS genre, blending a transforming fighter jet with base-building and unit command in a two-player competitive format that predated Dune II and Warcraft.",
  },
  {
    gameId: 'kid-chameleon-sega-genesis',
    title: 'Kid Chameleon',
    summary: "Sega's 1992 Genesis platformer gives its hero the ability to transform into different characters by collecting helmets across 103 stages, one of the longest platformers on the system with a mask-based identity system that granted distinct powers for each form.",
  },
  {
    gameId: 'landstalker-sega-genesis',
    title: 'Landstalker',
    summary: "Climax Entertainment's 1992 Genesis isometric action RPG follows treasure hunter Nigel through diamond-collecting puzzle dungeons in a sprawling fantasy world, a visually ambitious title whose precision jumping demands across isometric platforms challenged even dedicated players.",
  },
  {
    gameId: 'mortal-kombat-sega-genesis',
    title: 'Mortal Kombat',
    summary: "Acclaim's 1993 Genesis port of the controversial Midway arcade fighter retained the blood and fatality content that the SNES version censored, a factor that made the Genesis version culturally significant and fueled wider debates that led to the creation of the ESRB.",
  },
  {
    gameId: 'mortal-kombat-3-sega-genesis',
    title: 'Mortal Kombat 3',
    summary: "Williams Entertainment's 1995 Genesis port of the third Mortal Kombat arcade entry introduced running, combo breakers, and new Kombat Kodes to the series formula, delivered on the 16-bit hardware with most of the arcade roster intact across a story-driven tower mode.",
  },
  {
    gameId: 'mortal-kombat-ii-sega-genesis',
    title: 'Mortal Kombat II',
    summary: "Acclaim's 1994 Genesis version of the widely regarded best entry in the original trilogy brings the full Outworld roster, fatalities, and Kahn boss fight to 16-bit hardware in a port that captured much of the arcade experience for home players.",
  },
  // PlayStation — wave 7 supplement (B through F range)
  {
    gameId: 'brave-fencer-musashi-playstation',
    title: 'Brave Fencer Musashi',
    summary: "Square's 1998 PlayStation action RPG follows a diminutive swordsman summoned to save a kingdom from the Thirstquencher Empire, combining real-time melee combat with ability absorption mechanics and a day-night NPC schedule system that gave the world unusual living depth.",
  },
  {
    gameId: 'colin-mcrae-rally-playstation',
    title: 'Colin McRae Rally',
    summary: "Codemasters' 1998 PlayStation rally simulator brought an authentic stage-based structure with real co-driver pacenotes and car damage modeling, establishing a simulation-leaning alternative to arcade racers that launched the influential Colin McRae series.",
  },
  {
    gameId: 'diablo-playstation',
    title: 'Diablo',
    summary: "Blizzard and Climax's 1998 PlayStation port of the seminal PC action RPG brings the dungeon-crawling loop of Tristram's monster-filled cathedral to console with an analog control adaptation, though it sacrificed the PC version's resolution and multiplayer for the translation.",
  },
  {
    gameId: 'dragon-quest-vii-playstation',
    title: 'Dragon Quest VII',
    summary: "Enix's 2000 PlayStation RPG is the series' longest entry, spanning hundreds of hours of turn-based combat across fragmented island-restoring quests through history, a deliberately paced late-era PS1 JRPG that prioritized narrative scope and town-story variety over spectacle.",
  },
  {
    gameId: 'driver-playstation',
    title: 'Driver',
    summary: "Reflections Interactive's 1999 PlayStation open-city driving game cast players as an undercover cop navigating car chases across four American cities from a cinematic third-person chase camera, an influential precursor to the open-world driving genre that followed.",
  },
  {
    gameId: 'fear-effect-playstation',
    title: 'Fear Effect',
    summary: "Kronos Digital's 2000 PlayStation stealth-action game uses compressed streaming video backgrounds to achieve a stylized cel-shaded look, following mercenaries through a cyberpunk Hong Kong mystery with a unique health system that tracked fear state instead of hit points.",
  },
  {
    gameId: 'final-fantasy-ix-playstation',
    title: 'Final Fantasy IX',
    summary: "Square's 2000 PlayStation RPG is a deliberate return to the series' fantasy roots after VII and VIII's sci-fi leanings, following thief Zidane across a world celebrating classic FF iconography with ability-learning equipment mechanics and a densely written ensemble cast.",
  },
  {
    gameId: 'gran-turismo-playstation',
    title: 'Gran Turismo',
    summary: "Polyphony Digital's 1997 PlayStation racing simulation launched a flagship Sony franchise with licensed real-world cars, a license-test progression system, and physics modeling that set a new standard for console driving games and remained the PS1's best-selling title.",
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
          notes = 'G2 summary batch 34'
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
      'G2 summary batch 34'
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
    ) VALUES (?, 'g2_summary_batch_34', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 34 — Genesis wave 7 (A-M), PS1 wave 7 (B-F)')

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
  const runKey = `g2-summary-batch-34-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 34 applied locally on staging sqlite',
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
