#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Super Nintendo — wave 4 (remaining titles, verified IDs)
  {
    gameId: '3-3-eyes-juma-hokan-super-nintendo',
    title: '3×3 Eyes: Jūma Hōkan',
    summary: "Yutaka's 1992 Japan-only SNES action RPG is the first of two adaptations of the 3×3 Eyes manga, following Yakumo and Pai through combat stages drawn from the supernatural horror series by Yuzo Takada.",
  },
  {
    gameId: '3-3-eyes-seima-korinden-super-nintendo',
    title: '3×3 Eyes: Seima Kōrinden',
    summary: "Banpresto's 1993 Japan-only SNES follow-up to Jūma Hōkan continues the 3×3 Eyes manga adaptation, advancing the story of the immortal Sanjiyan Unkara through another chapter of the supernatural adventure series.",
  },
  {
    gameId: '4th-super-robot-wars-super-nintendo',
    title: '4th Super Robot Wars',
    summary: "Banpresto's 1995 Japan-only SNES strategy RPG assembles mecha from Gundam, Mazinger, and Getter Robo franchises for turn-based grid combat, continuing the long-running Super Robot Wars series with its characteristic crossover fan service format.",
  },
  {
    gameId: 'battle-jockey-super-nintendo',
    title: 'Battle Jockey',
    summary: "KOEI's 1994 Japan-only SNES horse racing simulation covers track management and breeding strategy across multiple race circuits, targeting the Japanese horse racing simulation audience that sustained KOEI's domestic software catalog through the 16-bit era.",
  },
  {
    gameId: 'bike-daisuki-hashiriya-kon-rider-s-spirits-super-nintendo',
    title: "Bike Daisuki! Hashiriya Kon – Rider's Spirits",
    summary: "Varie's 1993 Japan-only SNES motorcycle racing game places players on sport bikes through circuit tracks, offering an alternative to the era's dominant four-wheel racing games in a dedicated two-wheel simulation for the Super Famicom.",
  },
  {
    gameId: 'bing-bing-bingo-super-nintendo',
    title: 'Bing Bing! Bingo',
    summary: "Coconuts Japan's 1994 Japan-only SNES bingo simulation provides an electronic bingo card system with multiple game variants, representing the casual and party game software segment of the Super Famicom's extensive domestic software catalog.",
  },
  // Sega Genesis — wave 6 (A-B range, verified IDs)
  {
    gameId: '3-ninjas-kick-back-sega-genesis',
    title: '3 Ninjas Kick Back',
    summary: "DTMC's Genesis adaptation of the 1994 family film sends three young ninja brothers through side-scrolling martial arts stages, a conventional licensed platformer mirroring the simultaneous SNES release based on the Columbia Pictures sequel.",
  },
  {
    gameId: 'a-dinosaur-s-tale-sega-genesis',
    title: "A Dinosaur's Tale",
    summary: "Hi Tech Expressions' Genesis platformer is based on the 1993 Universal Pictures animated film We're Back! A Dinosaur's Story, following Rex through side-scrolling stages in a licensed adaptation of the dinosaur-in-New-York family movie.",
  },
  {
    gameId: 'a-x-101-sega-genesis',
    title: 'A/X-101',
    summary: "Micronet's 1993 Genesis mecha shooter sends a combat robot through vertically scrolling stages in a futuristic warfare setting, offering a straightforward arcade shooter in the tradition of the Genesis platform's robust shoot-'em-up library.",
  },
  {
    gameId: 'aa-harimanada-sega-genesis',
    title: 'Aa Harimanada',
    summary: "Game Arts' 1993 Japan-only Genesis sumo wrestling simulation is based on the manga series, combining one-on-one sumo bout mechanics with a story following a wrestler's rise through professional sumo ranks in a licensed sports manga adaptation.",
  },
  {
    gameId: 'aaahh-real-monsters-sega-genesis',
    title: 'Aaahh!!! Real Monsters',
    summary: "Viacom New Media's Genesis platformer based on the Nickelodeon animated series follows three monster students on missions, using the trio's unique monster abilities as gameplay mechanics in a licensed action game tied to the Klasky Csupo cartoon.",
  },
  {
    gameId: 'adventures-of-yogi-bear-sega-genesis',
    title: 'Adventures of Yogi Bear',
    summary: "Cybersoft's Genesis platformer follows Yogi Bear and Boo-Boo through Jellystone Park environments on a mission to prevent park closure, offering a side-scrolling adventure based on the Hanna-Barbera cartoon franchise for the 16-bit platform.",
  },
  {
    gameId: 'andre-agassi-tennis-sega-genesis',
    title: 'Andre Agassi Tennis',
    summary: "Absolute Entertainment's Genesis tennis game carries the world number one's endorsement, featuring multiple court surfaces and a tournament circuit mode in a licensed sports simulation built around the star's 1990s peak period dominance.",
  },
  {
    gameId: 'art-alive-sega-genesis',
    title: 'Art Alive!',
    summary: "Sega's 1992 Genesis creativity application provides drawing tools, animation features, and a sprite stamp library for creating pictures, representing one of the platform's few non-game software releases aimed at creative expression rather than entertainment.",
  },
  {
    gameId: 'australian-rugby-league-sega-genesis',
    title: 'Australian Rugby League',
    summary: "Sega's 1995 Genesis rugby league simulation is one of the few dedicated league code games on 16-bit consoles, targeting the Australian market with club teams and full thirteen-a-side rules in an officially licensed rugby league competition.",
  },
  {
    gameId: 'ballz-sega-genesis',
    title: 'Ballz',
    summary: "PF Magic's 1994 Genesis 3D fighting game constructs all characters entirely from spheres, creating a distinctive visual style while offering one-on-one combat with a roster of ball-composed fighters in a technically unusual tournament fighter.",
  },
  {
    gameId: 'barbie-super-model-sega-genesis',
    title: 'Barbie: Super Model',
    summary: "Hi Tech Expressions' Genesis Barbie platformer follows the fashion doll through modeling-world stages, offering the same licensed action concept as the simultaneous SNES release for Sega's 16-bit platform and its younger female player audience.",
  },
  {
    gameId: 'barbie-vacation-adventure-sega-genesis',
    title: 'Barbie: Vacation Adventure',
    summary: "Hi Tech Expressions' Genesis follow-up to Super Model sends Barbie through vacation resort environments, continuing the licensed Barbie platformer series with holiday-themed stages for the Sega Genesis alongside the parallel SNES release.",
  },
  {
    gameId: 'batman-revenge-of-the-joker-sega-genesis',
    title: 'Batman: Revenge of the Joker',
    summary: "Sunsoft's Genesis Batman action game sends the Dark Knight through platform stages fighting the Joker's forces with a run-and-gun combat style, offering a companion piece to the acclaimed NES Batman: Return of the Joker on Sega's 16-bit hardware.",
  },
  {
    gameId: 'bible-adventures-sega-genesis',
    title: 'Bible Adventures',
    summary: "Wisdom Tree's unlicensed Genesis religious game presents three Old Testament scenarios — Noah collecting animals, baby Moses, and David fighting Goliath — as simple action games in one of the platform's most notable unlicensed Christian software releases.",
  },
  {
    gameId: 'bimini-run-sega-genesis',
    title: 'Bimini Run',
    summary: "Nuvision Entertainment's 1990 Genesis water sports action game puts a speedboat through Caribbean waters rescuing hostages and defeating enemies, offering a top-down aquatic combat racing hybrid in the tradition of the platform's early action releases.",
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
          notes = 'G2 summary batch 29'
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
      'G2 summary batch 29'
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
    ) VALUES (?, 'g2_summary_batch_29', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 29 — SNES wave 4 (remaining) + Genesis wave 6 (A-B)')

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
  const runKey = `g2-summary-batch-29-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 29 applied locally on staging sqlite',
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
