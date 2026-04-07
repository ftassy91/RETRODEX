#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // NES — wave 3 (B continued + later alphabetical, verified IDs)
  {
    gameId: 'batman-returns-nes',
    title: 'Batman Returns',
    summary: 'Konami\'s NES adaptation of the 1992 film gives Batman an expanded move set including a grappling hook and batarang across Gotham\'s wintry streets, delivering a stronger action platformer than its predecessor thanks to Konami\'s in-house development.',
  },
  {
    gameId: 'batman-return-of-the-joker-nes',
    title: 'Batman: Return of the Joker',
    summary: 'Sunsoft\'s NES sequel to their acclaimed Batman game returns with Batman facing the Joker through technologically advanced stages, featuring elaborate sprite animation and a powerful run-and-gun action style that pushed NES hardware capabilities.',
  },
  {
    gameId: 'battle-kid-fortress-of-peril-nes',
    title: 'Battle Kid: Fortress of Peril',
    summary: 'Sivak Games\' 2010 NES homebrew precision platformer challenges players to navigate an intensely difficult fortress filled with traps and enemies, designed explicitly as a spiritual successor to I Wanna Be the Guy in an authentic 8-bit format.',
  },
  {
    gameId: 'ballblazer-nes',
    title: 'Ballblazer',
    summary: 'LucasArts\' NES port of the 1987 futuristic sports game pits two rotofoil craft against each other in a one-on-one soccer variant played across a scrolling corridor, notable for its split-screen presentation and algorithmic music composition system.',
  },
  {
    gameId: 'armadillo-nes',
    title: 'Armadillo',
    summary: 'Data East\'s 1991 Japan-only NES action platformer has the player rolling through stages as an armadillo curled into a ball, mixing traditional platforming traversal with ball-rolling momentum physics in a colorful adventure across enemy-filled worlds.',
  },
  {
    gameId: 'arabian-nes',
    title: 'Arabian',
    summary: 'Sunsoft\'s NES port of the 1983 Atari arcade platformer casts a prince collecting magic lamps through four Middle Eastern-themed stages, representing an early NES port of a pre-Nintendo coin-op during the platform\'s first years of Western release.',
  },
  {
    gameId: 'artelius-nes',
    title: 'Artelius',
    summary: 'Jaleco\'s 1990 Japan-only NES RPG follows a hero on a classical fantasy quest across overhead dungeons and world maps, offering a straightforward turn-based adventure that remained exclusive to the Famicom market without a Western localization.',
  },
  {
    gameId: 'asmik-kun-land-nes',
    title: 'Asmik-kun Land',
    summary: 'Asmik\'s 1990 Japan-only NES puzzle-platformer stars a blob-like creature navigating stage environments through a compact Japan-only release that served as early mascot branding for the publisher before its later Game Boy appearances.',
  },
  {
    gameId: 'astro-fang-super-machine-nes',
    title: 'Astro Fang: Super Machine',
    summary: 'Video System\'s Japan-only NES racing game places a futuristic vehicle through overhead-perspective circuits with weapon-equipping pit stops, blending arcade racing with light vehicular combat in a compact single-player format.',
  },
  {
    gameId: 'athletic-world-nes',
    title: 'Athletic World',
    summary: 'Bandai\'s NES Power Pad peripheral game challenges players to physically run, jump, and hop through obstacle-course stages, designed to convert the mat controller\'s foot sensors into an active outdoor athletics simulation for home play.',
  },
  {
    gameId: 'aussie-rules-footy-nes',
    title: 'Aussie Rules Footy',
    summary: 'HES\' NES Australian football simulation is the only NES game dedicated to the Australian Rules Football code, offering the oval-ball aerial game to PAL-region audiences in a top-down field presentation.',
  },
  {
    gameId: 'angry-video-game-nerd-8-bit-nes',
    title: 'Angry Video Game Nerd 8-bit',
    summary: 'FreakZone Games\' licensed homebrew NES platformer based on James Rolfe\'s AVGN video series sends the Nerd through game-world stages fighting classic video game villains, released as a tribute cartridge to the retro gaming media personality.',
  },
  {
    gameId: 'aa-yakyu-jinsei-itchokusen-nes',
    title: 'Aa Yakyū Jinsei Itchokusen',
    summary: 'Meldac\'s 1991 Japan-only NES baseball simulation offers a standard overhead field perspective for the domestic Famicom market, part of a wave of Japanese-exclusive sports releases that never received Western localization.',
  },
  {
    gameId: 'ai-sensei-no-oshiete-watashi-no-hoshi-nes',
    title: 'Ai Sensei no Oshiete: Watashi no Hoshi',
    summary: 'Bothtec\'s 1986 Japan-only NES game is an astrology-based life-simulation novelty that generates personalized star sign readings, representing an unusual non-game software application on the early Famicom platform.',
  },
  {
    gameId: 'aighina-no-yogen-from-the-legend-of-balubalouk-nes',
    title: 'Aighina no Yogen: From the Legend of Balubalouk',
    summary: 'Irem\'s 1986 Japan-only NES action RPG follows a young hero through overhead stages collecting items and battling enemies in a fantasy quest, drawing from arcade-style action RPG conventions present in early Famicom software.',
  },
  {
    gameId: 'akagawa-jiro-no-yurei-ressha-nes',
    title: 'Akagawa Jirō no Yūrei Ressha',
    summary: 'Pony Canyon\'s 1986 Japan-only NES game is a text adventure based on mystery novelist Jirō Akagawa\'s ghost train stories, representing the interactive fiction genre that flourished in early Famicom software alongside action game releases.',
  },
  {
    gameId: 'akuma-kun-nes',
    title: 'Akuma-kun',
    summary: 'Toei Animation\'s 1990 Japan-only NES action game is based on the manga and anime series starring a boy who summons demons, offering stage-based monster combat tied to the supernatural adventure narrative of the source material.',
  },
  {
    gameId: 'america-daitoryo-senkyo-nes',
    title: 'America Daitōryō Senkyo',
    summary: 'Kemco\'s 1988 Japan-only NES simulation game lets players run a US presidential election campaign, managing budget allocation and state campaigning in a political strategy format that was a curiosity release for the Japanese Famicom market.',
  },
  {
    gameId: 'attack-animal-gakuen-nes',
    title: 'Attack Animal Gakuen',
    summary: 'Pony Canyon\'s 1987 Japan-only NES action game features students transformed into animal warriors battling through school environments, blending absurdist Japanese comedy with straightforward action platformer mechanics.',
  },
  {
    gameId: 'baby-boomer-nes',
    title: 'Baby Boomer',
    summary: 'Color Dreams\' unlicensed 1990 NES light-gun game tasks players with protecting a crawling baby from hazards across side-scrolling stages, notable as one of the few NES games designed around protecting a moving ally character rather than direct combat.',
  },
  {
    gameId: 'bad-news-baseball-nes',
    title: 'Bad News Baseball',
    summary: 'Tecmo\'s 1990 NES baseball game presents its sport through a humorous animal team roster with dynamic camera angles during pitching and batting, offering accessible play with a lighthearted visual style distinct from the era\'s more serious sports simulations.',
  },
  {
    gameId: 'barbie-nes',
    title: 'Barbie',
    summary: 'Hi Tech Expressions\' 1991 NES platformer based on the Mattel doll franchise sends Barbie through dream-sequence worlds including a medieval castle and outer space, representing one of the platform\'s few games marketed explicitly toward a young female audience.',
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
          notes = 'G2 summary batch 26'
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
      'G2 summary batch 26'
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
    ) VALUES (?, 'g2_summary_batch_26', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 26 — NES wave 3 (A-B range continued)')

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
  const runKey = `g2-summary-batch-26-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 26 applied locally on staging sqlite',
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
