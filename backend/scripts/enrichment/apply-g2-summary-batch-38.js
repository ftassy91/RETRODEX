#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Nintendo Entertainment System — wave 1 (A through M range, French-placeholder replacements)
  {
    gameId: 'adventures-of-lolo-nintendo-entertainment-system',
    title: 'Adventures of Lolo',
    summary: "HAL Laboratory's 1989 NES puzzle game guides a round blue character through single-screen rooms by pushing blocks to neutralize enemies and reach the heart container, a compact and methodical puzzle game that formed the foundation of the Lolo sub-series and HAL's puzzle design identity.",
  },
  {
    gameId: 'batman-nintendo-entertainment-system',
    title: 'Batman',
    summary: "Sunsoft's 1989 NES action platformer based on the Tim Burton film is widely regarded as one of the finest NES movie tie-ins, with precise wall-jumping mechanics, a memorable Naoki Kodaka soundtrack, and a difficulty curve calibrated for skilled players.",
  },
  {
    gameId: 'battletoads-nintendo-entertainment-system',
    title: 'Battletoads',
    summary: "Rare's 1991 NES brawler-platformer is one of the most difficult games on the platform, featuring morphing attack animations, a notorious speeder bike stage, and aggressive enemy AI that made completion a genuine achievement even for experienced NES players.",
  },
  {
    gameId: 'bionic-commando-nintendo-entertainment-system',
    title: 'Bionic Commando',
    summary: "Capcom's 1988 NES action game distinguishes itself by removing jumping entirely, forcing players to navigate vertical terrain exclusively through a bionic grappling arm that swings and latches across gaps, a mechanical constraint that required precision movement mastery.",
  },
  {
    gameId: 'castlevania-iii-draculas-curse-nintendo-entertainment-system',
    title: "Castlevania III: Dracula's Curse",
    summary: "Konami's 1989 NES action game prequel features branching routes and four playable characters with distinct abilities including Grant's wall-climbing and Sypha's magic, expanding the series formula and delivering some of the platform's most technically accomplished music through Konami's custom VRC6 audio chip.",
  },
  {
    gameId: 'chip-n-dale-rescue-rangers-nintendo-entertainment-system',
    title: "Chip 'N Dale Rescue Rangers",
    summary: "Capcom's 1990 NES platformer based on the Disney cartoon features two-player co-op where characters can pick up boxes, enemies, and each other as projectiles, a well-designed licensed game that stood out for its cooperative mechanics in the NES library.",
  },
  {
    gameId: 'darkwing-duck-nintendo-entertainment-system',
    title: 'Darkwing Duck',
    summary: "Capcom's 1992 NES platformer based on the Disney television series applies Mega Man-style movement and combat to the caped crime-fighter Darkwing Duck, producing one of the better late-era NES licensed platformers with solid stage variety and tight controls.",
  },
  {
    gameId: 'double-dragon-nintendo-entertainment-system',
    title: 'Double Dragon',
    summary: "Technos Japan's 1988 NES port of the beloved arcade beat-'em-up follows brothers Billy and Jimmy Lee rescuing Marian from the Black Warriors gang, a landmark co-op brawler whose NES port adapted the coin-op's two-player simultaneous mode to single-player with limited cooperation.",
  },
  {
    gameId: 'duck-hunt-nintendo-entertainment-system',
    title: 'Duck Hunt',
    summary: "Nintendo's 1984 NES Zapper light-gun game challenges players to shoot ducks across a series of shooting gallery stages with a laughing dog as foil for missed shots, a landmark pack-in title that demonstrated the NES peripheral ecosystem and sold over 28 million copies.",
  },
  {
    gameId: 'duck-tales-2-nintendo-entertainment-system',
    title: 'DuckTales 2',
    summary: "Capcom's 1993 NES platformer sequel sends Scrooge McDuck pogo-cane-jumping through five new treasure-hunting stages including Niagara Falls and a restored Bermuda Triangle, a late NES release that refined the original's mechanics with improved level design and additional puzzle elements.",
  },
  {
    gameId: 'excitebike-nintendo-entertainment-system',
    title: 'Excitebike',
    summary: "Nintendo's 1984 NES launch title is a side-scrolling motocross racer with a turbo system requiring heat management and a track editor that let players design custom courses, one of the platform's earliest releases and a foundational NES design demonstrating Nintendo's sports game philosophy.",
  },
  {
    gameId: 'faxanadu-nintendo-entertainment-system',
    title: 'Faxanadu',
    summary: "Hudson's 1987 NES action RPG is a side-scrolling dungeon crawler set in the world of Xanadu with shops, magic spells, and platforming exploration across a dying elf world tree, a console-adapted spinoff of Nihon Falcom's Dragon Slayer series built for the Famicom.",
  },
  {
    gameId: 'final-fantasy-nintendo-entertainment-system',
    title: 'Final Fantasy',
    summary: "Square's 1987 NES RPG launched one of gaming's most enduring franchises with four Warriors of Light restoring the elemental crystals in a turn-based class-based party system, a title that saved Square from bankruptcy and established the JRPG template for the generation that followed.",
  },
  {
    gameId: 'final-fantasy-ii-nintendo-entertainment-system',
    title: 'Final Fantasy II',
    summary: "Square's 1988 Famicom RPG replaced character classes with a usage-based stat growth system where abilities improved through repeated use in combat, a radically experimental follow-up to the original that introduced recurring characters and remained Japan-only until later remake releases.",
  },
  {
    gameId: 'final-fantasy-iii-nintendo-entertainment-system',
    title: 'Final Fantasy III',
    summary: "Square's 1990 Famicom RPG introduced the Job System allowing flexible class switching between battles across an entire party, the most mechanically ambitious NES-era Final Fantasy that remained Japan-only until a 2006 DS remake brought it to Western audiences for the first time.",
  },
  {
    gameId: 'ghosts-n-goblins-nintendo-entertainment-system',
    title: "Ghosts 'n Goblins",
    summary: "Capcom's 1986 NES port of the arcade action game sends knight Arthur through undead-filled stages in two-hit death mechanics and a cruel final revelation requiring a second playthrough, a foundational difficult action game that influenced the design philosophy of decades of challenging platformers.",
  },
  {
    gameId: 'gremlins-2-the-new-batch-nintendo-entertainment-system',
    title: 'Gremlins 2: The New Batch',
    summary: "Sunsoft's 1990 NES platformer based on the Gremlins sequel is regarded as one of the NES library's most polished licensed games, featuring fluid animation, multiple playable stages through the Clamp Center tower, and production quality that exceeded most contemporary NES film adaptations.",
  },
  {
    gameId: 'ice-climber-nintendo-entertainment-system',
    title: 'Ice Climber',
    summary: "Nintendo's 1984 NES vertical platformer sends Popo and Nana upward through icy mountain stages by breaking through ice floors and avoiding polar bears and condors, a Famicom launch title notable for its two-player simultaneous co-op and as the source of two Super Smash Bros. fighters.",
  },
  {
    gameId: 'life-force-nintendo-entertainment-system',
    title: 'Life Force',
    summary: "Konami's 1988 NES shooter adapts the Salamander arcade game as a companion piece to Gradius with alternating horizontal and vertical stages through a biological spacecraft, featuring two-player simultaneous co-op and the Gradius power-up system in its North American release.",
  },
  {
    gameId: 'little-samson-nintendo-entertainment-system',
    title: 'Little Samson',
    summary: "Taito's 1992 NES action platformer is one of the rarest and most sought-after late-NES titles, featuring a bell-swinging hero whose harmonics dispatch enemies and activate platforms across meticulously designed stages with production values near the hardware's ceiling.",
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
          notes = 'G2 summary batch 38'
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
      'G2 summary batch 38'
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
    ) VALUES (?, 'g2_summary_batch_38', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 38 — NES wave 1 (A-M range)')

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
  const runKey = `g2-summary-batch-38-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 38 applied locally on staging sqlite',
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
