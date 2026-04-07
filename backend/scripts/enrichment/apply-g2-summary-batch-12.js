#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Nintendo 64 — wave 2
  {
    gameId: '40-winks-nintendo-64',
    title: '40 Winks',
    summary: 'Eurocom\'s N64 platformer follows twins Ruff and Tumble chasing the villain Nitekap through dream worlds built from children\'s nightmares, offering a colorful collect-a-thon with a late European release that missed the North American market.',
  },
  {
    gameId: 'a-bug-s-life-nintendo-64',
    title: "A Bug's Life",
    summary: 'Traveller\'s Tales\' N64 adaptation of the Disney-Pixar film follows Flik through insect-scale third-person platforming missions, translating the colony narrative into a collectible-based structure across varied outdoor environments.',
  },
  {
    gameId: 'aerogauge-nintendo-64',
    title: 'AeroGauge',
    summary: 'Rocket Science Games\' N64 anti-gravity racer features a small roster of futuristic craft across elevated track circuits, distinguishing itself from F-Zero 64 with a boost-management system and a distinct visual aesthetic.',
  },
  {
    gameId: 'armorines-project-s-w-a-r-m-nintendo-64',
    title: 'Armorines: Project S.W.A.R.M.',
    summary: 'Acclaim\'s N64 first-person shooter adapts the Valiant Comics property into an alien-bug invasion narrative, offering two-player split-screen co-op through military environments in a conventional GoldenEye-era FPS structure.',
  },
  {
    gameId: 'army-men-sarge-s-heroes-nintendo-64',
    title: "Army Men: Sarge's Heroes",
    summary: '3DO\'s N64 third-person shooter translates plastic toy soldiers into a 3D action game, sending Sarge through mundane household environments at miniature scale in a concept more inventive than its execution delivered.',
  },
  {
    gameId: 'army-men-sarge-s-heroes-2-nintendo-64',
    title: "Army Men: Sarge's Heroes 2",
    summary: '3DO\'s N64 sequel revisits the plastic soldier universe with additional weapons and stages, maintaining the household-scale environments of the original while attempting to address its predecessor\'s technical shortcomings.',
  },
  {
    gameId: 'asteroids-hyper-64-nintendo-64',
    title: 'Asteroids Hyper 64',
    summary: 'Activision\'s N64 update brings the arcade classic into three dimensions with a free-roaming cockpit view, adding power-ups and boss encounters across sector-based stages while preserving the core asteroid-clearing loop.',
  },
  {
    gameId: 'automobili-lamborghini-nintendo-64',
    title: 'Automobili Lamborghini',
    summary: 'Titus Software\'s officially licensed N64 racing game places Lamborghini\'s supercar lineup on open circuit tracks, offering a mid-tier racing experience notable mainly for its Lamborghini brand roster and N64 launch window timing.',
  },
  {
    gameId: 'battlezone-rise-of-the-black-dogs-nintendo-64',
    title: 'Battlezone: Rise of the Black Dogs',
    summary: 'Majesco\'s N64 port of Activision\'s PC first-person tank strategy game adapts its Cold War sci-fi setting and hybrid action-RTS mechanics to the console, a technically ambitious port of an acclaimed PC title.',
  },
  {
    gameId: 'bio-f-r-e-a-k-s-nintendo-64',
    title: 'Bio F.R.E.A.K.S.',
    summary: 'Midway\'s N64 and PS1 3D fighting game features biomechanically enhanced soldiers in an airborne arena combat system, distinguishing itself from contemporaries with flight mechanics that add a vertical dimension to matches.',
  },
  {
    gameId: 'blues-brothers-2000-nintendo-64',
    title: 'Blues Brothers 2000',
    summary: 'Titus Software\'s N64 platformer tie-in to the 1998 film sequel sends Jake and Elwood through music-themed stages collecting musical notes, adapting the film\'s blues premise into a conventional 3D platformer structure.',
  },
  {
    gameId: 'california-speed-nintendo-64',
    title: 'California Speed',
    summary: 'Midway\'s N64 port of the 1996 arcade racer offers high-speed driving across California-themed circuits, prioritizing accessible arcade momentum over simulation fidelity in a port of the coin-op original.',
  },
  {
    gameId: 'carmageddon-ii-carpocalypse-now-nintendo-64',
    title: 'Carmageddon II: Carpocalypse Now',
    summary: 'Titus Software\'s N64 port of Stainless Games\' controversial vehicular combat sequel delivers pedestrian-targeting racing across open urban environments, toned down from the PC version for console release.',
  },
  {
    gameId: 'chameleon-twist-2-nintendo-64',
    title: 'Chameleon Twist 2',
    summary: 'Japan Art Media\'s N64 sequel refines the tongue-based traversal mechanics of the original with new worlds and an improved level structure, building on the first game\'s core hook-grip-catapult platformer design.',
  },
  {
    gameId: 'clayfighter-63-nintendo-64',
    title: 'ClayFighter 63⅓',
    summary: 'Interplay\'s N64 stop-motion fighting game uses claymation-style character animations across a parody roster of pop culture archetypes, prioritizing its distinctive visual identity over competitive depth in the era\'s fighting game landscape.',
  },
  {
    gameId: 'cruis-n-usa-nintendo-64',
    title: "Cruis'n USA",
    summary: 'Midway\'s arcade-to-N64 port of the 1994 coin-op racer crosses the country on a coast-to-coast route through American landmarks, offering the simplest possible racing loop as one of the N64\'s early launch-era titles.',
  },
  {
    gameId: 'cruis-n-exotica-nintendo-64',
    title: "Cruis'n Exotica",
    summary: 'Midway\'s third N64 Cruis\'n entry trades American roads for exotic international and fantastical settings, maintaining the franchise\'s accessible arcade momentum while extending its global track set to surreal destinations.',
  },
  {
    gameId: 'daikatana-nintendo-64',
    title: 'Daikatana',
    summary: 'John Romero\'s infamously troubled N64 FPS adaptation sends a time-traveling warrior through four historical eras with AI companions, arriving to near-universal criticism after a prolonged development cycle that became an industry cautionary tale.',
  },
  {
    gameId: 'dark-rift-nintendo-64',
    title: 'Dark Rift',
    summary: 'Vic Tokai\'s N64 3D fighting game features a sci-fi roster competing over an ancient relic, offering a mid-tier polygon fighter with modest mechanical ambition in a platform era dominated by Mortal Kombat Trilogy and Killer Instinct Gold.',
  },
  {
    gameId: 'destruction-derby-64-nintendo-64',
    title: 'Destruction Derby 64',
    summary: 'Boss Game Studios\' N64 extension of the PlayStation demolition derby series adds new modes and a four-player split-screen option, translating the arena smash-up formula to the N64 with competent if unspectacular results.',
  },
  {
    gameId: 'disney-s-tarzan-nintendo-64',
    title: "Disney's Tarzan",
    summary: 'Ubisoft\'s N64 adaptation of the 1999 Disney film places Tarzan in 3D jungle environments using vine-swinging traversal, presenting the ape man\'s arboreal movement as a platformer mechanic across a mission-based structure.',
  },
  {
    gameId: 'donald-duck-goin-quackers-nintendo-64',
    title: "Donald Duck: Goin' Quackers",
    summary: 'Ubisoft\'s N64 platformer sends Donald through TV-studio themed worlds to rescue Daisy from Merlock, delivering a conventional 3D collect-a-thon with the character\'s established animation identity in an accessible licensed structure.',
  },
  {
    gameId: 'chopper-attack-nintendo-64',
    title: 'Chopper Attack',
    summary: 'Jaleco\'s N64 helicopter action game delivers arcade-style third-person aerial combat through military environments, offering a simple shooting formula as a budget-tier alternative to the platform\'s larger action releases.',
  },
  // PlayStation — wave 3
  {
    gameId: 'aconcagua-playstation',
    title: 'Aconcagua',
    summary: 'Sony\'s Japan-only PS1 adventure game is a cinematic survival story following plane-crash victims descending the Andes, featuring command-based gameplay that prioritizes choice and group dynamics over action.',
  },
  {
    gameId: 'alfred-chicken-playstation',
    title: 'Alfred Chicken',
    summary: 'Mindscape\'s PS1 port of the Amiga and NES platformer brings Alfred\'s beak-based stage-clearing puzzles to the PlayStation, adapting its compact platformer design for a later-era port of a game originally released years earlier.',
  },
  {
    gameId: 'alien-resurrection-playstation',
    title: 'Alien Resurrection',
    summary: 'Argonaut\'s PS1 adaptation of the fourth Alien film delivers claustrophobic first-person shooting through the Auriga\'s corridors, notable for an inverted dual-analog control scheme that preceded broad mainstream adoption of the layout.',
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
          notes = 'G2 summary batch 12'
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
      'G2 summary batch 12'
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
    ) VALUES (?, 'g2_summary_batch_12', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 12 — N64 wave 2, PS1 wave 3, Saturn wave 3')

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
  const runKey = `g2-summary-batch-12-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 12 applied locally on staging sqlite',
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
