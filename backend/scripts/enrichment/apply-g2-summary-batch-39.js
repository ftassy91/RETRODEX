#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Nintendo Entertainment System — wave 2 (M through Z range, French-placeholder replacements)
  {
    gameId: 'marble-madness-nintendo-entertainment-system',
    title: 'Marble Madness',
    summary: "Milton Bradley's 1986 NES port of Atari's 1984 isometric marble-racing arcade game challenges players to guide a marble to the finish line across obstacle-filled stages against a timer, a conversion of the trackball-driven coin-op that adapted well to NES directional controls.",
  },
  {
    gameId: 'mega-man-nintendo-entertainment-system',
    title: 'Mega Man',
    summary: "Capcom's 1987 NES action platformer launched a franchise by letting players choose the order of six robot master stages and absorbing the defeated bosses' weapons, a stage-select freedom that distinguished it from contemporary linear platformers and established the Mega Man design template.",
  },
  {
    gameId: 'mega-man-3-nintendo-entertainment-system',
    title: 'Mega Man 3',
    summary: "Capcom's 1990 NES platformer introduced Rush the robot dog as a traversal companion, eight new robot masters, and rematch stages against bosses from Mega Man 2, the longest NES Mega Man entry with a plot twist involving Proto Man and one of the series' most varied level rosters.",
  },
  {
    gameId: 'mega-man-4-nintendo-entertainment-system',
    title: 'Mega Man 4',
    summary: "Capcom's 1991 NES platformer added the Mega Buster charge shot to Mega Man's arsenal and introduced Dr. Cossack as a secondary antagonist before Wily's late-game reveal, a well-executed fourth entry that refined the series formula while introducing the charged weapon that defined later games.",
  },
  {
    gameId: 'mega-man-6-nintendo-entertainment-system',
    title: 'Mega Man 6',
    summary: "Capcom's 1993 NES platformer was the series' last original Famicom entry, featuring an international robot master tournament and two Rush armor fusion modes that transformed Mega Man into a jet or power-fist form, a technically polished send-off for the NES Mega Man lineage.",
  },
  {
    gameId: 'ninja-gaiden-nintendo-entertainment-system',
    title: 'Ninja Gaiden',
    summary: "Tecmo's 1988 NES action platformer was groundbreaking for its between-stage cinematic cutscenes advancing a revenge-and-conspiracy ninja narrative, combining demanding precise combat with a storytelling ambition that set a new NES standard for action game narrative presentation.",
  },
  {
    gameId: 'paperboy-nintendo-entertainment-system',
    title: 'Paperboy',
    summary: "Mindscape's 1988 NES port of the 1984 Atari arcade game places a bicycle-riding delivery boy through suburban routes delivering papers to subscribers while dodging obstacles and vandals, a game that captured the coin-op's chaotic energy in a conversion that became one of the more faithful NES arcade ports.",
  },
  {
    gameId: 'rad-racer-nintendo-entertainment-system',
    title: 'Rad Racer',
    summary: "Square's 1987 NES driving game supported the NES 3D Glasses peripheral with anaglyph mode alongside its standard play, an Out Run-influenced highway racer with a checkpoint time pressure system and a soundtrack by Nobuo Uematsu that predated his work on the Final Fantasy series.",
  },
  {
    gameId: 'river-city-ransom-nintendo-entertainment-system',
    title: 'River City Ransom',
    summary: "Technos Japan's 1989 NES brawler adds RPG elements to the beat-'em-up formula letting Alex and Ryan spend money on stat-boosting food and books between side-scrolling gang fights, a hybrid that influenced countless later action RPGs and retained a devoted following for decades.",
  },
  {
    gameId: 'startropics-nintendo-entertainment-system',
    title: 'StarTropics',
    summary: "Nintendo R&D3's 1990 NES action-adventure follows Mike Jones using a yo-yo weapon through isometric island dungeons to rescue his uncle from aliens, a Nintendo-developed title created specifically for Western markets that never released in Japan and used a letter with invisible ink as a copy-protection puzzle.",
  },
  // Game Boy Advance — wave 3 (B through F range, French-placeholder replacements)
  {
    gameId: 'boktai-the-sun-is-in-your-hand-game-boy-advance',
    title: 'Boktai: The Sun Is in Your Hand',
    summary: "Konami's 2003 GBA action RPG by Hideo Kojima features a solar sensor in the cartridge that detects real sunlight, requiring players to take the GBA outdoors to recharge solar-powered weapons and purify vampire bosses, a design concept that blended real-world interaction with handheld gameplay.",
  },
  {
    gameId: 'donkey-kong-country-game-boy-advance',
    title: 'Donkey Kong Country',
    summary: "Rare's 2003 GBA port of the SNES pre-rendered platformer adapts the original's two-animal-team play and animal buddy mechanics to the handheld with redrawn sprites and a new time-attack mode, bringing the landmark 16-bit platformer to the GBA's smaller screen.",
  },
  {
    gameId: 'final-fantasy-tactics-advance-game-boy-advance',
    title: 'Final Fantasy Tactics Advance',
    summary: "Square's 2003 GBA tactical RPG follows children transported into a living Final Fantasy world and builds a grid-based strategy system around clan law cards that restrict actions in battle, a more accessible entry point to the Tactics series built around clan management and mission-based progression.",
  },
  // Super Nintendo — wave 1 (A through F range, French-placeholder replacements)
  {
    gameId: 'aladdin-super-nintendo',
    title: 'Aladdin',
    summary: "Capcom's 1993 SNES platformer based on the Disney film uses a sword-and-apple combat system through stages from the animated film, a technically impressive licensed adaptation that drew on clean Capcom platformer design in contrast to the Genesis version's hand-drawn animation approach.",
  },
  {
    gameId: 'breath-of-fire-super-nintendo',
    title: 'Breath of Fire',
    summary: "Capcom's 1993 SNES RPG launched a fantasy franchise with dragon-blooded hero Ryu and a rotating party system where characters' field skills like fishing and hunting contributed to world exploration, a Capcom-designed JRPG that established the series' recurring dragon warrior mythology.",
  },
  {
    gameId: 'breath-of-fire-ii-super-nintendo',
    title: 'Breath of Fire II',
    summary: "Capcom's 1994 SNES RPG sequel introduced a township building mechanic alongside the core party system, letting players recruit NPCs to populate a home base while Ryu's team pursued a religious conspiracy involving a demon-backed church organization.",
  },
  {
    gameId: 'castlevania-dracula-x-super-nintendo',
    title: 'Castlevania: Dracula X',
    summary: "Konami's 1995 SNES port of Rondo of Blood adapts the PC Engine classic with redrawn graphics and simplified stage designs for the cartridge format, delivering the whip-cracking vampire-hunting action of one of the series' most beloved entries in a Western-friendly SNES release.",
  },
  {
    gameId: 'contra-iii-alien-wars-super-nintendo',
    title: 'Contra III: The Alien Wars',
    summary: "Konami's 1992 SNES run-and-gun is the series' most technically ambitious 16-bit entry, featuring top-down overhead stages, two-weapon carry mechanics, and Mode 7 boss encounters across a brutal alien invasion campaign that remains a benchmark for SNES action game design.",
  },
  {
    gameId: 'demons-crest-super-nintendo',
    title: "Demon's Crest",
    summary: "Capcom's 1994 SNES action platformer puts fiend Firebrand through non-linear world exploration collecting five elemental crests that transform him into alternate dragon forms, a gothic action game built on Gargoyle's Quest mechanics that sold poorly at launch but gained a devoted cult following.",
  },
  {
    gameId: 'f-zero-super-nintendo',
    title: 'F-Zero',
    summary: "Nintendo's 1990 SNES launch title showcased the Mode 7 rotation effect with futuristic hover-car racing at high speed across fifteen tracks divided into three leagues, a technical demonstration that launched a Nintendo racing franchise and established the visual template for 16-bit high-speed racing.",
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
          notes = 'G2 summary batch 39'
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
      'G2 summary batch 39'
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
    ) VALUES (?, 'g2_summary_batch_39', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 39 — NES wave 2 (M-Z), GBA wave 3 (B-F), SNES wave 1 (A-F)')

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
  const runKey = `g2-summary-batch-39-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 39 applied locally on staging sqlite',
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
