#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // SNES — next wave
  {
    gameId: 'bombuzal-super-nintendo',
    title: 'Bombuzal',
    summary: 'An isometric puzzle game where players detonate all bombs on a destructing tile grid without falling through, demanding spatial awareness and careful chain-reaction sequencing across dozens of stages.',
  },
  {
    gameId: 'american-gladiators-super-nintendo',
    title: 'American Gladiators',
    summary: 'Gametek\'s SNES adaptation of the televised competition reproduces six physical events including Joust and Powerball in a digitized-sprite competitive format for one or two players.',
  },
  {
    gameId: 'blazeon-super-nintendo',
    title: 'BlaZeon',
    summary: 'Atlus\'s horizontal shooter lets players capture and pilot enemy mechs, turning opponents\' own firepower into the player\'s arsenal across five mechanized combat stages with a distinctive capture hook.',
  },
  {
    gameId: 'arcus-odyssey-super-nintendo',
    title: 'Arcus Odyssey',
    summary: 'Wolfteam\'s top-down action RPG offers four-character selection and dungeon exploration across a fantasy narrative, delivering direct combat-focused gameplay suited for single-player or co-op runs.',
  },
  {
    gameId: 'b-o-b-super-nintendo',
    title: 'B.O.B.',
    summary: 'Electronic Arts\' side-scrolling action game follows a robot on a rescue mission across alien environments, mixing platforming with a gadget inventory and a humor-driven presentation unusual for the era.',
  },
  {
    gameId: 'barkley-shut-up-and-jam-super-nintendo',
    title: 'Barkley Shut Up and Jam!',
    summary: 'Accolade\'s Charles Barkley-licensed basketball game delivers playground two-on-two court action with physical play, signature moves, and the informal street-ball style the series title implies.',
  },
  {
    gameId: 'battle-clash-super-nintendo',
    title: 'Battle Clash',
    summary: 'Nintendo\'s Super Scope shooter pits a pilot against giant mechs in a first-person duel structure, using the light gun across a linear boss sequence where player precision determines the outcome.',
  },
  {
    gameId: 'aero-the-acro-bat-2-super-nintendo',
    title: 'Aero the Acro-Bat 2',
    summary: 'Sunsoft\'s sequel tightens the circus-themed platformer formula with refined level design and new enemy variety, building on the original\'s acrobatic bat mascot while retaining its early 90s genre identity.',
  },
  {
    gameId: 'beavis-and-butt-head-super-nintendo',
    title: 'Beavis and Butt-Head',
    summary: 'Viacom\'s licensed SNES game follows the animated duo through side-scrolling stages as they attempt to reach a Gwar concert, adapting the show\'s crude humor into a platform structure.',
  },
  {
    gameId: 'bonkers-super-nintendo',
    title: 'Bonkers',
    summary: 'Capcom\'s Disney-licensed platformer features the cartoon cop cat across varied stage environments, delivering competent SNES action tied to the Bonkers animated series and its visual identity.',
  },
  {
    gameId: 'bomberman-panic-bomber-super-nintendo',
    title: 'Bomberman: Panic Bomber',
    summary: 'A falling-block puzzle game variant that uses Bomberman enemies and bombs instead of standard pieces, requiring strategic chain-explosion planning to clear the field and defeat staged opponents.',
  },
  {
    gameId: 'bram-stoker-s-dracula-super-nintendo',
    title: "Bram Stoker's Dracula",
    summary: 'Sony Imagesoft\'s SNES action game adapts the 1992 Coppola film, sending Jonathan Harker through Carpathian castle stages with a side-scrolling structure that captures the production\'s gothic atmosphere.',
  },
  {
    gameId: 'assault-suits-valken-2-super-nintendo',
    title: 'Assault Suits Valken 2',
    summary: 'Data West\'s Japan-only sequel to Cybernator expands the mech combat formula with new suit configurations and a multi-stage narrative continuing the original\'s politically charged military storyline.',
  },
  {
    gameId: 'biometal-super-nintendo',
    title: 'BioMetal',
    summary: 'Activision\'s horizontal shooter pairs a high-speed primary weapon with an orbiting combat satellite, delivering fast-paced 16-bit shoot-\'em-up challenge with a sci-fi biomechanical visual theme.',
  },
  {
    gameId: 'aaahh-real-monsters-super-nintendo',
    title: "Aaahh!!! Real Monsters",
    summary: 'Viacom\'s licensed SNES platformer follows Ickis, Oblina, and Krumm from the Nickelodeon cartoon through the human world, using each monster\'s powers in split-ability puzzle stages.',
  },
  {
    gameId: 'addams-family-values-super-nintendo',
    title: 'Addams Family Values',
    summary: 'Ocean\'s top-down action game adapts the film sequel with Pugsley navigating a dungeon-crawler structure through the Addams estate, offering a distinct play style from the prior SNES Addams entries.',
  },
  {
    gameId: 'bishojo-senshi-sailor-moon-another-story-super-nintendo',
    title: 'Bishōjo Senshi Sailor Moon: Another Story',
    summary: 'Angel\'s Japan-only SNES RPG sends the Sailor Guardians through a parallel original story with turn-based combat, offering a complete role-playing adventure purpose-built for the manga and anime fanbase.',
  },
  {
    gameId: 'arkanoid-doh-it-again-super-nintendo',
    title: 'Arkanoid: Doh It Again',
    summary: 'Taito\'s SNES-exclusive sequel expands the breakout formula with new power-ups and a two-player competitive mode, taking the franchise\'s ball-and-paddle mechanics beyond the arcade template.',
  },
  {
    gameId: 'bs-zelda-no-densetsu-super-nintendo',
    title: 'BS Zelda no Densetsu',
    summary: 'A Satellaview broadcast game using A Link to the Past\'s engine with altered overworld maps and dungeon content, originally streamed live with audio narration on the Japanese satellite radio service.',
  },
  {
    gameId: 'big-sky-trooper-super-nintendo',
    title: 'Big Sky Trooper',
    summary: 'JVC\'s SNES action RPG sends a space ranger on a planet-hopping campaign with overhead shooting, world exploration, and resource management in a lighthearted intergalactic setting.',
  },
  {
    gameId: 'battle-cars-super-nintendo',
    title: 'Battle Cars',
    summary: 'Namco\'s vehicular combat game pits armored cars against each other in enclosed arena tracks with weapon pickups, offering post-apocalyptic motorized warfare in an overhead perspective.',
  },
  {
    gameId: 'battle-dodgeball-ii-super-nintendo',
    title: 'Battle Dodgeball II',
    summary: 'Banpresto\'s Japan-only sequel intensifies the original\'s super-powered dodgeball format with robot and hero teams, delivering fierce team-based sports action with exaggerated attack animations.',
  },
  {
    gameId: '2020-super-baseball-super-nintendo',
    title: '2020 Super Baseball',
    summary: 'SNK\'s futuristic baseball game imagines the sport in 2020 with mechanically augmented players, power fields, and stadium hazards, delivering an arcade-style take on baseball with a sci-fi twist.',
  },
  {
    gameId: '90-minutes-european-prime-goal-super-nintendo',
    title: '90 Minutes European Prime Goal',
    summary: 'Jaleco\'s SNES football simulation features European national teams across tournament and league modes, offering an accessible top-down soccer experience with the international team roster of the mid-90s.',
  },
  // Genesis — next wave
  {
    gameId: 'abrams-battle-tank-sega-genesis',
    title: 'Abrams Battle Tank',
    summary: 'Electronic Arts\' military tank simulation places players in the M1 Abrams across desert combat missions, combining first-person turret operation with tactical mission structures inspired by the Gulf conflict era.',
  },
  {
    gameId: 'atomic-robo-kid-sega-genesis',
    title: 'Atomic Robo-Kid',
    summary: 'UPL\'s side-scrolling mech shooter features a compact robot fighting through multi-directional underground stages with weapon power-ups, porting the arcade\'s tight movement and collision mechanics to Genesis.',
  },
  {
    gameId: '688-attack-sub-sega-genesis',
    title: '688 Attack Sub',
    summary: 'Electronic Arts\' submarine simulation immerses players in Cold War undersea warfare with Los Angeles-class operations, sonar management, torpedo targeting, and mission-based tactical engagements.',
  },
  {
    gameId: 'arch-rivals-sega-genesis',
    title: 'Arch Rivals',
    summary: 'Midway\'s arcade basketball parody delivers rough two-on-two court action with body-checking, rulebreaking, and comedic animations in a chaotic street-ball style that anticipates the genre\'s playground era.',
  },
  {
    gameId: 'arnold-palmer-tournament-golf-sega-genesis',
    title: 'Arnold Palmer Tournament Golf',
    summary: 'Sega\'s golf simulation features Palmer\'s licensing across detailed course layouts, wind mechanics, and a stroke-play mode, helping establish the sport\'s simulation template on the Genesis platform.',
  },
  {
    gameId: 'battle-squadron-sega-genesis',
    title: 'Battle Squadron',
    summary: 'Innerprise\'s vertical shooter places combat in tight underground corridors with two-player co-op and a score-chaining system, porting the Amiga original to Genesis with the franchise\'s claustrophobic tension intact.',
  },
  {
    gameId: 'blockout-sega-genesis',
    title: 'Blockout',
    summary: 'Technos\'s 3D Tetris variant drops three-dimensional block shapes into a depth pit, requiring players to orient pieces across two and three axes before clearing the base layer of the playing field.',
  },
  {
    gameId: 'caliber-50-sega-genesis',
    title: 'Caliber .50',
    summary: 'Sega\'s top-down military action game drops soldiers into enemy-held territory with gun-based combat and destructible scenery, channeling the arcade original\'s war-movie tone and commando mission structure.',
  },
  {
    gameId: 'air-buster-sega-genesis',
    title: 'Air Buster',
    summary: 'Kaneko\'s horizontal shooter delivers dense formation patterns and escalating enemy waves, porting the arcade\'s high-energy shoot-\'em-up challenge with power-up chaining and two-player co-op to Genesis.',
  },
  {
    gameId: 'air-diver-sega-genesis',
    title: 'Air Diver',
    summary: 'Asuka & Asuka\'s flight game puts players in a jet fighter on free-scrolling dogfight and bombing missions, offering accessible aerial combat with a mission structure less demanding than contemporary flight sims.',
  },
  {
    gameId: 'back-to-the-future-part-iii-sega-genesis',
    title: 'Back to the Future Part III',
    summary: 'A Probe Software-developed Genesis action game adapting the Old West chapter of the film trilogy, sending Marty through side-scrolling and vehicle stages based on the movie\'s final chapter.',
  },
  {
    gameId: 'bahamut-senki-sega-genesis',
    title: 'Bahamut Senki',
    summary: 'Sega\'s Japan-only turn-based strategy game places dragon-riding generals across a fantasy continent in slow, methodical hex-grid campaigns with an early-access army progression system.',
  },
  {
    gameId: 'batman-return-of-the-joker-sega-genesis',
    title: 'Batman: Return of the Joker',
    summary: 'Sunsoft\'s Genesis action game returns Batman to a linear platformer format, using the technical muscle that made the Sunsoft NES Batman notable to deliver an expressive 16-bit presentation.',
  },
  {
    gameId: 'beast-wrestler-sega-genesis',
    title: 'Beast Wrestler',
    summary: 'Renovation\'s Genesis monster-wrestling game pits player-controlled creatures against each other in a grappling system, combining fighter mechanics with collectible monster progression across tournament brackets.',
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
          notes = 'G2 summary batch 8'
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
      'G2 summary batch 8'
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
    ) VALUES (?, 'g2_summary_batch_8', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 8 — SNES/Genesis wave 2')

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
  const runKey = `g2-summary-batch-8-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 8 applied locally on staging sqlite',
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
