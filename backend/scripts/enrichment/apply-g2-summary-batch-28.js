#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Super Nintendo — wave 4 (B-C range continued, verified IDs)
  {
    gameId: 'bassin-s-black-bass-with-hank-parker-super-nintendo',
    title: "Bassin's Black Bass with Hank Parker",
    summary: "Hot-B's SNES bass fishing simulation features legendary angler Hank Parker's endorsement alongside realistic fishing lake environments, targeting American fishing enthusiasts with a licensed rod-and-reel simulation built around competitive tournament formats.",
  },
  {
    gameId: 'battle-grand-prix-super-nintendo',
    title: 'Battle Grand Prix',
    summary: "Data East's SNES Formula 1 racing game delivers overhead-perspective circuit racing across licensed tracks, offering a top-down racing alternative to the era's more common behind-the-car perspective games for the Super Nintendo library.",
  },
  {
    gameId: 'battle-master-kyuukyoku-no-senshitachi-super-nintendo',
    title: 'Battle Master: Kyuukyoku no Senshitachi',
    summary: "Quest's 1991 Japan-only SNES fighting game presents one-on-one weapon-based combat between armored knights and warriors, offering an early SNES fighter that arrived before Capcom and SNK titles established the genre's SNES conventions.",
  },
  {
    gameId: 'battle-soccer-field-no-hasha-super-nintendo',
    title: 'Battle Soccer: Field no Hasha',
    summary: "Banpresto's 1992 Japan-only SNES game combines soccer with giant robot combat, fielding teams of mecha from popular anime series in full-contact football matches, blending sports gameplay with the Super Robot franchise fan service.",
  },
  {
    gameId: 'beethoven-the-ultimate-canine-caper-super-nintendo',
    title: 'Beethoven: The Ultimate Canine Caper',
    summary: "Hi Tech Expressions' SNES platformer based on the 1992 family comedy film follows the oversized Saint Bernard dog through household stages, offering a standard licensed platformer tied to the Universal Pictures film franchise.",
  },
  {
    gameId: 'big-run-super-nintendo',
    title: 'Big Run',
    summary: "Jaleco's SNES off-road racing game is based on the Paris-Dakar Rally, presenting driver selection and vehicle customization across desert and cross-country stages in a licensed adaptation of the famous endurance motorsport event.",
  },
  {
    gameId: 'bobby-s-world-super-nintendo',
    title: "Bobby's World",
    summary: "Hi Tech Expressions' SNES platformer based on the Howie Mandel-created animated series follows young Bobby Generic through imagination-fueled side-scrolling stages, translating the cartoon's daydream fantasy premise into a family-targeted adventure game.",
  },
  {
    gameId: 'chrono-trigger-super-nintendo',
    title: 'Chrono Trigger',
    summary: "Square's 1995 SNES RPG masterpiece sends Crono and companions across multiple time periods to prevent a global catastrophe, combining Akira Toriyama's character design with Nobuo Uematsu's music and a pioneering New Game Plus system in a landmark of the genre.",
  },
  {
    gameId: 'ace-o-nerae-super-nintendo',
    title: 'Ace o Nerae!',
    summary: "Pony Canyon's 1993 Japan-only SNES tennis game is based on the classic shōjo manga series Aim for the Ace!, following a young tennis prodigy through a sport-training narrative in a licensed game that blends visual novel story elements with tennis simulation.",
  },
  {
    gameId: 'action-pachio-super-nintendo',
    title: 'Action Pachio',
    summary: "Coconuts Japan's 1994 SNES pachinko-themed platformer stars Pachio, a pachinko ball character navigating obstacle-filled side-scrolling stages, blending the Japanese arcade gambling machine aesthetic with family-friendly platform action.",
  },
  {
    gameId: 'advanced-v-g-super-nintendo',
    title: 'Advanced V.G.',
    summary: "TGL's 1995 Japan-only SNES fighting game adapts the PC-98 eroge fighting series to console, featuring an all-female fighter roster in one-on-one combat with the series' characteristic blend of competitive fighting and character relationship drama.",
  },
  {
    gameId: 'aguri-suzuki-f-1-super-driving-super-nintendo',
    title: 'Aguri Suzuki F-1 Super Driving',
    summary: "Varie's 1992 Japan-only SNES Formula 1 racing game is endorsed by Japanese F1 driver Aguri Suzuki, offering licensed circuit racing in a domestic celebrity-tied sports release that capitalized on Suzuki's period success in the real F1 championship.",
  },
  {
    gameId: 'aim-for-the-ace-super-nintendo',
    title: 'Aim for the Ace!',
    summary: "Pony Canyon's 1994 Japan-only SNES game is a visual novel and tennis simulation based on the Aim for the Ace! manga, following Hiromi's journey from beginner to elite competitor in a licensed adaptation emphasizing story over pure sport mechanics.",
  },
  {
    gameId: 'al-unser-jr-s-road-to-the-top-super-nintendo',
    title: "Al Unser Jr.'s Road to the Top",
    summary: "Mindscape's SNES racing game carries IndyCar driver Al Unser Jr.'s endorsement in a racing career simulation, tracking a driver's progression through amateur and professional ranks in a licensed motorsport title for the North American market.",
  },
  {
    gameId: 'alice-no-paint-adventure-super-nintendo',
    title: 'Alice no Paint Adventure',
    summary: "Datam Polystar's 1995 Japan-only SNES game is a creativity application using a tablet peripheral to produce Alice in Wonderland-themed paintings, representing one of the platform's few art creation software releases in the domestic Japanese market.",
  },
  {
    gameId: 'angelique-super-nintendo',
    title: 'Angelique',
    summary: "Koei's 1994 Japan-only SNES romance simulation game follows a young woman competing to become the next queen of the universe, pioneering the otome game genre with its focus on female protagonist and male love interest relationships that became a major Japanese genre.",
  },
  {
    gameId: 'ashita-no-joe-super-nintendo',
    title: 'Ashita no Joe',
    summary: "Kodansha's 1991 Japan-only SNES boxing game is based on the iconic manga series, following Joe Yabuki's rise through the boxing world in a licensed adaptation of the landmark sports manga that shaped Japanese boxing media for decades.",
  },
  {
    gameId: 'astral-bout-super-nintendo',
    title: 'Astral Bout',
    summary: "KAZe's 1993 Japan-only SNES wrestling game delivers grappling mechanics across a roster of pro wrestling characters, offering domestic Famicom wrestling fans a Super Nintendo alternative during the platform's early years of sports game development.",
  },
  {
    gameId: 'bakushou-kinsey-gekijou-super-nintendo',
    title: 'Bakushou!! Kinsey Gekijou',
    summary: "Taito's 1993 Japan-only SNES game adapts the Japanese television variety program into a party quiz and mini-game collection, representing the licensed entertainment format that characterized numerous domestic Super Famicom releases.",
  },
  {
    gameId: 'ball-bullet-gun-survival-game-simulation-super-nintendo',
    title: 'Ball Bullet Gun: Survival Game Simulation',
    summary: "Imagineer's 1994 Japan-only SNES airsoft simulation puts players in tactical team scenarios with paintball-style elimination mechanics, representing the niche military simulation genre catering to Japan's substantial airsoft sporting community.",
  },
  {
    gameId: 'banshee-s-last-cry-super-nintendo',
    title: "Banshee's Last Cry",
    summary: "Chunsoft's 1994 Japan-only SNES sound novel presents a horror mystery narrative driven almost entirely through text and atmospheric sound design, following the format Chunsoft pioneered with Kamaitachi no Yoru in the visual novel genre.",
  },
  {
    gameId: 'barbarossa-super-nintendo',
    title: 'Barbarossa',
    summary: "MicroProse's SNES strategy wargame simulates the 1941 Eastern Front invasion of the Soviet Union, translating the complex PC operational wargame to console with map-based army movement and supply management for World War II strategy fans.",
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
          notes = 'G2 summary batch 28'
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
      'G2 summary batch 28'
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
    ) VALUES (?, 'g2_summary_batch_28', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 28 — SNES wave 3 (A-C range)')

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
  const runKey = `g2-summary-batch-28-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 28 applied locally on staging sqlite',
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
