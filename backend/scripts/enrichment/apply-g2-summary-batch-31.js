#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // PlayStation — wave 6 (A range, verified IDs)
  {
    gameId: 'alien-trilogy-playstation',
    title: 'Alien Trilogy',
    summary: "Probe Software's PS1 port of their own 1996 first-person shooter compresses all three Alien films into a mission set through xenomorph-infested corridors, offering the franchise's first successful FPS adaptation with strong atmospheric use of industrial Giger-inspired environments.",
  },
  {
    gameId: 'allied-general-playstation',
    title: 'Allied General',
    summary: "Strategic Simulations' PS1 turn-based wargame simulates World War II European theater campaigns from the Allied perspective across hexagonal maps, adapting SSI's PC-caliber operational wargame series for console audiences interested in historical strategy.",
  },
  {
    gameId: 'alone-in-the-dark-playstation',
    title: 'Alone in the Dark',
    summary: "Infogrames' PS1 release compiles the original survival horror trilogy that founded the genre, including the 1992 original starring Edward Carnby in the Derceto mansion, directly influencing Resident Evil's design through its pre-rendered backgrounds and fixed camera angles.",
  },
  {
    gameId: 'all-star-baseball-97-playstation',
    title: "All-Star Baseball '97",
    summary: "Acclaim's PS1 baseball game uses the MLB license with detailed player statistics and stadium recreations, offering a realistic hitting perspective and fielding controls in one of the PlayStation's early attempts at simulation-grade baseball.",
  },
  {
    gameId: 'air-hockey-playstation',
    title: 'Air Hockey',
    summary: "Jaleco's PS1 air hockey simulation recreates the arcade table game with physics-driven puck movement and competitive AI difficulty levels, providing a faithful digital recreation of the coin-operated sports game for home console play.",
  },
  {
    gameId: 'air-race-championship-playstation',
    title: 'Air Race Championship',
    summary: "Microids' PS1 air racing game places players in propeller-driven aircraft through low-altitude circuit courses marked by pylons, offering an officially licensed Red Bull Air Race-style flight competition in a specialized aviation racing format.",
  },
  {
    gameId: 'action-bass-playstation',
    title: 'Action Bass',
    summary: "Take-Two Interactive's PS1 bass fishing simulation features cast targeting mechanics and fish behavior modeling across multiple lake environments, providing an accessible fishing simulation that traded simulation depth for pick-up-and-play approachability.",
  },
  {
    gameId: 'action-man-destruction-x-playstation',
    title: 'Action Man: Destruction X',
    summary: "Hasbro Interactive's PS1 action game based on the UK action figure brand sends Action Man through vehicle combat missions, adapting the toy line's military adventure premise into a third-person vehicular combat game for European audiences.",
  },
  {
    gameId: 'action-man-operation-extreme-playstation',
    title: 'Action Man: Operation Extreme',
    summary: "Hasbro Interactive's PS1 follow-up to Destruction X continues the action figure-based mission format with new third-person combat stages, building on the first game's vehicle action with expanded operation scenarios for the European toy brand's fans.",
  },
  {
    gameId: 'actua-golf-3-playstation',
    title: 'Actua Golf 3',
    summary: "Gremlin Interactive's PS1 third entry in the motion-captured golf series features digitized golfer animations and real course designs, continuing Actua Sports' emphasis on visual realism through full-body motion capture animation in a simulation golf format.",
  },
  {
    gameId: 'adiboo-and-paziral-s-secret-playstation',
    title: "Adiboo and Paziral's Secret",
    summary: "Coktel Vision's PS1 educational adventure follows the Adiboo character through puzzle-solving scenarios designed for young children, part of the French edutainment software brand's console adaptations that brought their PC learning game series to PlayStation.",
  },
  {
    gameId: 'adibou-et-l-ombre-verte-playstation',
    title: "Adibou et l'Ombre verte",
    summary: "Coktel Vision's PS1 French-market educational game continues the Adibou series with reading and logic puzzles for young children, part of the extensive Adibou catalog that established the character as a leading edutainment brand in France.",
  },
  {
    gameId: 'adidas-power-soccer-international-97-playstation',
    title: "Adidas Power Soccer International '97",
    summary: "Psygnosis' PS1 soccer sequel to Power Soccer updates the Adidas-licensed football simulation with 1997 international tournament rosters, refining the original game's distinctive power-shot charging mechanic and national team competition formats.",
  },
  {
    gameId: 'agent-armstrong-playstation',
    title: 'Agent Armstrong',
    summary: "Coconut Crunch's PS1 action game follows a secret agent through espionage missions combining shooting and stealth elements, a smaller-scale spy action release that preceded the explosion of cinematic stealth games later in the PlayStation's library.",
  },
  {
    gameId: 'ai-mahjong-2000-playstation',
    title: 'Ai Mahjong 2000',
    summary: "Success' Japan-only PS1 mahjong game provides artificial intelligence opponents at varying skill levels for traditional Japanese mahjong play, part of the extensive domestic mahjong simulation software library that found consistent sales in the Japanese PlayStation market.",
  },
  {
    gameId: 'alexandra-ledermann-2-playstation',
    title: 'Alexandra Ledermann 2',
    summary: "Ubisoft's PS1 equestrian simulation sequel carries French show jumping champion Alexandra Ledermann's endorsement, offering horse care, training, and competition across jumping courses in a licensed sports simulation targeted at European horse-enthusiast audiences.",
  },
  {
    gameId: 'alnam-no-kiba-juzoku-junishinto-densetsu-playstation',
    title: 'Alnam no Kiba: Jūzoku Jūnishinto Densetsu',
    summary: "Imagineer's 1996 Japan-only PS1 RPG presents a fantasy adventure built around twelve zodiac spirits, following heroes through a narrative-driven quest in a title that remained exclusive to the Japanese PlayStation market without international release.",
  },
  {
    gameId: '40-winks-playstation',
    title: '40 Winks',
    summary: "GT Interactive's PS1 3D platformer follows twin children Ruff and Tumble fighting the nightmare villain Nitekap through dream-world stages, a late-era PS1 platformer with colorful environments that attempted to compete with Nintendo's 3D platform style.",
  },
  {
    gameId: '70-s-robot-anime-geppy-x-playstation',
    title: "70's Robot Anime Geppy-X",
    summary: "Exact and ASCII's 1999 Japan-only PS1 shoot-'em-up parodies 1970s super robot anime through side-scrolling shooter stages, combining loving homage to Mazinger Z and Getter Robo visual conventions with the frantic scrolling shooter genre for comedy effect.",
  },
  {
    gameId: 'anno-mutationem-playstation',
    title: 'ANNO: Mutationem',
    summary: "ThinkingStars' PS1-era-styled cyberpunk action RPG blends 2D side-scrolling combat with 3D town exploration in a neon-drenched dystopian city, mixing pixel art cutscenes with contemporary action mechanics in a genre-hybrid that arrived on modern platforms in 2022.",
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
          notes = 'G2 summary batch 31'
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
      'G2 summary batch 31'
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
    ) VALUES (?, 'g2_summary_batch_31', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 31 — PS1 wave 6 (A range)')

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
  const runKey = `g2-summary-batch-31-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 31 applied locally on staging sqlite',
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
