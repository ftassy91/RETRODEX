#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Nintendo 64 — high-priority missing
  {
    gameId: 'donkey-kong-64-nintendo-64',
    title: 'Donkey Kong 64',
    summary: 'Rare\'s massive N64 platformer expands the collect-a-thon formula of Banjo-Kazooie to five playable Kongs across sprawling interconnected worlds, pushing the expansion pak hardware and anchoring its era\'s completionist design.',
  },
  {
    gameId: 'conker-s-bad-fur-day-nintendo-64',
    title: "Conker's Bad Fur Day",
    summary: 'Rare\'s mature N64 platformer weaponizes parody and adult humor against the genre\'s own conventions, taking a foul-mouthed squirrel through movie-pastiche environments and a genre-aware narrative that became a cult touchstone.',
  },
  {
    gameId: 'doom-64-nintendo-64',
    title: 'Doom 64',
    summary: 'Midway\'s N64-exclusive entry developed by Midway Games is not a port but an original Doom experience with redesigned maps, a darker atmospheric tone, new monsters, and a synthesized ambient score by Aubrey Hodges.',
  },
  {
    gameId: 'bangai-o-nintendo-64',
    title: 'Bangai-O',
    summary: 'Treasure\'s Japan-only N64 mech shooter fills every screen with hundreds of homing missiles in a tension-based system where absorbing fire charges a devastating omnidirectional counterattack across compact puzzle-action stages.',
  },
  {
    gameId: 'beetle-adventure-racing-nintendo-64',
    title: 'Beetle Adventure Racing!',
    summary: 'Electronic Arts\' N64 racer built exclusively around the Volkswagen New Beetle features expansive tracks with hidden shortcuts and collectible tokens, earning a cult reputation for its unusually polished open track design.',
  },
  {
    gameId: 'custom-robo-nintendo-64',
    title: 'Custom Robo',
    summary: 'Noise\'s Japan-only N64 action RPG lets players assemble miniature arena robots from interchangeable parts for three-dimensional capsule battles, establishing a customization loop that anchored the franchise\'s portable sequels.',
  },
  {
    gameId: 'custom-robo-v2-nintendo-64',
    title: 'Custom Robo V2',
    summary: 'Noise\'s Japan-only N64 sequel expands the robot parts roster and arena options of the original, deepening the assembly-and-battle loop before the series transitioned to the Game Boy Advance.',
  },
  {
    gameId: 'aidyn-chronicles-the-first-mage-nintendo-64',
    title: 'Aidyn Chronicles: The First Mage',
    summary: 'H2O Entertainment\'s N64 RPG offers a sprawling party-based fantasy campaign with real-time clock-driven combat and a dense dialogue system, representing one of the platform\'s most ambitious role-playing attempts.',
  },
  {
    gameId: 'chameleon-twist-nintendo-64',
    title: 'Chameleon Twist',
    summary: 'Japan Art Media\'s N64 platformer uses a chameleon\'s extendable tongue as the primary traversal and combat tool, building puzzle-platformer stages around the tongue\'s reach, grip, and catapult mechanics.',
  },
  {
    gameId: 'battletanx-nintendo-64',
    title: 'BattleTanx',
    summary: '3DO\'s post-apocalyptic N64 tank game places armored vehicles through street-level urban combat with a story mode campaign and a four-player battle mode, building on the split-screen multiplayer tradition of the platform.',
  },
  {
    gameId: 'battletanx-global-assault-nintendo-64',
    title: 'BattleTanx: Global Assault',
    summary: '3DO\'s N64 sequel expands the tank combat franchise with new vehicles, a longer campaign with full voice acting, and refined four-player modes that strengthened the franchise\'s multiplayer reputation.',
  },
  {
    gameId: 'buck-bumble-nintendo-64',
    title: 'Buck Bumble',
    summary: 'Argonaut\'s N64 shooter puts players in control of a cybernetically enhanced bee defending Earth from an insect invasion, delivering aerial combat through terrestrial environments with a memorable drum-and-bass title theme.',
  },
  {
    gameId: 'aero-fighters-assault-nintendo-64',
    title: 'Aero Fighters Assault',
    summary: 'Paradigm Entertainment\'s N64 entry in the Video System shooter series adapts the franchise\'s pilot roster to a 3D mission-based format, following a global conflict across airborne and escort mission types.',
  },
  {
    gameId: 'doshin-the-giant-nintendo-64',
    title: 'Doshin the Giant',
    summary: 'Nintendo\'s Japan-only god game places a giant yellow being who grows by receiving love from island villagers, cycling between a helpful golden form and a destructive demon form in a contemplative god simulation.',
  },
  {
    gameId: 'doubutsu-no-mori-nintendo-64',
    title: 'Dōbutsu no Mori',
    summary: 'Nintendo\'s Japan-only N64 social simulation launched the Animal Crossing franchise with its real-time clock, seasonal events, and persistent village life, concepts that were refined for the international GameCube release.',
  },
  // PlayStation — wave 2
  {
    gameId: 'a-bug-s-life-playstation',
    title: "A Bug's Life",
    summary: 'Traveller\'s Tales\' PS1 adaptation of the Disney-Pixar film follows Flik through insect-scale third-person platforming stages, translating the film\'s colony narrative into a collectible-filled mission structure.',
  },
  {
    gameId: 'adidas-power-soccer-playstation',
    title: 'Adidas Power Soccer',
    summary: 'Psygnosis\' PS1 football game is notable as an early high-quality licensed soccer title on the platform, offering a fast arcade-oriented play style and the Adidas brand roster at a time when football simulation was finding its footing on PS1.',
  },
  {
    gameId: 'aerobiz-playstation',
    title: 'Aerobiz',
    summary: 'Koei\'s airline management simulation tasks players with building a global aviation network across post-war decades, balancing route development, fleet acquisition, and rival airlines in a complex strategy format.',
  },
  {
    gameId: '2xtreme-playstation',
    title: '2Xtreme',
    summary: 'Sony\'s PS1 extreme sports sequel expands on ESPN Extreme Games with additional disciplines including inline skating, mountain biking, street luge, and skateboarding across urban and mountain courses.',
  },
  {
    gameId: '3xtreme-playstation',
    title: '3Xtreme',
    summary: 'Sony\'s third entry in its extreme sports series refines the circuit-racing format of its predecessors across skateboarding, inline skating, snowboarding, and bike disciplines with updated roster and course options.',
  },
  // Sega Saturn — wave 2
  {
    gameId: 'batman-beyond-return-of-the-joker-nintendo-64',
    title: 'Batman Beyond: Return of the Joker',
    summary: 'Ubisoft\'s N64 beat-\'em-up adapts the animated film sequel with Terry McGinnis navigating side-scrolling combat in a futuristic Gotham, offering a different tone and protagonist from the classic Batman games on the platform.',
  },
  // SNES — wave 4
  {
    gameId: 'accele-brid-super-nintendo',
    title: 'Accele Brid',
    summary: 'Taito\'s Japan-only SNES action RPG centers on a transforming mecha hero navigating a sci-fi world in a hybrid of platformer stages and turn-based battles, drawing on the tokusatsu robot tradition in its structure.',
  },
  {
    gameId: 'appleseed-super-nintendo',
    title: 'Appleseed',
    summary: 'Gainax\'s Japan-only SNES action RPG adapts Masamune Shirow\'s cyberpunk manga with isometric combat, placing Deunan Knute in a futuristic conflict between humans and Bioroids in the walled city of Olympus.',
  },
  {
    gameId: 'aretha-super-nintendo',
    title: 'Aretha',
    summary: 'Japan Art Media\'s Japan-only SNES RPG is the first in a short series of traditional role-playing adventures featuring the eponymous heroine, built around a turn-based combat system and fantasy dungeon exploration.',
  },
  {
    gameId: 'aretha-ii-ariel-no-fushigi-na-tabi-super-nintendo',
    title: "Aretha II: Ariel no Fushigi na Tabi",
    summary: 'Japan Art Media\'s SNES RPG sequel follows Ariel on a new fantasy journey, expanding the first game\'s party-based combat with additional character options and a broader overworld in the tradition of 16-bit Japanese RPGs.',
  },
  {
    gameId: 'amazing-hebereke-super-nintendo',
    title: 'Amazing Hebereke',
    summary: 'Sunsoft\'s Japan-only SNES competitive arena game features characters from the Hebereke series in a four-player party format, offering minigame-style multiplayer rooted in the franchise\'s absurdist visual humor.',
  },
  {
    gameId: 'aoki-densetsu-shoot-super-nintendo',
    title: 'Aoki Densetsu Shoot!',
    summary: 'Tecmo\'s Japan-only SNES soccer game adapts the Tsuruta Youichi manga with a story mode following a school team\'s tournament journey, mixing narrative scenes with side-view pitch action in a sports manga presentation.',
  },
  // Genesis — wave 4
  {
    gameId: 'ball-jacks-sega-genesis',
    title: 'Ball Jacks',
    summary: 'Namco\'s Genesis adaptation of the arcade game is a competitive ball-bouncing puzzle game where two players knock colored balls off a board, offering a simple reflex-based format suited to two-player competition.',
  },
  {
    gameId: 'barney-s-hide-seek-game-sega-genesis',
    title: "Barney's Hide & Seek Game",
    summary: 'Sega\'s Genesis edutainment title targets the youngest players with a simplified hide-and-seek game built around the children\'s television character, prioritizing accessibility and basic spatial reasoning over challenge.',
  },
  {
    gameId: 'bass-masters-classic-sega-genesis',
    title: 'Bass Masters Classic',
    summary: 'Black Pearl Software\'s Genesis fishing simulation tasks players with entering bass fishing tournaments, managing lure selection, casting mechanics, and catch weight in a sportfishing format across seasonal lake conditions.',
  },
  {
    gameId: 'bass-masters-classic-pro-edition-sega-genesis',
    title: 'Bass Masters Classic: Pro Edition',
    summary: 'The expanded Genesis edition of the bass fishing simulation adds the licensed Bass Masters Classic tournament circuit with additional lures, seasonal conditions, and an extended roster of professional fishing venues.',
  },
  {
    gameId: 'battle-master-sega-genesis',
    title: 'Battle Master',
    summary: 'Quest Corporation\'s Genesis fantasy RPG blends top-down dungeon exploration with real-time one-on-one combat, building a hack-and-slash adventure around knight progression and equipment upgrades across a continent-spanning quest.',
  },
  {
    gameId: 'beggar-prince-sega-genesis',
    title: 'Beggar Prince',
    summary: 'Super Fighter Team\'s unlicensed 2006 Genesis RPG is a port of a 1996 Taiwanese PC game, following a royal prince exiled to a poverty-stricken existence in a traditional turn-based role-playing adventure.',
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
          notes = 'G2 summary batch 11'
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
      'G2 summary batch 11'
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
    ) VALUES (?, 'g2_summary_batch_11', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 11 — N64 priority, PS1 wave 2, Genesis/SNES wave 4')

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
  const runKey = `g2-summary-batch-11-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 11 applied locally on staging sqlite',
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
