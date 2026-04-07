#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Nintendo 64 — wave 1 (first 18)
  {
    gameId: '64-hanafuda-tenshi-no-yakusoku-nintendo-64',
    title: '64 Hanafuda: Tenshi no Yakusoku',
    summary: 'A Japan-only Nintendo 64 title adapting the traditional Japanese hanafuda card game with an angel-themed narrative wrapper, delivering the matching card game in a 3D presentation for domestic N64 audiences interested in digital traditional game formats.',
  },
  {
    gameId: '64-trump-collection-alice-no-waku-waku-trump-world-nintendo-64',
    title: '64 Trump Collection: Alice no Waku Waku Trump World',
    summary: 'A Japan-only Nintendo 64 card game collection themed around an Alice in Wonderland-inspired world, packaging multiple trump card games and hanafuda variants with an animated storybook presentation for the domestic Japanese market.',
  },
  {
    gameId: '64-ozumo-nintendo-64',
    title: '64 Ozumo',
    summary: 'Imagineer\'s Japan-only Nintendo 64 sumo wrestling simulation delivers professional-grade grand tournament competition with authentic rikishi management and dohyo bouts, targeting the substantial Japanese domestic sumo fan market.',
  },
  {
    gameId: '64-ozumo-2-nintendo-64',
    title: '64 Ozumo 2',
    summary: 'Imagineer\'s Japan-only Nintendo 64 sequel to 64 Ozumo refines the sumo management and competition simulation with updated tournament structures and wrestler rosters, continuing the domestic-market sumo series on Nintendo\'s 64-bit hardware.',
  },
  {
    gameId: 'ai-shogi-3-nintendo-64',
    title: 'AI Shogi 3',
    summary: 'A Japan-only Nintendo 64 shogi simulation offering a strong computer opponent with adjustable difficulty levels across standard and handicap board configurations, targeting domestic Japanese audiences seeking digital shogi competition on the home console.',
  },
  {
    gameId: 'bakusho-jinsei-64-mezase-resort-o-nintendo-64',
    title: 'Bakusho Jinsei 64: Mezase Resort Ou!',
    summary: 'Takara\'s Japan-only Nintendo 64 party board game tasks players with building resort properties across a Monopoly-style board with a Japanese comedy variety show aesthetic, designed for group play in the domestic market.',
  },
  {
    gameId: 'choro-q-64-2-hachamecha-grand-prix-race-nintendo-64',
    title: 'Choro Q 64 2: Hachamecha Grand Prix Race!',
    summary: 'Takara\'s Japan-only Nintendo 64 sequel in the Choro Q toy car racing franchise delivers circuit racing with the miniature pull-back car aesthetic, continuing the series\' lighthearted kart-style competition for domestic Japanese audiences.',
  },
  {
    gameId: 'chokukan-night-pro-yakyu-king-nintendo-64',
    title: 'Chokukan Night Pro Yakyuu King',
    summary: 'Coconuts Japan\'s Japan-only Nintendo 64 professional baseball simulation targets the domestic baseball fan market with the pro yakyu franchise format, offering season play and statistical management alongside on-field action.',
  },
  {
    gameId: 'chokukan-night-pro-yakyu-king-2-nintendo-64',
    title: 'Chokukan Night Pro Yakyuu King 2',
    summary: 'Coconuts Japan\'s Japan-only Nintendo 64 sequel continues the pro yakyu simulation with updated rosters and refined baseball mechanics, maintaining the domestic baseball franchise series through the N64\'s commercial lifespan.',
  },
  {
    gameId: 'dance-dance-revolution-disney-dancing-museum-nintendo-64',
    title: 'Dance Dance Revolution: Disney Dancing Museum',
    summary: 'Konami\'s Japan-only Nintendo 64 rhythm game combines the Dance Dance Revolution format with Disney character themes and songs, offering home console dance pad gameplay for the domestic Japanese market with officially licensed animated character music.',
  },
  {
    gameId: 'densha-de-go-64-nintendo-64',
    title: 'Densha de Go! 64',
    summary: 'Taito\'s Japan-only Nintendo 64 train driving simulation puts players in the cab of Japanese rail lines managing speed and braking for accurate station stops, bringing the beloved arcade train simulation series to home console for domestic rail enthusiasts.',
  },
  {
    gameId: 'derby-stallion-64-nintendo-64',
    title: 'Derby Stallion 64',
    summary: 'Ascii\'s Japan-only Nintendo 64 horse racing management simulation from the long-running Derby Stallion series tasks players with breeding and training thoroughbreds toward the Japanese Triple Crown, a beloved domestic franchise for horse racing strategy fans.',
  },
  {
    gameId: 'dezaemon-3d-nintendo-64',
    title: 'Dezaemon 3D',
    summary: 'Athena\'s Japan-only Nintendo 64 shoot-\'em-up creation tool extends the Dezaemon series\' player-built shooter concept into three dimensions, allowing players to design enemy patterns, stages, and bosses for custom 3D shooters in an advanced domestic creative platform.',
  },
  {
    gameId: 'doraemon-2-nobita-to-hikari-no-shinden-nintendo-64',
    title: 'Doraemon 2: Nobita to Hikari no Shinden',
    summary: 'Epoch\'s Japan-only Nintendo 64 action-adventure sequel in the Doraemon game series follows the robot cat and Nobita through a light-temple narrative, continuing the domestic licensed franchise for younger Japanese players on the 64-bit hardware.',
  },
  {
    gameId: 'doraemon-3-nobita-no-machi-sos-nintendo-64',
    title: 'Doraemon 3: Nobita no Machi SOS!',
    summary: 'Epoch\'s Japan-only Nintendo 64 third entry in the Doraemon adventure series sends the beloved robot cat through a town-based rescue narrative, continuing the domestic children\'s licensed franchise into the late N64 period.',
  },
  {
    gameId: 'doraemon-nobita-to-mittsu-no-seireiseki-nintendo-64',
    title: 'Doraemon: Nobita to Mittsu no Seireiseki',
    summary: 'Epoch\'s Japan-only Nintendo 64 action game based on the Doraemon franchise adapts the three spirit stones movie narrative into an adventure platformer, delivering the licensed children\'s property in 3D for the domestic Japanese audience.',
  },
  {
    gameId: 'eiko-no-saint-andrews-nintendo-64',
    title: 'Eiko no Saint Andrews',
    summary: 'T&E Soft\'s Japan-only Nintendo 64 golf simulation takes place at the iconic St Andrews Old Course in Scotland, offering a detailed representation of the historic links layout for Japanese golf simulation enthusiasts on the home console.',
  },
  {
    gameId: 'elmo-s-letter-adventure-nintendo-64',
    title: 'Elmo\'s Letter Adventure',
    summary: 'NewKidCo\'s Nintendo 64 educational game stars Sesame Street\'s Elmo in alphabet-learning activities designed for preschool-age players, using the Muppet character\'s familiar appeal to guide the youngest players through letter recognition and phonics games.',
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
          notes = 'G2 summary batch 47'
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
      'G2 summary batch 47'
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
    ) VALUES (?, 'g2_summary_batch_47', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 47 — N64 wave 1')

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
  const runKey = `g2-summary-batch-47-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 47 applied locally on staging sqlite',
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
