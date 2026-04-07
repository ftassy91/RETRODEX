#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Game Boy Advance — wave 4 (G through Z range, French-placeholder replacements)
  {
    gameId: 'golden-sun-the-lost-age-game-boy-advance',
    title: 'Golden Sun: The Lost Age',
    summary: "Camelot's 2002 GBA RPG sequel continues directly from the original's cliffhanger ending by switching perspective to the antagonist party Felix, expanding the Djinn-summoning Psynergy system and delivering the conclusion of the lighthouse-lighting quest across a second full-length adventure.",
  },
  {
    gameId: 'kirby-the-amazing-mirror-game-boy-advance',
    title: 'Kirby & The Amazing Mirror',
    summary: "HAL Laboratory's 2004 GBA platformer places four Kirby clones in a non-linear mirror world explorable in any order, with a wireless four-player co-op mode where players phone each other's Kirby for assistance in an interconnected Metroidvania-style map structure.",
  },
  {
    gameId: 'kirby-nightmare-in-dream-land-game-boy-advance',
    title: 'Kirby: Nightmare in Dream Land',
    summary: "HAL Laboratory's 2002 GBA remake of Kirby's Adventure adds updated graphics, a boss rush mode, and four-player mini-games to the NES original's comprehensive copy ability system, preserving one of the best-regarded NES games in a portable format with co-op enhancements.",
  },
  {
    gameId: 'mario-golf-advance-tour-game-boy-advance',
    title: 'Mario Golf: Advance Tour',
    summary: "Camelot's 2004 GBA golf RPG follows original characters Neil and Ella through a tournament circuit improving their stats alongside Mario's cast in a hybrid that blended the GBC Mario Golf RPG structure with the precision shot mechanics of the GameCube entry.",
  },
  {
    gameId: 'mario-kart-super-circuit-game-boy-advance',
    title: 'Mario Kart: Super Circuit',
    summary: "Intelligent Systems' 2001 GBA racer is the first handheld Mario Kart, featuring all 20 courses from Super Mario Kart alongside 20 original tracks with a coin-collecting mechanic that added an extra strategic layer to the traditional Grand Prix and Battle modes.",
  },
  {
    gameId: 'megaman-zero-game-boy-advance',
    title: 'Mega Man Zero',
    summary: "Inti Creates' 2002 GBA action platformer repositions Zero as the protagonist in a dark post-war future where reploids face extermination, delivering precise saber and buster combat in a series praised for its tight mechanics, stark narrative tone, and demanding difficulty curve.",
  },
  {
    gameId: 'megaman-zero-2-game-boy-advance',
    title: 'Mega Man Zero 2',
    summary: "Inti Creates' 2003 GBA action platformer refined the first Zero game's combat with an EX Skill system rewarding high-rank mission completions with special elemental techniques, continuing Zero's resistance storyline across a more varied and mechanically polished sequel.",
  },
  {
    gameId: 'mega-man-zero-3-game-boy-advance',
    title: 'Mega Man Zero 3',
    summary: "Inti Creates' 2004 GBA action platformer is often cited as the series peak, reintroducing the Cyber-elf system from the original with reduced penalties and adding Sub Tank health recovery in a mechanically accessible entry that retained the series' signature precision action.",
  },
  {
    gameId: 'pokemon-firered-game-boy-advance',
    title: 'Pokemon FireRed',
    summary: "Game Freak's 2004 GBA remake of the original Pokemon Red updates the Kanto region with Ruby and Sapphire's full feature set including abilities, natures, and a new Sevii Islands post-game archipelago, making the series' origin accessible on modern hardware with full connectivity to Generation III games.",
  },
  {
    gameId: 'pokemon-ruby-game-boy-advance',
    title: 'Pokemon Ruby',
    summary: "Game Freak's 2002 GBA entry launched Generation III with 135 new Pokemon in the Hoenn region, introducing Abilities, Natures, double battles, Contests, and the Battle Tower challenge alongside a story involving the legendary Groudon and the villainous Team Magma.",
  },
  {
    gameId: 'pokemon-emerald-game-boy-advance',
    title: 'Pokemon Emerald',
    summary: "Game Freak's 2004 GBA third version of Generation III combines Ruby and Sapphire's rival legendary plots into a single story featuring Rayquaza, adds the Battle Frontier post-game facility with seven specialized challenge facilities, and remains the definitive Hoenn experience on GBA.",
  },
  {
    gameId: 'rebelstar-tactical-command-game-boy-advance',
    title: 'Rebelstar: Tactical Command',
    summary: "Codo Technologies' 2005 GBA tactical RPG is a modern entry in Julian Gollop's Rebelstar lineage of turn-based squad tactics, sending a small resistance team through alien-occupied territory in a portable strategy game that carried the DNA of the original 1980s Spectrum title.",
  },
  {
    gameId: 'sonic-advance-game-boy-advance',
    title: 'Sonic Advance',
    summary: "Dimps' 2001 GBA platformer marked Sonic's debut on Nintendo hardware following the end of Sega's console hardware business, delivering four playable characters with distinct abilities in a fast side-scrolling format that adapted the classic 2D Sonic template to the handheld's landscape orientation.",
  },
  {
    gameId: 'super-mario-advance-game-boy-advance',
    title: 'Super Mario Advance',
    summary: "Nintendo's 2001 GBA launch title remakes Super Mario Bros. 2 with updated graphics, voice acting, and Yoshi egg hunting side content, making the SNES All-Stars version of the NES game accessible on the new handheld alongside a revised Mario Bros. arcade mode.",
  },
  {
    gameId: 'sword-of-mana-game-boy-advance',
    title: 'Sword of Mana',
    summary: "Square Enix's 2003 GBA remake of the original Final Fantasy Adventure reimagines the first Mana game with a dual-protagonist system, full voice acting, and revised story content that aligned the narrative more closely with the Secret of Mana mythology.",
  },
  {
    gameId: 'tactics-ogre-the-knight-of-lodis-game-boy-advance',
    title: 'Tactics Ogre: The Knight of Lodis',
    summary: "Quest's 2001 GBA tactical RPG is a prequel to the main Tactics Ogre saga following cavalier Alphonse Loeher's mission to the island of Ovis, delivering the series' moral choice system and grid-based combat in a self-contained story that introduced the emblem-based deity alignment mechanic.",
  },
  {
    gameId: 'wario-land-4-game-boy-advance',
    title: 'Wario Land 4',
    summary: "Nintendo R&D1's 2001 GBA launch platformer sends Wario through a pyramid's themed worlds collecting coins and CD tracks with a timed escape sequence closing each stage, a mechanically inventive entry with unique status-transformation gimmicks and a CD player sound test featuring original music.",
  },
  // Super Nintendo — wave 1 supplement (F through G range)
  {
    gameId: 'final-fantasy-iv-super-nintendo',
    title: 'Final Fantasy IV',
    summary: "Square's 1991 SNES RPG introduced the Active Time Battle system and a fully scripted ensemble cast to the series, following Cecil's redemption arc from dark knight to paladin across a story of crystals, betrayal, and lunar conflict that raised the cinematic ambition of the JRPG form.",
  },
  {
    gameId: 'final-fantasy-v-super-nintendo',
    title: 'Final Fantasy V',
    summary: "Square's 1992 Super Famicom RPG is the series' deepest mechanical entry, centering its entire design around the Job System where characters mix and match abilities from dozens of classes, a Japan-only release until its 1999 PlayStation port whose system depth influenced FF Tactics and XI.",
  },
  {
    gameId: 'final-fight-super-nintendo',
    title: 'Final Fight',
    summary: "Capcom's 1991 SNES port of the 1989 arcade beat-'em-up removed the two-player co-op and a playable character from the coin-op original, controversially delivering a single-player-only version of the foundational Metro City brawler that nonetheless showcased the SNES's processing above the Genesis.",
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
          notes = 'G2 summary batch 40'
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
      'G2 summary batch 40'
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
    ) VALUES (?, 'g2_summary_batch_40', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 40 — GBA wave 4 (G-Z), SNES wave 1 supplement (F-G)')

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
  const runKey = `g2-summary-batch-40-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 40 applied locally on staging sqlite',
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
