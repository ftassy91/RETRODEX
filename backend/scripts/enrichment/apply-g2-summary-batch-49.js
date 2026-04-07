#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // PlayStation — notable wave 1 (25 games)
  {
    gameId: 'ape-escape-playstation',
    title: 'Ape Escape',
    summary: 'Sony\'s PlayStation action platformer was the first game designed to require the DualShock analog sticks, using both thumbsticks simultaneously to control gadgets for capturing escaped monkeys across elaborate 3D stages, establishing a design paradigm that influenced how Sony promoted the DualShock controller.',
  },
  {
    gameId: 'valkyrie-profile-playstation',
    title: 'Valkyrie Profile',
    summary: 'Tri-Ace\'s PlayStation RPG reimagines Norse mythology with Lenneth Valkyrie collecting the souls of fallen warriors for Ragnarok, blending a side-scrolling action battle system with a crystalline inventory of einherjar and a time-limited story structure that yields multiple endings based on which souls are sent to Asgard.',
  },
  {
    gameId: 'policenauts-playstation',
    title: 'Policenauts',
    summary: 'Hideo Kojima\'s cinematic PlayStation point-and-click adventure follows a cryogenically frozen cop awakened 25 years in the future to investigate his ex-wife\'s murder on a space colony, featuring detailed worldbuilding and shooting gallery sequences in a game long unavailable in English until a fan translation.',
  },
  {
    gameId: 'armored-core-playstation',
    title: 'Armored Core',
    summary: 'From Software\'s PlayStation mech action debut establishes the core Armored Core formula of assembling a custom bipedal mech from modular components and taking corporate contracts in a post-apocalyptic underground world, launching a franchise that would run for decades with the same deep customization philosophy.',
  },
  {
    gameId: 'armored-core-master-of-arena-playstation',
    title: 'Armored Core: Master of Arena',
    summary: 'From Software\'s third PlayStation Armored Core entry introduces a tournament-based arena structure alongside standard missions, refining the modular mech assembly system and adding an AI arena challenger roster for players who completed the main campaign.',
  },
  {
    gameId: 'armored-core-project-phantasma-playstation',
    title: 'Armored Core: Project Phantasma',
    summary: 'From Software\'s second Armored Core PlayStation title expands the mech customization system with new parts and the first arena mode, adding a narrative involving a mysterious AI installation and an expanded part catalog for the franchise\'s growing fanbase.',
  },
  {
    gameId: 'arc-the-lad-playstation',
    title: 'Arc the Lad',
    summary: 'G-Craft\'s PlayStation tactical RPG opens the Arc the Lad trilogy with a compact campaign serving more as a prologue than a standalone adventure, establishing the game\'s grid-based battle system and the conflict between the Yewbell tribe and the Romalia empire that drives the subsequent entries.',
  },
  {
    gameId: 'arc-the-lad-ii-playstation',
    title: 'Arc the Lad II',
    summary: 'G-Craft\'s PlayStation tactical RPG sequel substantially expands the Arc the Lad universe, merging the casts of both games for an epic-length campaign with over eighty hours of content and the Monster Collection side system, representing the trilogy\'s most ambitious and celebrated entry.',
  },
  {
    gameId: 'arc-the-lad-iii-playstation',
    title: 'Arc the Lad III',
    summary: 'Cattle Call\'s PlayStation conclusion to the Arc trilogy follows a new protagonist Alec in a post-series-one world, shifting the tactical RPG tone toward a more traditional RPG structure with active time battle elements and a narrative bridge between the original trilogy and its universe\'s future.',
  },
  {
    gameId: 'alundra-2-playstation',
    title: 'Alundra 2: A New Legend Begins',
    summary: 'Matrix Software\'s PlayStation action-RPG sequel replaces the original\'s dream-diving protagonist and Zelda-like exploration with a lighter steampunk adventure starring Flint, widely considered inferior to the dark original despite competent execution of its 3D action platformer formula.',
  },
  {
    gameId: 'aquanaut-s-holiday-playstation',
    title: 'Aquanaut\'s Holiday',
    summary: 'Artdink\'s PlayStation ambient exploration title places the player in a research submarine with no explicit objectives, simply navigating a vast underwater world to discover sea life and sunken structures in a meditative early example of non-goal-oriented interactive experience on the platform.',
  },
  {
    gameId: 'apocalypse-playstation',
    title: 'Apocalypse',
    summary: 'Neversoft\'s PlayStation third-person action shooter stars Bruce Willis in a game originally built around the actor\'s likeness, sending the protagonist through a cult leader\'s apocalyptic ritual sites with twin-stick-style shooting and explosive destruction across compressed but intense action stages.',
  },
  {
    gameId: 'area-51-playstation',
    title: 'Area 51',
    summary: 'Midway\'s PlayStation port of the arcade on-rails shooter puts players through a government facility overrun by mutant alien-hybrid soldiers, delivering the original 1995 arcade light-gun experience as a gamepad-controlled shooting gallery on Sony\'s home console.',
  },
  {
    gameId: 'arkanoid-returns-playstation',
    title: 'Arkanoid Returns',
    summary: 'Taito\'s PlayStation port of the 1997 arcade Arkanoid sequel delivers the brick-breaking paddle game with new block formations and power-ups in the established Arkanoid tradition, continuing the lineage of the 1986 original for home console audiences.',
  },
  {
    gameId: 'army-men-3d-playstation',
    title: 'Army Men 3D',
    summary: '3DO\'s PlayStation launch title for the Army Men franchise places green plastic toy soldiers in miniature-scale 3D environments against the tan army, establishing the franchise\'s toy soldier universe and third-person combat format that would generate a lengthy multi-platform series.',
  },
  {
    gameId: 'army-men-sarge-s-heroes-playstation',
    title: 'Army Men: Sarge\'s Heroes',
    summary: '3DO\'s PlayStation Army Men title introduces the Sarge character as the series\' named protagonist through a rescue mission format, expanding the franchise\'s toy soldier universe with a more action-focused campaign than earlier entries in the plastic army series.',
  },
  {
    gameId: 'army-men-air-attack-playstation',
    title: 'Army Men: Air Attack',
    summary: '3DO\'s PlayStation helicopter combat spin-off in the Army Men series sends Blade and his helicopter crew through aerial missions in the toy soldier universe, adding an air combat dimension to the plastic army franchise\'s expanding multi-game ecosystem.',
  },
  {
    gameId: 'animorphs-shattered-reality-playstation',
    title: 'Animorphs: Shattered Reality',
    summary: 'Ubi Soft\'s PlayStation 3D platformer based on K.A. Applegate\'s young adult science fiction series allows players to switch between human and animal forms to navigate stages, adapting the shape-shifting protagonists\' abilities into a licensed adventure for fans of the book franchise.',
  },
  {
    gameId: 'anna-kournikova-s-smash-court-tennis-playstation',
    title: 'Anna Kournikova\'s Smash Court Tennis',
    summary: 'Namco\'s PlayStation tennis simulation carries the Anna Kournikova endorsement in the Smash Court Tennis series, offering court competition with the WTA player\'s licensed appearance alongside a broader tennis roster in a competent mid-era PlayStation sports title.',
  },
  {
    gameId: 'anastasia-playstation',
    title: 'Anastasia',
    summary: 'Absolute Entertainment\'s PlayStation licensed game based on the 1997 Fox animated film follows the amnesiac princess Anya through adventure and puzzle stages based on the movie\'s Romanov-era narrative, targeting younger audiences with the animated film\'s characters.',
  },
  {
    gameId: 'another-mind-playstation',
    title: 'Another Mind',
    summary: 'Konami\'s Japan-only PlayStation adventure game follows Eiru, a telepath working with police to solve crimes using psychic vision, delivering a visual novel-style mystery with animated sequences and an emphasis on psychological and investigative narrative.',
  },
  {
    gameId: 'amerzone-playstation',
    title: 'Amerzone: The Explorer\'s Legacy',
    summary: 'Microids\' PlayStation point-and-click adventure from Benoît Sokal follows a journalist fulfilling a dying explorer\'s mission to return a bird\'s egg to its South American homeland, delivering lush illustrated environments in one of the era\'s more artistically distinctive adventure games.',
  },
  {
    gameId: 'alpine-racer-2-playstation',
    title: 'Alpine Racer 2',
    summary: 'Namco\'s PlayStation port of the 1996 arcade skiing game delivers downhill slalom and free-run modes with the motion-controlled arcade original translated to standard gamepad control, adapting the standing-arcade-cabinet ski simulation for home console play.',
  },
  {
    gameId: 'armorines-project-s-w-a-r-m-playstation',
    title: 'Armorines: Project S.W.A.R.M.',
    summary: 'Acclaim\'s PlayStation first-person shooter sends armored soldiers against an insect alien invasion across a variety of terrain environments, offering standard late-era PS1 FPS content in a licensed universe derived from the Valiant Comics Armorines title.',
  },
  {
    gameId: 'andretti-racing-playstation',
    title: 'Andretti Racing',
    summary: 'EA Sports\' PlayStation racing simulation carries the Mario Andretti endorsement and covers multiple racing disciplines including IndyCar, Formula 1, and drag racing under one title, offering genre variety alongside the licensed driver branding in an early multi-format racing collection.',
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
          notes = 'G2 summary batch 49'
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
      'G2 summary batch 49'
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
    ) VALUES (?, 'g2_summary_batch_49', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 49 — PlayStation notable wave 1')

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
  const runKey = `g2-summary-batch-49-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 49 applied locally on staging sqlite',
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
