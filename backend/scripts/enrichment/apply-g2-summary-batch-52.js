#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // PlayStation — remaining wave (30 games)
  {
    gameId: '98-koshien-playstation',
    title: '98 Koshien',
    summary: 'A Japan-only PlayStation high school baseball simulation tied to the prestigious Koshien stadium tournament, offering domestic Japanese players a management and strategy experience around the emotionally significant national high school baseball championship.',
  },
  {
    gameId: '99-koshien-playstation',
    title: '99 Koshien',
    summary: 'A Japan-only PlayStation sequel in the Koshien high school baseball management series, updating the tournament simulation for the 1999 season and continuing the domestic franchise centered on Japan\'s most celebrated amateur baseball competition.',
  },
  {
    gameId: '10-yard-fight-playstation',
    title: '10 Yard Fight',
    summary: 'Irem\'s PlayStation port of the classic 1983 arcade American football game delivers the original\'s simple three-down field goal gameplay in a home console format, preserving one of the earliest successful football video game licenses for PS1 audiences.',
  },
  {
    gameId: '100-manyen-quiz-hunter-playstation',
    title: '100 Manyen Quiz Hunter',
    summary: 'A Japan-only PlayStation quiz game built around a one-million-yen prize structure in the trivia format popular in late-1990s Japanese television, adapting the quiz show format with escalating difficulty and stakes for domestic Japanese players.',
  },
  {
    gameId: '101-dalmatians-ii-patch-s-london-adventure-playstation',
    title: '101 Dalmatians II: Patch\'s London Adventure',
    summary: 'Disney Interactive\'s PlayStation game based on the direct-to-video sequel follows Patch the Dalmatian puppy on a London adventure, adapting the animated film\'s stray-puppy narrative into a children\'s platformer for PS1 audiences.',
  },
  {
    gameId: '16-tales-playstation',
    title: '16 Tales',
    summary: 'A Japan-only PlayStation collection presenting sixteen short interactive story vignettes, offering a compact anthology of narrative-driven mini-adventures in the Japanese digital visual novel tradition of the PS1 era.',
  },
  {
    gameId: '1943-kai-midway-kaisen-playstation',
    title: '1943 Kai: Midway Kaisen',
    summary: 'Capcom\'s PlayStation port of the 1984 arcade World War II vertical shoot-\'em-up delivers the Pacific theater air combat classic with its stamina health bar and power-up system, preserving the foundational arcade shooter for home console audiences.',
  },
  {
    gameId: '2002-fifa-world-cup-playstation',
    title: '2002 FIFA World Cup',
    summary: 'EA Sports\' PlayStation coverage of the Korea/Japan World Cup delivers the official 2002 tournament bracket with licensed national squads on PS1 hardware, providing portable World Cup access alongside the more powerful PlayStation 2 version of the same title.',
  },
  {
    gameId: '2nd-super-robot-wars-playstation',
    title: '2nd Super Robot Wars',
    summary: 'Banpresto\'s Japan-only PlayStation remake of the second Super Robot Wars tactical RPG assembles classic super robot anime for grid-based strategic combat, updating the early Game Boy original with enhanced visuals and rearranged content for the PS1\'s domestic Japanese audience.',
  },
  {
    gameId: '360-three-sixty-playstation',
    title: '360: Three Sixty',
    summary: 'A Japan-only PlayStation action title placing players in 360-degree movement combat scenarios, representing the domestic Japanese PS1 library\'s varied output of action titles across the platform\'s commercial lifespan.',
  },
  {
    gameId: '3rd-super-robot-wars-playstation',
    title: '3rd Super Robot Wars',
    summary: 'Banpresto\'s Japan-only PlayStation remake of the third Super Robot Wars tactical RPG brings the Famicom original into the 32-bit era with enhanced visuals and updated strategic content, continuing the Japan-exclusive PS1 remake series of the franchise\'s foundational entries.',
  },
  {
    gameId: 'a-bug-s-life-games-workshop-playstation',
    title: 'A Bug\'s Life',
    summary: 'Disney Interactive\'s PlayStation platformer based on Pixar\'s 1998 animated film follows Flik the ant through insect-scale environments with the movie\'s characters, delivering a licensed children\'s platformer timed to the theatrical release of the studio\'s celebrated computer-animated feature.',
  },
  {
    gameId: 'a-ressha-de-ikou-z-mezase-tairiku-oudan-playstation',
    title: 'A Ressha de Ikou Z: Mezase Tairiku Oudan!',
    summary: 'Artdink\'s Japan-only PlayStation rail transport management game in the A-Train series tasks players with building and operating train networks across continental geography, continuing the long-running A-Train simulation franchise on PS1 for domestic Japanese railroad simulation fans.',
  },
  {
    gameId: 'a-train-iv-playstation',
    title: 'A-Train IV',
    summary: 'Artdink\'s PlayStation port of the PC city-building and railroad simulation delivers the fourth entry in the A-Train series to Sony\'s platform, combining real estate development with train network expansion in the franchise\'s characteristic blend of transport and urban planning simulation.',
  },
  {
    gameId: 'ai-shogi-playstation',
    title: 'AI Shogi',
    summary: 'A Japan-only PlayStation shogi simulation offering a computer opponent with configurable skill levels for the traditional Japanese chess-like board game, targeting domestic Japanese players seeking quality digital shogi competition on the PlayStation hardware.',
  },
  {
    gameId: 'atv-mania-playstation',
    title: 'ATV Mania',
    summary: 'Ubi Soft\'s PlayStation ATV racing title delivers off-road quad bike competition across terrain-based circuits, offering a compact portable ATV racing experience on PS1 hardware in the growing all-terrain vehicle sports genre.',
  },
  {
    gameId: 'atv-quad-power-racing-playstation',
    title: 'ATV Quad Power Racing',
    summary: 'Acclaim\'s PlayStation ATV racing game delivers quad bike off-road competition across dirt and terrain circuits, establishing the Quad Power Racing franchise on PS1 hardware before its subsequent PS2 sequel continued the series.',
  },
  {
    gameId: 'alone-in-the-dark-2-playstation',
    title: 'Alone in the Dark 2',
    summary: 'Infogrames\' PlayStation port of the 1993 horror adventure sequel shifts Edward Carnby\'s investigation from Lovecraftian mystery to a haunted gangster mansion in 1924, trading the original\'s cerebral horror for more action-oriented combat against undead criminals and a pirate ghost crew.',
  },
  {
    gameId: 'alone-in-the-dark-the-new-nightmare-playstation',
    title: 'Alone in the Dark: The New Nightmare',
    summary: 'Infogrames\' PlayStation survival horror revival updates the pioneering Alone in the Dark series to the modern Resident Evil era with polygonal characters over pre-rendered environments, featuring two playable investigators exploring Shadow Island with limited resources and a darker tone than the original trilogy.',
  },
  {
    gameId: 'army-men-world-war-team-assault-playstation',
    title: 'Army Men: World War Team Assault',
    summary: '3DO\'s PlayStation Army Men squad combat title deploys green plastic soldiers in coordinated team missions against enemy toy armies, adding cooperative team mechanics to the franchise\'s established plastic soldier combat formula.',
  },
  {
    gameId: 'army-men-air-attack-2-playstation',
    title: 'Army Men: Air Attack 2',
    summary: '3DO\'s PlayStation sequel to Army Men Air Attack returns Blade\'s helicopter unit to aerial plastic soldier combat with additional aircraft and expanded mission objectives, continuing the air combat spinoff within the prolific Army Men franchise.',
  },
  {
    gameId: 'army-men-green-rogue-playstation',
    title: 'Army Men: Green Rogue',
    summary: '3DO\'s PlayStation Army Men title follows a rogue soldier cutting through enemy toy armies in a compact action-heavy entry in the franchise, emphasizing individual soldier gameplay over the broader military operations of other Army Men titles.',
  },
  {
    gameId: 'army-men-lock-n-load-playstation',
    title: 'Army Men: Lock \'N\' Load',
    summary: '3DO\'s PlayStation first-person shooter spin-off brings the Army Men plastic soldier universe into a standard FPS format, offering a first-person perspective departure from the franchise\'s typical third-person combat in the toy war setting.',
  },
  {
    gameId: 'army-men-sarge-s-heroes-2-playstation',
    title: 'Army Men: Sarge\'s Heroes 2',
    summary: '3DO\'s PlayStation sequel to Sarge\'s Heroes continues the named soldier\'s rescue campaign through plastic toy environments with an expanded mission set and additional enemies, building on the first game\'s character-driven approach to the Army Men franchise.',
  },
  {
    gameId: 'angelique-playstation',
    title: 'Angelique',
    summary: 'Koei\'s Japan-only PlayStation otome game is a port of the 1994 Super Famicom title that founded the otome genre, placing female player Angelique as a candidate Queen of the universe who must develop her domain and win the favor of nine Guardian Sacres in a pioneering romance simulation.',
  },
  {
    gameId: 'angelique-special-2-playstation',
    title: 'Angelique Special 2',
    summary: 'Koei\'s Japan-only PlayStation enhanced rerelease of Angelique Special updates the foundational otome game with additional content and the PS1\'s capabilities, continuing the romance simulation series for domestic Japanese audiences within the Queen Candidate narrative framework.',
  },
  {
    gameId: 'angelique-tenku-no-requiem-playstation',
    title: 'Angelique: Tenku no Requiem',
    summary: 'Koei\'s Japan-only PlayStation Angelique entry offers a standalone narrative within the guardian romance universe, delivering a new scenario and relationship arcs in the otome simulation format for domestic fans of the founding series of the romantic visual novel genre.',
  },
  {
    gameId: 'ao-no-6-gou-antarctica-playstation',
    title: 'Ao no 6 Gou: Antarctica',
    summary: 'Bandai\'s Japan-only PlayStation submarine simulation game based on the Blue Submarine No. 6 anime OVA series places players in undersea combat missions in a post-climate-catastrophe ocean world, adapting the Satoshi Urushihara source material into a naval simulation for PS1.',
  },
  {
    gameId: 'aqua-gt-playstation',
    title: 'Aqua GT',
    summary: 'Metro3D\'s PlayStation hydroplane racing game delivers circuit competition across water-based tracks with powerboat vehicles, offering a racing simulation variant focused on the speed and handling characteristics of high-performance watercraft.',
  },
  {
    gameId: 'ark-of-time-playstation',
    title: 'Ark of Time',
    summary: 'Trecision\'s PlayStation point-and-click adventure follows a journalist investigating underwater ruins tied to the legend of Atlantis, delivering a Mediterranean mystery in the European adventure game tradition with full 3D environments and pre-rendered backgrounds.',
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
          notes = 'G2 summary batch 52'
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
      'G2 summary batch 52'
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
    ) VALUES (?, 'g2_summary_batch_52', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 52 — PlayStation remaining wave 2')

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
  const runKey = `g2-summary-batch-52-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 52 applied locally on staging sqlite',
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
