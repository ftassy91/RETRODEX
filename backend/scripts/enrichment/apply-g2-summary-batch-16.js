#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Sega Saturn — wave 1
  {
    gameId: 'battle-garegga-sega-saturn',
    title: 'Battle Garegga',
    summary: 'Raizing\'s 1996 Saturn port of the vertical arcade shoot-\'em-up introduces the rank system that secretly raises difficulty based on player performance, establishing a foundational bullet-hell mechanic and a scoring meta built around deliberate power-down strategies.',
  },
  {
    gameId: 'bulk-slash-sega-saturn',
    title: 'Bulk Slash',
    summary: 'Hudson\'s Japan-only Saturn third-person mecha shooter places a transforming robot through city rescue missions where civilian-saving count determines route progression, blending aerial combat with a branching structure driven by performance score.',
  },
  {
    gameId: 'baroque-sega-saturn',
    title: 'Baroque',
    summary: 'Sting\'s Japan-only Saturn roguelike dungeon crawler places an amnesiac protagonist through an ever-changing tower to reach the Archangel at its summit, with a cryptic narrative revealed piecemeal through death and rebirth cycles.',
  },
  {
    gameId: 'atelier-marie-the-alchemist-of-salburg-sega-saturn',
    title: 'Atelier Marie: The Alchemist of Salburg',
    summary: 'Gust\'s Saturn debut launches the long-running Atelier franchise with a five-year time-limit structure in which an alchemy student gathers ingredients, crafts items, and completes commissions in a low-stakes life-simulation RPG format.',
  },
  {
    gameId: 'cotton-2-magical-night-dreams-sega-saturn',
    title: 'Cotton 2: Magical Night Dreams',
    summary: 'Success\'s Japan-only Saturn horizontal shooter is the third entry in the witch-and-fairy shooter series, featuring a tag team mechanic that swaps between Cotton and Silk mid-battle and a scoring system built around candy collection.',
  },
  {
    gameId: 'cleopatra-fortune-sega-saturn',
    title: 'Cleopatra Fortune',
    summary: 'Taito\'s Saturn puzzle game falls blocks into a well in an Egyptian-themed structure where enclosing mummies and sarcophagi in complete rectangles clears them, delivering an original falling-block formula with a distinct match-enclosure mechanic.',
  },
  {
    gameId: 'blazing-dragons-sega-saturn',
    title: 'Blazing Dragons',
    summary: 'Crystal Dynamics\'s Saturn point-and-click adventure inverts the classic dragon-slaying narrative by casting dragon knights defending a medieval kingdom from human oppressors, written by Terry Jones of Monty Python with absurdist cartoon humor.',
  },
  {
    gameId: 'croc-legend-of-the-gobbos-sega-saturn',
    title: 'Croc: Legend of the Gobbos',
    summary: 'Argonaut\'s Saturn 3D platformer follows a crocodile rescuing the Gobbos from Baron Dante across varied island worlds, notable as the game originally pitched to Nintendo that became Super Mario 64\'s closest Saturn-era competitor.',
  },
  {
    gameId: 'd-sega-saturn',
    title: 'D',
    summary: 'Warp\'s Saturn FMV horror adventure follows a woman investigating her father\'s hospital massacre through a surreal first-person journey, designed with a two-hour real-time play limit and no save points to heighten its cinematic tension.',
  },
  {
    gameId: 'crusader-no-remorse-sega-saturn',
    title: 'Crusader: No Remorse',
    summary: 'Origin Systems\'s Saturn port of the PC isometric action game places a renegade soldier against a dystopian corporate government, delivering destructible environments and tactical cover-based combat in a science-fiction rebellion narrative.',
  },
  {
    gameId: 'crypt-killer-sega-saturn',
    title: 'Crypt Killer',
    summary: 'Konami\'s Saturn port of the 1995 arcade light-gun shooter sends players through monster-filled corridors across Egyptian, jungle, and gothic environments in an on-rails shooting gallery with branching stage paths.',
  },
  {
    gameId: 'amok-sega-saturn',
    title: 'Amok',
    summary: 'Kalisto\'s Saturn mech shooter places a walker tank through open-arena combat missions with fully rotatable turret controls, delivering a rare fully-3D arena mech experience on the Saturn in a technically ambitious but commercially overlooked release.',
  },
  {
    gameId: 'assault-rigs-sega-saturn',
    title: 'Assault Rigs',
    summary: 'Psygnosis\'s Saturn tank combat game places armored vehicles through enclosed arena stages collecting power sources while battling enemy rigs, offering a fast top-down perspective with vehicle upgrade progression across a mission campaign.',
  },
  {
    gameId: 'asuka-120-limited-burning-fest-sega-saturn',
    title: 'Asuka 120% Limited BURNING Fest.',
    summary: 'Fill-in-Café\'s Japan-only Saturn fighter pits a roster of high school club members against each other in fast 2D combat, the fifth entry in a series popular in Japanese arcades and notable for its schoolgirl fighter aesthetic.',
  },
  {
    gameId: 'black-matrix-sega-saturn',
    title: 'Black/Matrix',
    summary: 'Flight-Plan\'s Japan-only Saturn tactical RPG tells a dark gothic narrative of angels and demons through grid-based strategy battles, earning a cult reputation for its transgressive religious imagery and brooding narrative tone.',
  },
  {
    gameId: 'capcom-generation-2-sega-saturn',
    title: 'Capcom Generation 2',
    summary: 'Capcom\'s Japan-only Saturn compilation collects the 1942, 1943, and 1943 Kai vertical shooters in a historical arcade anthology format, preserving the World War II aerial combat series alongside game history documentation.',
  },
  {
    gameId: 'civilization-sega-saturn',
    title: 'Civilization',
    summary: 'MPS Labs\'s Saturn port of Sid Meier\'s foundational 4X strategy game adapts the civilization-building from ancient era to space age on console with simplified interface adjustments, making the genre-defining PC title accessible to living-room play.',
  },
  {
    gameId: 'chaos-control-sega-saturn',
    title: 'Chaos Control',
    summary: 'Infogrames\'s Saturn space shooter presents its combat through QuickTime-style FMV sequences in an alien invasion narrative, blending pre-rendered cutscene footage with reactive shooting segments in a cinematic structure common to early CD-era games.',
  },
  {
    gameId: 'courier-crisis-sega-saturn',
    title: 'Courier Crisis',
    summary: 'GT Interactive\'s Saturn urban delivery game tasks players with racing a bicycle across city districts to deliver packages within time limits, offering an early example of the courier racing format later popularized by Crazy Taxi.',
  },
  {
    gameId: 'cyber-speedway-sega-saturn',
    title: 'Cyber Speedway',
    summary: 'Sega\'s Japan-only Saturn futuristic racing game features enclosed tube circuits with boost mechanics in a high-speed format, released as Gran Chaser in Japan and representing Sega\'s early attempt at a Saturn-native sci-fi racer.',
  },
  {
    gameId: '3d-lemmings-sega-saturn',
    title: '3D Lemmings',
    summary: 'Psygnosis\'s Saturn entry shifts the lemming-guiding puzzle franchise from its classic 2D side-view into three-dimensional stage structures, maintaining the assign-abilities-before-time-runs-out puzzle loop in a perspective change that divided longtime fans.',
  },
  {
    gameId: 'andretti-racing-sega-saturn',
    title: 'Andretti Racing',
    summary: 'Electronic Arts\'s Saturn licensed racing game features the IndyCar and NASCAR circuits under Mario Andretti\'s brand, offering a mid-tier simulation alternative at a time when the Saturn\'s racing library was building against PlayStation\'s Ridge Racer dominance.',
  },
  {
    gameId: 'black-dawn-sega-saturn',
    title: 'Black Dawn',
    summary: 'Virgin Interactive\'s Saturn military helicopter combat game places a gunship through covert missions across jungle and desert environments, delivering a cockpit-view action sim in the tradition of Strike-series games with atmospheric low-altitude flying.',
  },
  {
    gameId: 'blam-machinehead-sega-saturn',
    title: 'Blam! Machinehead',
    summary: 'Core Design\'s Saturn first-person mech shooter presents combat through a hovering war machine perspective across open city environments, set in a cyberpunk world where a rogue AI has taken control of military hardware.',
  },
  {
    gameId: 'battle-monsters-sega-saturn',
    title: 'Battle Monsters',
    summary: 'Naxat Soft\'s Japan-only Saturn 3D fighting game features grotesque monster characters including werewolves, mummies, and demons in a weapons-based combat system, targeting the horror aesthetic of Primal Rage in a more obscure Saturn-exclusive format.',
  },
  {
    gameId: 'bug-too-sega-saturn',
    title: 'Bug Too!',
    summary: 'Sega\'s Saturn 3D platformer sequel sends Bug the insect through new stage environments with additional moves and a split gameplay path between Bug and his companion Maggot, following up on the first game\'s technical showcase role for early Saturn 3D.',
  },
  {
    gameId: 'castle-of-illusion-starring-mickey-mouse-sega-saturn',
    title: 'Castle of Illusion Starring Mickey Mouse',
    summary: 'Sega\'s Saturn port of the classic Genesis platformer brings Mickey\'s apple-throwing witch-castle adventure to the platform with enhanced visuals, preserving the tight platformer design of the 1990 original for a new hardware generation.',
  },
  {
    gameId: 'angel-devoid-face-of-the-enemy-sega-saturn',
    title: 'Angel Devoid: Face of the Enemy',
    summary: 'Mindscape\'s Saturn FMV cyberpunk thriller casts the player as an enforcer in a dystopian city investigating a series of murders through branching live-action footage, a late-era FMV game arriving as the genre was fading from commercial prominence.',
  },
  {
    gameId: 'battlesport-sega-saturn',
    title: 'BattleSport',
    summary: 'Accolade\'s Saturn futuristic sports game pits armored vehicles in an arena ball sport somewhere between basketball and combat, delivering fast vehicular competition through enclosed stadium environments with weapon pickups.',
  },
  {
    gameId: 'commando-sega-saturn',
    title: 'Commando',
    summary: 'Capcom\'s Saturn port of the 1985 arcade vertical shooter brings the Super Joe run-and-gun formula to the platform in a direct arcade conversion, one of several Capcom Saturn compilations preserving the company\'s mid-80s coin-op catalogue.',
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
          notes = 'G2 summary batch 16'
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
      'G2 summary batch 16'
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
    ) VALUES (?, 'g2_summary_batch_16', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 16 — Sega Saturn wave 1')

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
  const runKey = `g2-summary-batch-16-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 16 applied locally on staging sqlite',
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
