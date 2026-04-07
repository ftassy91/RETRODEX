#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Sega Saturn — notable wave (22 games)
  {
    gameId: 'dark-savior-sega-saturn',
    title: 'Dark Savior',
    summary: 'Climax Entertainment\'s Saturn action-RPG presents five parallel story routes simultaneously navigated, combining real-time combat inspired by Landstalker with a narrative branching structure where multiple timelines of the same events unfold depending on player speed and choices.',
  },
  {
    gameId: 'darkstalkers-3-sega-saturn',
    title: 'Darkstalkers 3',
    summary: 'Capcom\'s Saturn port of Vampire Savior delivers the complete monster-themed 2D fighter with the EX gauge system and new characters including Lilith and Q-Bee, representing the franchise\'s most polished entry and one of the Saturn\'s best fighting game ports.',
  },
  {
    gameId: 'dead-or-alive-sega-saturn',
    title: 'Dead or Alive',
    summary: 'Tecmo\'s Saturn 3D fighting game introduces the Dead or Alive franchise with its distinctive counter-heavy combat system and physics-driven character animation, launching a franchise that would gain additional notoriety with sequels on PlayStation and Dreamcast.',
  },
  {
    gameId: 'deep-fear-sega-saturn',
    title: 'Deep Fear',
    summary: 'Sega\'s Japan and European-exclusive Saturn survival horror game places players on an underwater research base overrun by creatures in a Resident Evil-influenced third-person design, representing one of the platform\'s most-discussed Saturn exclusives never released in North America.',
  },
  {
    gameId: 'devil-summoner-soul-hackers-sega-saturn',
    title: 'Devil Summoner: Soul Hackers',
    summary: 'Atlus\' Japan-only Saturn cyberpunk dungeon RPG follows a hacker group uncovering a sinister AI and supernatural conspiracy in a futuristic city, featuring first-person dungeon exploration with the Shin Megami Tensei demon negotiation system in a title eventually localized decades later for 3DS.',
  },
  {
    gameId: 'dodonpachi-sega-saturn',
    title: 'DoDonPachi',
    summary: 'Cave\'s Saturn port of the 1997 arcade vertical bullet-hell shooter is among the defining works of the genre, demanding precision navigation through dense bullet patterns from enormous bosses and establishing the DonPachi series\' aesthetic of overwhelming firepower and barely survivable screen saturation.',
  },
  {
    gameId: 'donpachi-sega-saturn',
    title: 'DonPachi',
    summary: 'Cave\'s Saturn port of the 1995 arcade vertical shoot-\'em-up represents the studio\'s initial commercial breakthrough and the founding entry of the DonPachi series, offering intense vertical shooting with distinct ship types and the chain-combo scoring system that would define Cave\'s output.',
  },
  {
    gameId: 'doom-sega-saturn',
    title: 'Doom',
    summary: 'Rage Software\'s Saturn port of id Software\'s landmark 1993 first-person shooter adapts the full Ultimate Doom content with the platform\'s hardware limitations resulting in a compromised but playable version, notable for its differences from the superior PlayStation port that arrived in the same period.',
  },
  {
    gameId: 'decathlete-sega-saturn',
    title: 'Decathlete',
    summary: 'Sega\'s Saturn port of the Company\'s 1996 arcade decathlon game simulates all ten track and field events through button-pressing minigame mechanics, offering competitive multiplayer athletics in the arcade-faithful button-mashing tradition of the multi-event sports genre.',
  },
  {
    gameId: 'destruction-derby-sega-saturn',
    title: 'Destruction Derby',
    summary: 'Reflections Interactive\'s Saturn port of the PlayStation launch hit delivers demolition derby and circuit crash racing with realistic vehicle deformation physics, bringing the polygonal crash physics that distinguished the original to Sega\'s 32-bit hardware.',
  },
  {
    gameId: 'detana-twinbee-sega-saturn',
    title: 'Detana!! TwinBee',
    summary: 'Konami\'s Saturn vertical shoot-\'em-up is a port of the 1991 arcade game, featuring the trademark cloud-bouncing bell-power mechanic of the TwinBee series in a characteristically colorful and lighthearted shooter that stands apart from the era\'s grimmer sci-fi shooting competition.',
  },
  {
    gameId: 'discworld-sega-saturn',
    title: 'Discworld',
    summary: 'Perfect Entertainment\'s Saturn point-and-click adventure adapts Terry Pratchett\'s comic fantasy universe with the wizard Rincewind on a dragon-hunting quest, featuring Pratchett\'s characteristic literary wit and Eric Idle\'s voice performance in a demanding classic adventure game.',
  },
  {
    gameId: 'die-hard-trilogy-sega-saturn',
    title: 'Die Hard Trilogy',
    summary: 'Fox Interactive\'s Saturn port of the three-in-one action compilation adapts all three Die Hard films as different genres — third-person shooter, on-rails shooting gallery, and vehicular bomb-disposal — delivering three compact gameplay modes under one Bruce Willis license.',
  },
  {
    gameId: 'digital-monster-ver-s-digimon-tamers-sega-saturn',
    title: 'Digital Monster Ver. S: Digimon Tamers',
    summary: 'Bandai\'s Japan-only Saturn game translates the original Digimon virtual pet device into a home console format, allowing players to raise and battle digital monsters with content from the V-Pet hardware in a domestic Japan-only console expansion of the toy franchise.',
  },
  {
    gameId: 'death-tank-sega-saturn',
    title: 'Death Tank',
    summary: 'Lobotomy Software\'s Saturn hidden multiplayer game was initially embedded as a secret within Duke Nukem 3D and Quake before receiving a standalone release, delivering up to six-player artillery tank combat in a competitive worms-style projectile arc format.',
  },
  {
    gameId: 'death-crimson-sega-saturn',
    title: 'Death Crimson',
    summary: 'Ecole Software\'s Japan-only Saturn light-gun game is a notorious example of an underdeveloped commercial release, gaining cult status for its extremely low production values across shooter stages that have made it a landmark of the platform\'s obscure domestic release catalog.',
  },
  {
    gameId: 'darius-ii-sega-saturn',
    title: 'Darius II',
    summary: 'Taito\'s Saturn port of the 1989 dual-screen arcade horizontal shooter delivers the fish-themed boss lineup and branching stage structure of the original arcade experience, bringing the widescreen Darius formula to the home console in the series\' second entry.',
  },
  {
    gameId: 'dark-seed-sega-saturn',
    title: 'Dark Seed',
    summary: 'Cyberdreams\' Saturn port of the H.R. Giger-illustrated point-and-click horror adventure follows a writer discovering he shares a psychic link with an alien Dark World, featuring Giger\'s distinctive biomechanical artwork as the primary aesthetic draw of the horror adventure.',
  },
  {
    gameId: 'darklight-conflict-sega-saturn',
    title: 'Darklight Conflict',
    summary: 'EA\'s Saturn space combat flight game places players in an alien spacecraft fighting a cosmic war across first-person cockpit missions, representing the publisher\'s effort to bring PC-style space simulation to Saturn\'s hardware in the mid-1990s.',
  },
  {
    gameId: 'dx-jinsei-game-sega-saturn',
    title: 'DX Jinsei Game',
    summary: 'Takara\'s Japan-only Saturn adaptation of the popular Japanese board game Jinsei Game — the Japanese equivalent of The Game of Life — delivers the life simulation board game in a digital format for domestic Saturn audiences.',
  },
  {
    gameId: 'dx-jinsei-game-ii-sega-saturn',
    title: 'DX Jinsei Game II',
    summary: 'Takara\'s Japan-only Saturn sequel to DX Jinsei Game continues the digital adaptation of the Japanese life simulation board game with expanded content, maintaining the domestic party game franchise on Sega\'s home hardware.',
  },
  {
    gameId: 'dezaemon-2-sega-saturn',
    title: 'Dezaemon 2',
    summary: 'Athena\'s Japan-only Saturn shoot-\'em-up creation tool is the definitive entry in the Dezaemon series, providing a comprehensive editor for building and sharing custom 2D shooters with programmable enemy patterns, custom sprite graphics, and stage sequencing in a domestic creative platform.',
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
          notes = 'G2 summary batch 50'
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
      'G2 summary batch 50'
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
    ) VALUES (?, 'g2_summary_batch_50', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 50 — Sega Saturn notable wave')

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
  const runKey = `g2-summary-batch-50-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 50 applied locally on staging sqlite',
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
