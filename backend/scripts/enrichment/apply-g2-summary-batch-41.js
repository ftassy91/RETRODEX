#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Sega Saturn — wave 5 (remaining French-placeholder replacements)
  {
    gameId: 'albert-odyssey-sega-saturn',
    title: 'Albert Odyssey: Legend of Eldean',
    summary: "Sunsoft's 1995 Saturn action RPG follows a boy raised by harpies who discovers his human origins, offering real-time combat with elemental magic across a fantasy world in a Working Designs North American localization notable for its vocal cast and adapted script humor.",
  },
  {
    gameId: 'fighters-megamix-sega-saturn',
    title: 'Fighters Megamix',
    summary: "Sega's 1996 Saturn crossover fighter assembles characters from Virtua Fighter 2 and Fighting Vipers alongside AM2 mascots and unlockable joke fighters, a technically impressive Saturn exclusive that pushed the hardware with large character models and smooth framerates.",
  },
  {
    gameId: 'shining-wisdom-sega-saturn',
    title: 'Shining Wisdom',
    summary: "Camelot's 1995 Saturn action RPG is a real-time adventure in the Shining Force universe following apprentice wizard Mars through dungeon exploration and puzzle-solving, a Japan-original Working Designs localization that sat apart from the series' tactical RPG entries.",
  },
  {
    gameId: 'shining-the-holy-ark-sega-saturn',
    title: 'Shining the Holy Ark',
    summary: "Camelot's 1996 Saturn RPG is a first-person dungeon crawler in the Shining universe, following mercenaries exploring trap-filled labyrinths in turn-based combat with a party system that blended Shining Force characters with the Wizardry-style grid navigation format.",
  },
  {
    gameId: 'house-of-the-dead-sega-saturn',
    title: 'The House of the Dead',
    summary: "Sega's 1998 Saturn port of the AM1 on-rails light-gun arcade shooter places agents through a zombie-infested mansion with branching routes determined by rescuing scientists, a Saturn exclusive home port of the coin-op that supported the Stunner light-gun peripheral.",
  },
  {
    gameId: 'thunder-force-v-sega-saturn',
    title: 'Thunder Force V',
    summary: "Technosoft's 1997 Saturn horizontal shoot-'em-up is the series' graphical peak and narrative culmination, delivering the CRAW multi-directional weapon system across cinematic stages with a science fiction story about the Rynex weapon's origin that concluded the developer's flagship franchise.",
  },
  {
    gameId: 'vampire-savior-sega-saturn',
    title: 'Vampire Savior',
    summary: "Capcom's 1997 Saturn port of Darkstalkers 3 brings the fighting game's gothic horror roster and Dark Force system to the home console in the CPS2 system's most technically ambitious fighter, a cult classic praised for its fluid animation and aggressive offensive design.",
  },
  {
    gameId: 'wipeout-sega-saturn',
    title: 'Wipeout',
    summary: "Psygnosis' 1996 Saturn port of the anti-gravity racing title introduced the futuristic F3600 league to Sega's console with weapon pickups, licensed Prodigy and Leftfield electronic music, and a visual design by The Designers Republic that established the series' iconic aesthetic.",
  },
  // Super Nintendo — wave 2 (G through Z range, French-placeholder replacements)
  {
    gameId: 'gradius-iii-super-nintendo',
    title: 'Gradius III',
    summary: "Konami's 1990 SNES launch title is a home-exclusive entry in the Gradius series with a fully customizable weapon loadout system allowing players to design their own upgrade bar configurations, a technically demanding shooter that demonstrated the SNES's processing power against crowds of sprites.",
  },
  {
    gameId: 'harvest-moon-super-nintendo',
    title: 'Harvest Moon',
    summary: "Pack-In-Video's 1996 SNES farming simulation launched one of gaming's most enduring life-simulation series, tasking players with restoring a grandfather's neglected farm through crop cultivation, livestock raising, and village relationship building across changing seasons.",
  },
  {
    gameId: 'illusion-of-gaia-super-nintendo',
    title: 'Illusion of Gaia',
    summary: "Quintet's 1993 SNES action RPG follows Will and his transforming companions through ancient world-heritage sites including the Great Wall and Incan pyramids in a tight action combat system, part of Quintet's spiritual trilogy with Soul Blazer and Terranigma.",
  },
  {
    gameId: 'joe-mac-super-nintendo',
    title: 'Joe & Mac',
    summary: "Data East's 1992 SNES port of the prehistoric beat-'em-up arcade game follows cavemen Joe and Mac rescuing kidnapped caveswomen from dinosaur-riding rivals across colorful prehistoric stages, a two-player co-op arcade brawler with power-up-based weapon progression.",
  },
  {
    gameId: 'killer-instinct-super-nintendo',
    title: 'Killer Instinct',
    summary: "Rare's 1995 SNES port of the Rare and Nintendo ACM arcade fighter brought the pre-rendered 3D-graphics-on-2D-gameplay style to home consoles, featuring combo-breakers, ultra combos, and a roster of supernatural fighters in an impressive port that used a special DSP chip for audio.",
  },
  {
    gameId: 'kirby-super-star-super-nintendo',
    title: 'Kirby Super Star',
    summary: "HAL Laboratory's 1996 SNES collection packages eight distinct Kirby modes from classic platforming to racing and samurai duels, introducing the helper system where Copy Abilities spawn AI companions, widely cited as the best SNES Kirby game for its variety and co-op support.",
  },
  {
    gameId: 'lufia-ii-rise-of-the-sinistrals-super-nintendo',
    title: 'Lufia II: Rise of the Sinistrals',
    summary: "Neverland's 1995 SNES RPG prequel to Lufia features environmental puzzle-solving integrated into dungeons alongside its turn-based combat, a design approach that elevated the sequel above the original and remains praised for the Ancient Cave bonus roguelike dungeon with persistent item loss.",
  },
  {
    gameId: 'mega-man-7-super-nintendo',
    title: 'Mega Man 7',
    summary: "Capcom's 1995 SNES action platformer marked the Blue Bomber's first and only 16-bit original entry, adding Dr. Light rescue missions, a secret shop, and Bass as a rival character in an eight-robot-master campaign that delivered polished SNES-exclusive visuals before Mega Man 8's PlayStation debut.",
  },
  {
    gameId: 'mega-man-x-super-nintendo',
    title: 'Mega Man X',
    summary: "Capcom's 1993 SNES action platformer launched a darker franchise branch set a century after the original series, with Wall-climbing, dashing, and armor capsule upgrades adding mobility that transformed the tight combat formula and spawned one of the most acclaimed action game series.",
  },
  {
    gameId: 'mega-man-x2-super-nintendo',
    title: 'Mega Man X2',
    summary: "Capcom's 1994 SNES action platformer introduced the X-Hunter antagonists pursuing Zero's parts alongside Secret Tanks and the Shoryuken Hadouken upgrade hidden in the game, a refined sequel that used a custom CX4 chip for 3D wireframe effects in two special stages.",
  },
  {
    gameId: 'mega-man-x3-super-nintendo',
    title: 'Mega Man X3',
    summary: "Capcom's 1995 SNES action platformer added limited Zero playability and the Hyper Chip full-armor upgrade to the X series formula, the final original SNES X entry before the series moved to PlayStation and Saturn with the graphically enhanced Mega Man X4.",
  },
  {
    gameId: 'nba-jam-super-nintendo',
    title: 'NBA Jam',
    summary: "Acclaim's 1994 SNES port of Midway's breakout basketball arcade game delivers the same two-on-two high-flying dunks and on-fire momentum system to Nintendo's platform, a conversion that brought the coin-op phenomenon home in the same release window as its Genesis counterpart.",
  },
  {
    gameId: 'pilot-wings-super-nintendo',
    title: 'Pilotwings',
    summary: "Nintendo's 1990 SNES launch title showcased Mode 7 rotation in flight school missions covering hang gliding, rocketbelt, skydiving, and light plane disciplines evaluated by a points-based grading system, a technical launch showcase that demonstrated the SNES hardware's scaling and rotation capabilities.",
  },
  {
    gameId: 'rock-n-roll-racing-super-nintendo',
    title: "Rock N' Roll Racing",
    summary: "Silicon & Synapse's 1993 SNES isometric combat racer combines vehicular weapon combat with licensed heavy metal tracks from Black Sabbath and Deep Purple, a Blizzard Entertainment predecessor title featuring exploding cars, galaxy-hopping campaigns, and two-player simultaneous racing.",
  },
  {
    gameId: 'shadowrun-super-nintendo',
    title: 'Shadowrun',
    summary: "Beam Software's 1993 SNES cyberpunk RPG adapts the tabletop roleplaying universe with a point-and-click dialogue interface and real-time brawler combat, following Jake Armitage uncovering a corporate conspiracy in near-future Seattle across a condensed but atmospheric JRPG structure.",
  },
  {
    gameId: 'simcity-super-nintendo',
    title: 'SimCity',
    summary: "Nintendo's 1991 SNES version of Maxis' city-building simulation added a Mode 7 scenario map, Nintendo-themed rewards including a Mario statue, and Dr. Wright as an advisor character, a console adaptation of the seminal PC city simulator that sold over 2 million copies on Nintendo's platform.",
  },
  {
    gameId: 'starfox-super-nintendo',
    title: 'Star Fox',
    summary: "Nintendo's 1993 SNES space shooter pioneered polygon 3D graphics in a Nintendo console game through the custom Super FX chip, launching the Star Fox franchise as Arwing pilot Fox McCloud fought through three difficulty-tiered routes to reach the Lylat system's Andross.",
  },
  {
    gameId: 'street-fighter-ii-super-nintendo',
    title: 'Street Fighter II',
    summary: "Capcom's 1992 SNES port of the defining fighting arcade game was the first faithful home conversion, retaining all eight world warriors and the special move system in a release that sold six million cartridges and demonstrated the SNES's processing advantage over the Genesis version.",
  },
  {
    gameId: 'super-bomberman-super-nintendo',
    title: 'Super Bomberman',
    summary: "Hudson's 1993 SNES multiplayer maze-bomb game expanded the franchise with a five-player simultaneous Battle Mode using the SNES Multitap, delivering the maze-explosion formula in 16-bit with a single-player story campaign and the cooperative and competitive local multiplayer that defined the series.",
  },
  // Game Gear — wave 1 (all French-placeholder replacements)
  {
    gameId: 'aerial-assault-game-gear',
    title: 'Aerial Assault',
    summary: "Sega's 1990 Game Gear vertical shoot-'em-up places a fighter jet through enemy-filled airspace collecting power-ups and confronting end-stage bosses, a launch-window handheld shooter that demonstrated the Game Gear's color capabilities compared to the original monochrome Game Boy.",
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
          notes = 'G2 summary batch 41'
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
      'G2 summary batch 41'
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
    ) VALUES (?, 'g2_summary_batch_41', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 41 — Saturn wave 5 (remaining), SNES wave 2 (G-Z), Game Gear wave 1 (partial)')

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
  const runKey = `g2-summary-batch-41-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 41 applied locally on staging sqlite',
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
