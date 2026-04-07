#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // GBA — notable missing
  {
    gameId: 'advance-wars-2-black-hole-rising-game-boy-advance',
    title: 'Advance Wars 2: Black Hole Rising',
    summary: 'Intelligent Systems\' GBA sequel refines the CO system with new powers and units, pitting Andy\'s allied forces against a reinvigorated Black Hole Army in a campaign that builds on the first game\'s mechanics.',
  },
  {
    gameId: 'banjo-kazooie-grunty-s-revenge-game-boy-advance',
    title: 'Banjo-Kazooie: Grunty\'s Revenge',
    summary: 'Rare\'s GBA Banjo spinoff takes the bear and bird back to 2.5D in a time-travel adventure that bridges the N64 games, scaling the franchise\'s platformer design to the handheld format with distinct overworld zones.',
  },
  {
    gameId: 'banjo-pilot-game-boy-advance',
    title: 'Banjo-Pilot',
    summary: 'Rare\'s GBA racing spinoff puts Banjo-Kazooie characters in aerial kart races, repurposing a Mode 7-style engine originally developed for a Diddy Kong Racing sequel into a standalone portable racer.',
  },
  {
    gameId: 'baldur-s-gate-dark-alliance-game-boy-advance',
    title: "Baldur's Gate: Dark Alliance",
    summary: "A GBA port of Snowblind's console hack-and-slash dungeon RPG, adapting the isometric action and D&D setting to the handheld with simplified controls while retaining the loot-driven progression of the original.",
  },
  {
    gameId: 'alien-hominid-game-boy-advance',
    title: 'Alien Hominid',
    summary: 'The Behemoth\'s run-and-gun debut arrives on GBA in a scaled adaptation of the original Flash game, featuring the alien protagonist\'s aggressive ground combat and distinctive hand-drawn visual style.',
  },
  {
    gameId: 'altered-beast-guardian-of-the-realms-game-boy-advance',
    title: 'Altered Beast: Guardian of the Realms',
    summary: 'A GBA reimagining of the Sega arcade classic that redesigns the beast transformation system for a new action-platformer structure, moving away from the linear brawler format of the 16-bit original.',
  },
  {
    gameId: 'avatar-the-last-airbender-game-boy-advance',
    title: 'Avatar: The Last Airbender',
    summary: 'The first handheld adaptation of Nickelodeon\'s animated series puts Aang and his team through platforming stages tied to the show\'s opening season, using the four bending disciplines as distinct combat styles.',
  },
  // PlayStation — notable missing
  {
    gameId: 'air-combat-playstation',
    title: 'Air Combat',
    summary: 'Namco\'s PS1 launch-era arcade flight game established the template for the Ace Combat series, offering fast mission-based air combat with a fighter unlock economy and a simplified pseudo-realistic flight model.',
  },
  {
    gameId: 'ace-combat-2-playstation',
    title: 'Ace Combat 2',
    summary: 'Namco\'s PS1 sequel expands the series with a branching mission structure, a larger aircraft roster, and the first coordinated wingman commands, refining the arcade flight formula that Air Combat introduced.',
  },
  {
    gameId: 'ace-combat-3-playstation',
    title: 'Ace Combat 3: Electrosphere',
    summary: 'Namco\'s third PS1 entry set the series in a near-future sci-fi world, featuring multiple branching endings and a story-driven structure that the international release heavily condensed from the original Japanese version.',
  },
  {
    gameId: 'alien-resurrection-playstation',
    title: 'Alien Resurrection',
    summary: 'Argonaut\'s PS1 adaptation of the fourth Alien film delivers claustrophobic first-person shooting through the Auriga\'s corridors, notable for an inverted dual-analog control scheme that preceded mainstream adoption.',
  },
  {
    gameId: 'akuji-the-heartless-playstation',
    title: 'Akuji the Heartless',
    summary: 'Crystal Dynamics\' dark third-person action game places a voodoo priest through a journey through the underworld, featuring soul-collection mechanics and tribal supernatural combat in a grim afterlife setting.',
  },
  // Sega Genesis — wave 3
  {
    gameId: 'animaniacs-sega-genesis',
    title: 'Animaniacs',
    summary: 'Konami\'s Genesis adaptation of the Warner Bros. cartoon takes a different structural approach from the SNES version, placing the Warner siblings through a studio lot adventure with the show\'s comedic energy.',
  },
  {
    gameId: 'awesome-possum-kicks-dr-machino-s-butt-sega-genesis',
    title: "Awesome Possum... Kicks Dr. Machino's Butt",
    summary: 'Tengen\'s environmental mascot platformer positions a wise-talking possum against an industrial polluter, filling its stages with pop quizzes about conservation and leaning into the anti-Sonic mascot trend of the early 90s.',
  },
  {
    gameId: 'batman-forever-sega-genesis',
    title: 'Batman Forever',
    summary: 'Acclaim\'s Genesis port of the Schumacher film adaptation uses the same digitized sprite engine as the SNES version, delivering two-player superhero brawling through dark Gotham environments with limited combat variety.',
  },
  {
    gameId: 'addams-family-values-sega-genesis',
    title: 'Addams Family Values',
    summary: 'Ocean\'s Genesis adaptation of the film sequel casts Uncle Fester in a top-down action RPG, departing from the platformer format of earlier Addams Family games with dungeon-style exploration and item management.',
  },
  {
    gameId: 'aero-the-acro-bat-2-sega-genesis',
    title: 'Aero the Acro-Bat 2',
    summary: 'Sunsoft\'s sequel returns the circus acrobat to a new set of stage-themed worlds, tightening the original\'s design with improved pacing and new aerial maneuvers while maintaining the series\' distinctive big-top aesthetic.',
  },
  {
    gameId: 'beavis-and-butt-head-sega-genesis',
    title: 'Beavis and Butt-Head',
    summary: 'Viacom\'s Genesis adaptation of the MTV cartoon sends the duo through Highland in a side-scrolling adventure, capturing the show\'s lowbrow humor through crude enemy designs and the characteristic voice samples.',
  },
  {
    gameId: 'barkley-shut-up-and-jam-2-sega-genesis',
    title: 'Barkley Shut Up and Jam! 2',
    summary: 'Accolade\'s sequel improves on the original Genesis basketball game with expanded rosters and tighter streetball mechanics, building on the first title\'s arcade-style two-on-two format.',
  },
  {
    gameId: 'asterix-and-the-great-rescue-sega-genesis',
    title: 'Asterix and the Great Rescue',
    summary: 'Core Design\'s Genesis platformer sends Asterix and Obelix through five diverse environments to rescue Getafix from Caesar, offering alternating two-character play with distinct abilities across a traditional licensed platformer structure.',
  },
  {
    gameId: 'asterix-and-the-power-of-the-gods-sega-genesis',
    title: 'Asterix and the Power of the Gods',
    summary: 'MiCom\'s Genesis entry features Asterix and Obelix alternating through side-scrolling stages across ancient Mediterranean settings, providing a later-era licensed platformer that extends the Gaulish franchise on 16-bit hardware.',
  },
  {
    gameId: 'beauty-the-beast-roar-of-the-beast-sega-genesis',
    title: 'Beauty & The Beast: Roar of the Beast',
    summary: 'Sunsoft\'s Genesis platformer follows the Beast through castle environments in a licensed game tied to the Disney animated film, prioritizing action-platformer fundamentals over the film\'s romantic narrative.',
  },
  {
    gameId: 'bc-racers-sega-genesis',
    title: 'BC Racers',
    summary: 'Core Design\'s Genesis kart racer pairs prehistoric drivers with passengers in two-seater bone vehicles, blending the era\'s kart racing trend with a flintstones-style caveman setting and weapon pickups.',
  },
  // SNES — wave 3
  {
    gameId: 'an-american-tail-fievel-goes-west-super-nintendo',
    title: 'An American Tail: Fievel Goes West',
    summary: 'Capcom\'s SNES platformer adapts the Don Bluth sequel film with Fievel navigating the frontier in a licensed side-scroller that retains the film\'s visual warmth within the constraints of the hardware.',
  },
  {
    gameId: 'armored-police-metal-jack-super-nintendo',
    title: 'Armored Police Metal Jack',
    summary: 'Atlus\' Japan-only SNES mecha action game puts players in an armored suit battling crime through urban and industrial environments, mixing beat-\'em-up brawling with light shooting in a sci-fi police procedural frame.',
  },
  {
    gameId: 'battle-blaze-super-nintendo',
    title: 'Battle Blaze',
    summary: 'Sammy\'s early SNES one-on-one fighting game offers a small roster of fantasy warriors in a conventional tournament structure, serving as a mid-tier genre representative in the era\'s crowded SNES fighting landscape.',
  },
  {
    gameId: 'best-of-the-best-championship-karate-super-nintendo',
    title: 'Best of the Best: Championship Karate',
    summary: 'Electro Brain\'s SNES karate simulation uses a side-view perspective with directional blocking, aiming for a more realistic point-fighting structure than the era\'s dominant Street Fighter-influenced arcade fighters.',
  },
  {
    gameId: 'bebe-s-kids-super-nintendo',
    title: "Bebe's Kids",
    summary: 'Motown Software\'s SNES fighter based on the Reginald Hudlin animated film adapts its premise into a one-on-one fighting game with a predominantly Black cast, notable as one of the few licensed films of its kind to reach the SNES.',
  },
  {
    gameId: 'bs-f-zero-2-grand-prix-super-nintendo',
    title: 'BS F-Zero 2 Grand Prix',
    summary: 'A Satellaview broadcast sequel to the original F-Zero featuring new courses and an additional machine, distributed exclusively over the BS-X service in Japan and now only accessible through preservation archives.',
  },
  {
    gameId: 'adventures-of-rocky-bullwinkle-and-friends-super-nintendo',
    title: 'Adventures of Rocky & Bullwinkle and Friends',
    summary: 'T*HQ\'s SNES platformer adapts the classic Jay Ward cartoon characters through distinct side-scrolling segments for Rocky, Bullwinkle, Boris, Natasha, and Dudley Do-Right, each with separate play styles.',
  },
  {
    gameId: 'amazing-hebereke-super-nintendo',
    title: 'Amazing Hebereke',
    summary: 'Sunsoft\'s Japan-only SNES party game is a four-player competitive arena title featuring characters from the Hebereke series, offering a minigame-style multiplayer experience grounded in the franchise\'s absurdist comedy.',
  },
  {
    gameId: 'appleseed-super-nintendo',
    title: 'Appleseed',
    summary: 'Gainax\'s Japan-only SNES action RPG adapts Masamune Shirow\'s cyberpunk manga with isometric combat and tactical elements, placing Deunan Knute in a futuristic conflict between humans and Bioroids.',
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
          notes = 'G2 summary batch 10'
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
      'G2 summary batch 10'
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
    ) VALUES (?, 'g2_summary_batch_10', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 10 — GBA, PS1, Genesis/SNES wave 3')

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
  const runKey = `g2-summary-batch-10-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 10 applied locally on staging sqlite',
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
