#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // SNES — score 100 + strong editorial candidates
  {
    gameId: 'street-fighter-ii-turbo-super-nintendo',
    title: 'Street Fighter II Turbo: Hyper Fighting',
    summary: 'Capcom\'s essential SNES update adds the four Grand Masters as playable fighters and adjustable speed settings, sharpening the competitive mechanics that defined Street Fighter II as a cultural force.',
  },
  {
    gameId: 'bs-the-legend-of-zelda-ancient-stone-tablets-super-nintendo',
    title: 'BS The Legend of Zelda: Ancient Stone Tablets',
    summary: 'A Satellaview broadcast RPG built on the Link to the Past engine, featuring four new dungeons and a live narration track exclusive to the BS-X service, now inaccessible to most players outside Japan.',
  },
  {
    gameId: 'actraiser-super-nintendo',
    title: 'ActRaiser',
    summary: 'Quintet\'s hybrid game alternates side-scrolling action stages with a top-down god-game city builder, united by Yuzo Koshiro\'s acclaimed orchestral score and one of the SNES\'s most original launch identities.',
  },
  {
    gameId: 'another-world-super-nintendo',
    title: 'Another World',
    summary: 'Eric Chahi\'s rotoscoped sci-fi adventure tells a wordless alien-world story through fluid animation and environmental logic, redefining cinematic presentation in games with a precision-platformer structure.',
  },
  {
    gameId: 'axelay-super-nintendo',
    title: 'Axelay',
    summary: 'Konami\'s shooter alternates horizontal and vertical scrolling across six densely packed stages, showcasing Mode 7 effects and a synthesized score that became a benchmark for SNES audio design.',
  },
  {
    gameId: 'actraiser-2-super-nintendo',
    title: 'ActRaiser 2',
    summary: 'Quintet\'s follow-up strips out the god-game city builder for a focused action platformer, expanding combat depth and stage length while taking a darker narrative tone than the original.',
  },
  {
    gameId: 'alien-3-super-nintendo',
    title: 'Alien 3',
    summary: 'Probe Software\'s licensed action game tasks Ripley with rescuing prisoners and hunting xenomorphs across mission-based side-scrolling stages, offering a structure distinct from the film it loosely adapts.',
  },
  {
    gameId: 'alien-vs-predator-super-nintendo',
    title: 'Alien vs. Predator',
    summary: 'Capcom\'s side-scrolling brawler offers three playable characters fighting through xenomorph and hunter waves, translating the franchise rivalry into disciplined arcade combat on the SNES.',
  },
  {
    gameId: 'aero-fighters-super-nintendo',
    title: 'Aero Fighters',
    summary: 'A fast vertical shooter with a roster of international fighter pilots each boasting distinct special attacks, adapted from the arcade with two-player co-op and an eccentric cast that became the series\' trademark.',
  },
  {
    gameId: 'arcana-super-nintendo',
    title: 'Arcana',
    summary: 'HAL Laboratory\'s card-driven dungeon RPG presents first-person exploration and deck-based battles as an early SNES RPG, offering a dense if opaque role-playing challenge with an original fantasy setting.',
  },
  {
    gameId: 'arkanoid-super-nintendo',
    title: 'Arkanoid',
    summary: 'Taito\'s breakout classic reaches the SNES with its power-up bricks, multi-stage progression, and boss encounters intact, preserving the arcade formula that elevated the paddle game genre.',
  },
  {
    gameId: 'alcahest-super-nintendo',
    title: 'Alcahest',
    summary: 'HAL Laboratory\'s kinetic action RPG features real-time combat built around elemental guardian partners, offering short but intense dungeon stages that reward mastery of cooperative guardian abilities.',
  },
  {
    gameId: 'albert-odyssey-super-nintendo',
    title: 'Albert Odyssey',
    summary: 'Sunsoft\'s Japan-only strategy RPG builds a full-featured grid-based tactical campaign around a coming-of-age story, offering a polished alternative to the SNES strategy RPG canon seldom seen in the West.',
  },
  {
    gameId: 'animaniacs-super-nintendo',
    title: 'Animaniacs',
    summary: 'Konami\'s licensed SNES platformer adapts the Warner Bros. cartoon with rotating stage sets for Yakko, Wakko, and Dot, offering multi-character action grounded in the show\'s comedic visual language.',
  },
  {
    gameId: 'ardy-lightfoot-super-nintendo',
    title: 'Ardy Lightfoot',
    summary: 'ASCII\'s platform adventure follows a fox with a caterpillar companion through brightly designed stages, combining conventional jumping mechanics with a light co-op puzzle layer built around the partner system.',
  },
  {
    gameId: 'asterix-super-nintendo',
    title: 'Asterix',
    summary: 'Infogrames\' side-scrolling action game sends the Gaulish warrior through Roman-occupied stages in a licensed platformer that faithfully channels Goscinny and Uderzo\'s comic world through punchy brawling.',
  },
  {
    gameId: 'asterix-obelix-super-nintendo',
    title: 'Asterix & Obelix',
    summary: 'Infogrames\' sequel improves on the original by adding simultaneous co-op for both Gaulish heroes, denser enemy encounters, and more elaborate comic set pieces across a wider tour of the Roman Empire.',
  },
  {
    gameId: 'batman-returns-super-nintendo',
    title: 'Batman Returns',
    summary: 'Konami\'s moody platformer captures Tim Burton\'s gothic Gotham as Batman brawls through circus thugs, mixing side-scrolling action with Batmobile sections and rooftop grapple sequences.',
  },
  {
    gameId: 'batman-the-animated-series-super-nintendo',
    title: 'Batman: The Animated Series',
    summary: 'Konami adapts the Bruce Timm animated series with stylized visuals that echo its noir art direction, mixing brawling with gadget-based stage puzzles across Gotham\'s signature environment.',
  },
  {
    gameId: 'batman-forever-super-nintendo',
    title: 'Batman Forever',
    summary: 'Acclaim\'s digitized-sprite brawler adapts the Schumacher film with two-player superhero combat through dark Gotham environments, prioritizing visual spectacle over the mechanical depth of its SNES contemporaries.',
  },
  {
    gameId: 'battletoads-in-battlemaniacs-super-nintendo',
    title: 'Battletoads in Battlemaniacs',
    summary: 'Rare\'s SNES exclusive delivers the franchise\'s punishing combat and sprite-scaling showpiece stages in a shorter set purpose-built for the platform, maintaining the series\' notorious difficulty in two-player co-op.',
  },
  {
    gameId: 'battletoads-double-dragon-super-nintendo',
    title: 'Battletoads & Double Dragon',
    summary: 'A franchise crossover that unites both brawling rosters against a shared alien invasion, combining vehicle stages and two-player action into a genre hybrid that bridges both series\' distinct combat systems.',
  },
  {
    gameId: 'bahamut-lagoon-super-nintendo',
    title: 'Bahamut Lagoon',
    summary: 'Square\'s Japan-only tactical RPG commands dragon-mounted units across grid-based battlefields, weaving grand strategy and elemental dragon taming into a politically charged story of resistance and betrayal.',
  },
  {
    gameId: 'biker-mice-from-mars-super-nintendo',
    title: 'Biker Mice from Mars',
    summary: 'Based on the animated series, Konami\'s vehicular combat racer sends three alien bikers through obstacle-laden tracks with weapons, capturing the show\'s energetic tone in a kart-style combat format.',
  },
  {
    gameId: 'blackthorne-super-nintendo',
    title: 'Blackthorne',
    summary: 'Blizzard\'s cinematic platformer places a shotgun-wielding anti-hero in a dark alien world, emphasizing methodical cover-based combat and environmental puzzle-solving over purely reflexive action.',
  },
  {
    gameId: 'boogerman-a-pick-and-flick-adventure-super-nintendo',
    title: 'Boogerman: A Pick and Flick Adventure',
    summary: 'Interplay\'s gross-out platformer weaponizes bodily humor as mechanics, arming a superhero with projectile snot and belch attacks in a deliberate parody of early 90s mascot game excess.',
  },
  {
    gameId: 'brain-lord-super-nintendo',
    title: 'Brain Lord',
    summary: 'Enix\'s action RPG guides a young warrior through layered dungeons with a fairy companion that restores health and flags hidden rooms, offering a solid mid-tier SNES adventure RPG experience.',
  },
  {
    gameId: 'brandish-super-nintendo',
    title: 'Brandish',
    summary: 'Falcom\'s dungeon crawler rotates the environment around a fixed player rather than moving the camera, creating a disorienting navigational challenge that rewards spatial awareness in its tower-descending structure.',
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
          notes = 'G2 summary batch 5'
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
      'G2 summary batch 5'
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
    ) VALUES (?, 'g2_summary_batch_5', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 5 — SNES priority missing summaries')

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
  const runKey = `g2-summary-batch-5-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 5 applied locally on staging sqlite',
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
