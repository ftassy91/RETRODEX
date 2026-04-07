#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Game Boy / Game Boy Color — wave 3 (A-B range, verified IDs)
  {
    gameId: 'after-burst-game-boy',
    title: 'After Burst',
    summary: "Jaleco's 1990 Japan-only Game Boy shooter sends a spacecraft through vertically scrolling enemy waves, a compact take on the scrolling shooter genre tuned for the handheld format with power-up collecting and pattern-based boss encounters.",
  },
  {
    gameId: 'amazing-penguin-game-boy',
    title: 'Amazing Penguin',
    summary: "Natsume's 1990 Game Boy puzzle-action game has a penguin clearing enemy-filled stages by flipping tiles and trapping opponents, a top-down arena puzzler in the tradition of Pengo that offered portable single-screen challenge for the original Game Boy.",
  },
  {
    gameId: 'amazing-tater-game-boy',
    title: 'Amazing Tater',
    summary: "Atlus' 1991 Game Boy puzzle game stars a potato-shaped character pushing blocks through maze stages to complete target patterns, a portable puzzle release in the Kwirk series that translated the potato-protagonist concept from the NES to the handheld.",
  },
  {
    gameId: 'another-bible-game-boy',
    title: 'Another Bible',
    summary: "Atlus' 1995 Japan-only Game Boy strategy RPG features a turn-based battle system built around angel characters with elemental affinities, a compact portable strategy game that drew on Atlus' RPG expertise for the original Game Boy hardware.",
  },
  {
    gameId: 'arcade-classic-game-boy',
    title: 'Arcade Classic',
    summary: "Nintendo's Game Boy Arcade Classic series ported NES and arcade library titles to the handheld in compact monochrome form, preserving classic Nintendo game experiences for portable play during the original Game Boy's extended lifecycle.",
  },
  {
    gameId: 'aretha-ii-ariel-no-fushigi-na-tabi-game-boy',
    title: 'Aretha II: Ariel no Fushigi na Tabi',
    summary: "Japan Art Media's 1994 Japan-only Game Boy RPG is the sequel to the Super Famicom fantasy RPG series, translating the console RPG format to handheld scale with turn-based combat and a portable quest that continued the Aretha fantasy universe.",
  },
  {
    gameId: 'armored-police-metal-jack-game-boy',
    title: 'Armored Police Metal Jack',
    summary: "Atlus' 1991 Japan-only Game Boy action game is based on the anime series about armored police officers, translating the mecha-police science fiction narrative into portable side-scrolling action stages for the Japanese handheld market.",
  },
  {
    gameId: 'asmik-kun-world-2-game-boy',
    title: 'Asmik-kun World 2',
    summary: "Asmik's 1992 Japan-only Game Boy platformer sequel continues the blob mascot character's adventures through overhead stages, maintaining the publisher's Game Boy mascot series with a sequel to the original Asmik-kun World handheld title.",
  },
  {
    gameId: 'astro-rabby-game-boy',
    title: 'Astro Rabby',
    summary: "IGS's 1991 Japan-only Game Boy action platformer follows a rabbit through side-scrolling science fiction stages, an import-only Game Boy release that represented the diverse array of mascot platformers released during the handheld's early-1990s peak.",
  },
  {
    gameId: 'athletic-world-game-boy',
    title: 'Athletic World',
    summary: "Bandai's Game Boy adaptation of their NES Power Pad game replaces physical exertion with button-press timing challenges across obstacle-course stages, translating the kinetic athletics game concept to portable play without the original's floor mat peripheral.",
  },
  {
    gameId: 'attack-of-the-killer-tomatoes-game-boy',
    title: 'Attack of the Killer Tomatoes',
    summary: "THQ's Game Boy port of the licensed killer tomato platformer compresses the NES game's mutant tomato-fighting action into the handheld's monochrome display, bringing the cartoon tie-in platformer to Nintendo's portable hardware for travel play.",
  },
  {
    gameId: 'ayakashi-no-shiro-game-boy',
    title: 'Ayakashi no Shiro',
    summary: "Meldac's 1990 Japan-only Game Boy RPG places a hero against supernatural spirits in a traditional Japanese horror setting, offering turn-based dungeon exploration in a compact portable RPG built around yokai and ghost folklore.",
  },
  {
    gameId: 'altered-space-game-boy',
    title: 'Altered Space',
    summary: "Silicon Dream's 1991 Game Boy isometric puzzle-platformer navigates a space suit character through three-dimensional grid stages collecting energy cells, a technically ambitious attempt at isometric 3D perspective on the Game Boy's limited hardware.",
  },
  {
    gameId: 'action-man-search-for-base-x-game-boy-color',
    title: 'Action Man: Search for Base X',
    summary: "Hasbro Interactive's Game Boy Color action game based on the UK toy brand sends Action Man through top-down and platform stages locating a secret enemy base, a licensed action game in the European Hasbro GBC lineup alongside the PlayStation releases.",
  },
  {
    gameId: 'all-star-tennis-2000-game-boy-color',
    title: 'All Star Tennis 2000',
    summary: "Ubisoft's Game Boy Color tennis game follows up the N64 title with a portable edition featuring overhead-court tennis with circuit tour progression, translating the console game's competitive structure to a compact GBC format for handheld play.",
  },
  {
    gameId: 'antz-game-boy-color',
    title: 'Antz',
    summary: "Infogrames' Game Boy Color platformer based on the 1998 DreamWorks animated film follows the ant worker Z through underground colony stages, a licensed GBC adaptation of the computer-animated film's adventure narrative for portable play.",
  },
  {
    gameId: 'antz-racing-game-boy-color',
    title: 'Antz Racing',
    summary: "Infogrames' Game Boy Color racing game spins off the Antz film license into a top-down ant-scale racing game through indoor and outdoor environments, providing a companion piece to the main Antz GBC adventure game under the same film license.",
  },
  {
    gameId: 'army-men-air-attack-game-boy-color',
    title: 'Army Men: Air Attack',
    summary: "3DO's Game Boy Color helicopter combat game brings the plastic army men universe's aerial combat to the handheld platform, scaling down the console Air Attack experience to an overhead format suited to the GBC's screen and processing capabilities.",
  },
  {
    gameId: 'arthur-s-absolutely-fun-day-game-boy-color',
    title: "Arthur's Absolutely Fun Day",
    summary: "NewKidCo's Game Boy Color game based on Marc Brown's PBS animated series Arthur follows the aardvark through mini-game collections and exploration stages, providing an educational-adjacent licensed GBC title for young fans of the long-running children's television series.",
  },
  {
    gameId: 'aqualife-game-boy-color',
    title: 'AquaLife',
    summary: "Asmik Ace's 1999 Japan-only Game Boy Color aquarium simulation lets players raise and maintain a virtual fish tank ecosystem, a relaxation-focused pet simulation that offered an alternative to the action-oriented games dominating the GBC software catalog.",
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
          notes = 'G2 summary batch 33'
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
      'G2 summary batch 33'
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
    ) VALUES (?, 'g2_summary_batch_33', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 33 — Game Boy / GBC wave 3 (A-B range)')

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
  const runKey = `g2-summary-batch-33-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 33 applied locally on staging sqlite',
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
