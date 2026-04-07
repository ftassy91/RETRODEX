#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Sega Genesis — wave 6 continued (B-C range, verified IDs)
  {
    gameId: 'blackthorne-sega-genesis',
    title: 'Blackthorne',
    summary: "Blizzard Entertainment's 1994 Genesis cinematic platformer follows Kyle Vlaros, a shotgun-wielding warrior returning to rescue his enslaved homeworld from a dark sorcerer, featuring the behind-cover shooting mechanics that influenced later cinematic action game design.",
  },
  {
    gameId: 'bloodshot-sega-genesis',
    title: 'Bloodshot',
    summary: "Domark's 1994 Genesis first-person shooter places a military robot through enemy-facility corridors in one of the earliest FPS attempts on Sega's 16-bit platform, using Mode 7-style scaling to approximate the 3D corridor shooting experience.",
  },
  {
    gameId: 'blue-almanac-sega-genesis',
    title: 'Blue Almanac',
    summary: "Hot-B's 1991 Japan-only Genesis RPG is a science fiction adventure aboard a space station, offering turn-based combat and exploration in an anime-styled narrative that remained exclusive to the Japanese Mega Drive market without a Western release.",
  },
  {
    gameId: 'blue-sphere-sega-genesis',
    title: 'Blue Sphere',
    summary: "Sega's 1996 Japan-only Genesis game is a compilation of the special stage bonus levels from Sonic the Hedgehog 2, unlockable by connecting Sonic 3 & Knuckles lock-on cartridges in a collection that recognized the stages as standalone puzzle-racing content.",
  },
  {
    gameId: 'body-count-sega-genesis',
    title: 'Body Count',
    summary: "Codemasters' 1994 Genesis overhead military shooter places a lone soldier through enemy-infested industrial bases with a Terminator-style premise, offering a multidirectional shooter with destructible environments and weapon upgrades in a cold-war action setting.",
  },
  {
    gameId: 'bonkers-sega-genesis',
    title: 'Bonkers',
    summary: "Sega's 1994 Genesis platformer based on the Disney afternoon animated series follows a cartoon tiger-police officer through side-scrolling crime-fighting stages, one of several Sega-published Disney licensed titles released for the 16-bit platform.",
  },
  {
    gameId: 'boogerman-a-pick-and-flick-adventure-sega-genesis',
    title: 'Boogerman: A Pick and Flick Adventure',
    summary: "Interplay's 1994 Genesis platformer stars a superhero whose powers are entirely based on bodily functions, using snot, burps, and flatulence as combat and traversal tools in a deliberately crude title that embodied the irreverent character design trend of the era.",
  },
  {
    gameId: 'brett-hull-hockey-95-sega-genesis',
    title: "Brett Hull Hockey '95",
    summary: "Accolade's Genesis hockey simulation carries the Blues sniper's endorsement with a roster of NHL-caliber players, expanding on the previous Brett Hull Hockey with updated statistics and an improved slap-shot power meter mechanic.",
  },
  {
    gameId: 'brian-lara-cricket-96-sega-genesis',
    title: 'Brian Lara Cricket 96',
    summary: "Codemasters' Genesis cricket simulation carries the West Indies batting legend's endorsement, offering an accessible cricket game with fielding placement, bowling selection, and Test Match formats for the platform's international sports audience.",
  },
  {
    gameId: 'brutal-paws-of-fury-sega-genesis',
    title: 'Brutal: Paws of Fury',
    summary: "GameTek's 1994 Genesis fighting game features an all-animal martial artist roster — including a dog, cat, and panda — in one-on-one combat with a unique rage meter, combining conventional fighting game mechanics with a comedic animal-athlete aesthetic.",
  },
  {
    gameId: 'bubba-n-stix-sega-genesis',
    title: "Bubba 'n' Stix",
    summary: "Core Design's 1994 Genesis puzzle-platformer pairs a caveman with a magical stick that doubles as a lever, pole, and weapon, using the versatile prop as the central mechanic for navigating environments and solving increasingly elaborate stage puzzles.",
  },
  {
    gameId: 'bubble-and-squeak-sega-genesis',
    title: 'Bubble and Squeak',
    summary: "Audiogenic's 1994 Genesis puzzle-platformer follows a boy and alien creature cooperating to navigate stages, using the alien companion's unique abilities to solve puzzles that neither character could overcome individually in a buddy-system platformer.",
  },
  {
    gameId: 'bubsy-2-sega-genesis',
    title: 'Bubsy 2',
    summary: "Accolade's 1994 Genesis sequel to the bobcat platformer expands the cast with cooperative play options and new themed worlds, continuing the series' approach to fast mascot platforming despite facing heightened competition from increasingly polished genre peers.",
  },
  {
    gameId: 'bugs-bunny-in-double-trouble-sega-genesis',
    title: 'Bugs Bunny in Double Trouble',
    summary: "Sega's 1996 Genesis platformer casts Bugs Bunny through parody recreations of famous movie genres — western, horror, spy thriller — exploiting the character's cartoon reality-bending humor as level-design premises in a late-era licensed platformer.",
  },
  {
    gameId: 'bulls-vs-lakers-and-the-nba-playoffs-sega-genesis',
    title: 'Bulls vs Lakers and the NBA Playoffs',
    summary: "EA Sports' 1992 Genesis basketball game focuses on the NBA playoff bracket format with the Jordan-era Bulls and Showtime Lakers as the marquee matchup, offering a more compact competitive structure than full-season simulations in an early EA NBA title.",
  },
  {
    gameId: 'bulls-vs-blazers-and-the-nba-playoffs-sega-genesis',
    title: 'Bulls vs. Blazers and the NBA Playoffs',
    summary: "EA Sports' 1993 Genesis basketball sequel updates the playoff-format NBA game with the 1992-93 season's Bulls-Blazers matchup, expanding the roster and refining the court physics from the previous Bulls vs Lakers installment.",
  },
  {
    gameId: 'cadillacs-and-dinosaurs-the-second-cataclysm-sega-genesis',
    title: 'Cadillacs and Dinosaurs: The Second Cataclysm',
    summary: "Rocket Science Games' 1994 Genesis adaptation of the Xenozoic Tales comic features Jack Tenrec and Hannah Dundee fighting poachers in a post-apocalyptic dinosaur-inhabited world, combining the arcade side-scrolling brawler format with the comic's environmental themes.",
  },
  {
    gameId: 'caesars-palace-sega-genesis',
    title: "Caesars Palace",
    summary: "Virgin Games' 1993 Genesis casino simulation recreates the Las Vegas resort's gambling floor with blackjack, roulette, slots, and poker tables, presenting authentic casino game rules in a virtual gambling environment under the official Caesars brand license.",
  },
  {
    gameId: 'cal-ripken-jr-baseball-sega-genesis',
    title: 'Cal Ripken Jr. Baseball',
    summary: "Mindscape's 1992 Genesis baseball game carries the Iron Man's endorsement with his likeness on cover and in gameplay, offering a standard diamond baseball simulation marketed around Ripken's consecutive games streak popularity during his career peak.",
  },
  {
    gameId: 'captain-planet-and-the-planeteers-sega-genesis',
    title: 'Captain Planet and the Planeteers',
    summary: "Sega's 1992 Genesis platformer based on the Ted Turner-produced animated series combines the Planeteers' elemental powers to summon and control Captain Planet across environmental-themed stages, adapting the eco-activist cartoon's premise into a side-scrolling action game.",
  },
  {
    gameId: 'atp-tour-championship-tennis-sega-genesis',
    title: 'ATP Tour Championship Tennis',
    summary: "Sega's 1994 Genesis tennis game carries the ATP Tour license with real player names across clay, hard, and grass court surfaces, offering a circuit-following tournament mode that tracks rankings alongside the exhibition match options.",
  },
  {
    gameId: 'anetto-futatabi-sega-genesis',
    title: 'Anetto Futatabi',
    summary: "Sega's 1994 Japan-only Genesis game is based on the Japanese variety television program, offering a quiz and entertainment game in the licensed TV show format common to the domestic Mega Drive software catalog.",
  },
  {
    gameId: '16-tile-mah-jongg-sega-genesis',
    title: '16-Tile Mah Jongg',
    summary: "Sega's 1991 Japan-only Genesis tile game presents a traditional East Asian mahjong simulation with a 16-tile variant ruleset, one of numerous domestic Japanese mahjong titles in the Mega Drive library catering to the game's substantial Japanese following.",
  },
  {
    gameId: 'battle-fantasy-sega-genesis',
    title: 'Battle Fantasy',
    summary: "Venezia's 1994 Japan-only Genesis RPG presents a fantasy adventure with turn-based combat in a compact domestic release, offering straightforward role-playing quest mechanics in a title that remained exclusive to the Japanese Mega Drive market.",
  },
  {
    gameId: 'bill-walsh-college-football-95-sega-genesis',
    title: "Bill Walsh College Football '95",
    summary: "EA Sports' 1994 Genesis college football simulation carries the legendary 49ers coach's endorsement with updated rosters and playbooks, continuing the endorsed franchise that brought college-level football simulation to EA's 16-bit sports lineup.",
  },
  {
    gameId: 'bubble-bath-babes-sega-genesis',
    title: 'Bubble Bath Babes',
    summary: "Panesian's unlicensed 1991 Genesis puzzle game is an adult-themed adaptation of the bubble-matching puzzle format, one of three unlicensed Panesian adult titles released for the Mega Drive without Sega's official approval in the North American market.",
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
          notes = 'G2 summary batch 30'
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
      'G2 summary batch 30'
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
    ) VALUES (?, 'g2_summary_batch_30', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 30 — Genesis wave 6 (B-C range)')

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
  const runKey = `g2-summary-batch-30-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 30 applied locally on staging sqlite',
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
