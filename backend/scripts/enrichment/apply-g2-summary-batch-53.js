#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // PlayStation — final gap closers
  {
    gameId: '3-3-eyes-tenrin-o-genmu-playstation',
    title: "3×3 Eyes Tenrin' ō Genmu",
    summary: "Banpresto's PS1 action RPG adaptation of the 3×3 Eyes manga follows Pai and Yakumo through demon-filled stages, a Japan-only release that continued the franchise's anime-game crossover presence on home hardware.",
  },
  {
    gameId: '3-3-eyes-kyusei-koshu-playstation',
    title: '3×3 Eyes: Kyūsei Kōshu',
    summary: "Banpresto's second PS1 entry in the 3×3 Eyes series continues the action RPG adaptation of the Yuzo Takada manga, remaining Japan-only and targeting fans of the supernatural horror story and its animated adaptations.",
  },
  {
    gameId: '4-4-2-soccer-playstation',
    title: '4-4-2 Soccer',
    summary: "Psygnosis' PS1 football title adopts a formation-focused approach to the sport, emphasizing tactical setup over arcade pace in a licensed title that competed alongside the era's dominant FIFA and ISS franchises.",
  },
  {
    gameId: 'angel-devoid-face-of-the-enemy-playstation',
    title: 'Angel Devoid: Face of the Enemy',
    summary: "Electric Dreams' PS1 FMV adventure places the player as an alien investigator in a dystopian 2019 Los Angeles, combining live-action footage with branching interrogation sequences in a noir-inflected interactive movie format.",
  },
  {
    gameId: 'archer-maclean-s-3d-pool-playstation',
    title: "Archer MacLean's 3D Pool",
    summary: "Archer MacLean's PS1 pool simulation brings the designer's long-running billiards franchise into three dimensions with accurate physics and multiple game variants, targeting dedicated pool simulation fans on the platform.",
  },
  // Sega Saturn — final gap closers
  {
    gameId: '10-yard-fight-sega-saturn',
    title: '10-Yard Fight',
    summary: "Irem's Saturn port of the classic American football arcade game delivers the early grid-iron formula to the 32-bit platform, a Japan-only release in a series that dates back to the 1983 arcade original.",
  },
  {
    gameId: '3d-baseball-sega-saturn',
    title: '3D Baseball',
    summary: "Stormfront Studios' Saturn baseball simulation was one of the earliest 3D baseball titles on the platform, offering full polygonal stadiums and players in a format that pushed the hardware's capabilities for sports realism.",
  },
  {
    gameId: '3-3-eyes-kyusei-koshu-sega-saturn',
    title: '3×3 Eyes: Kyūsei Kōshu',
    summary: "Banpresto's Saturn action RPG adaptation of the 3×3 Eyes supernatural manga remains Japan-only, following the franchise's console presence with demon-slaying stages built around the source material's mythology.",
  },
  {
    gameId: 'actua-golf-sega-saturn',
    title: 'Actua Golf',
    summary: "Gremlin Interactive's Saturn golf simulation was part of the Actua sports series that brought motion-captured athletes and 3D courses to the platform, offering a realistic alternative to the era's more arcade-focused golf titles.",
  },
  {
    gameId: 'actua-soccer-sega-saturn',
    title: 'Actua Soccer',
    summary: "Gremlin Interactive's Saturn football title used motion-captured player animations and 3D pitches to compete with ISS and FIFA, launching the Actua Sports brand as a simulation-focused alternative in the mid-1990s console football market.",
  },
  {
    gameId: 'all-star-baseball-97-sega-saturn',
    title: "All-Star Baseball '97",
    summary: "Iguana Entertainment's Saturn baseball title with an official MLB license delivers a full season mode with authentic team and player rosters from the 1997 season, targeting North American sports fans on the platform.",
  },
  {
    gameId: 'angelique-special-2-sega-saturn',
    title: 'Angelique Special 2',
    summary: "Koei's Saturn otome game sequel expands the original romance simulation with new Guardian characters and additional story routes, remaining Japan-only and targeting the female-oriented romance game market that Angelique helped establish.",
  },
  {
    gameId: 'arthur-to-astaroth-no-nazomakaimura-incredible-toons-sega-saturn',
    title: 'Arthur to Astaroth no Nazomakaimura: Incredible Toons',
    summary: "Capcom's Japan-only Saturn title blends the Ghosts 'n Goblins universe with Incredible Machine-style physics puzzles, casting Arthur in Rube Goldberg contraption challenges rather than the action-platformer combat of the main series.",
  },
  {
    gameId: 'baldies-sega-saturn',
    title: 'Baldies',
    summary: "Creative Edge's Saturn real-time strategy game pits bald-headed humanoids against hairy opponents in territory-control battles, combining god-game population mechanics with light combat in a comedic presentation aimed at accessible strategy players.",
  },
  {
    gameId: 'bases-loaded-96-double-header-sega-saturn',
    title: "Bases Loaded '96: Double Header",
    summary: "Jaleco's Saturn baseball entry in the long-running Bases Loaded series updates the franchise for 32-bit hardware with full 3D stadiums, bringing the NES-era baseball brand into the fifth generation with an official MLB license.",
  },
  {
    gameId: 'battle-arena-toshinden-ultimate-revenge-attack-sega-saturn',
    title: 'Battle Arena Toshinden Ultimate Revenge Attack',
    summary: "Tamsoft's Japan-only Saturn update of the 3D weapon-fighter adds new characters and gameplay refinements to the original Toshinden formula, releasing exclusively in Japan as a revised edition of the platform's early 3D fighting showcase.",
  },
  {
    gameId: 'battle-stations-sega-saturn',
    title: 'Battle Stations',
    summary: "Atari's Saturn naval combat strategy game places players in command of World War II warships across mission-based engagements, combining real-time tactical ship management with the platform's hardware to deliver accessible military simulation.",
  },
  {
    gameId: 'black-fire-sega-saturn',
    title: 'Black Fire',
    summary: "Zeppelin's Saturn helicopter combat title sends pilots through third-person gunship missions in diverse terrain environments, an early 32-bit action game occupying the aerial combat space before more fully realized entries defined the genre on the platform.",
  },
  {
    gameId: 'blue-seed-the-secret-records-of-kushinada-sega-saturn',
    title: 'Blue Seed: The Secret Records of Kushinada',
    summary: "Banpresto's Japan-only Saturn visual novel and adventure game adapts the Blue Seed anime and manga, following Momiji Kushinada through supernatural encounters with Aragami in a story-driven format aimed at fans of the source material.",
  },
  {
    gameId: 'cat-the-ripper-13-ninme-no-tanteishi-sega-saturn',
    title: 'Cat the Ripper: 13-ninme no Tanteishi',
    summary: "Asmik Ace's Japan-only Saturn mystery adventure follows a female detective through a serial murder investigation in modern Tokyo, presenting a visual novel-style narrative with branching dialogue sequences in the tradition of Japanese mystery games.",
  },
  {
    gameId: 'choro-q-park-sega-saturn',
    title: 'Choro Q Park',
    summary: "Takara's Saturn entry in the Choro Q toy car franchise delivers racing and exploration gameplay across theme-park-styled environments, targeting younger players with its accessible design built around the popular Japanese pull-back toy car brand.",
  },
  {
    gameId: 'congo-the-movie-the-lost-city-of-zinj-sega-saturn',
    title: 'Congo The Movie: The Lost City of Zinj',
    summary: "Viacom New Media's Saturn tie-in to the 1995 Michael Crichton film adaptation blends first-person shooter sequences with puzzle-solving in the jungle ruins, capturing the film's jungle expedition premise in an action format.",
  },
  {
    gameId: 'crimewave-sega-saturn',
    title: 'CrimeWave',
    summary: "Take-Two Interactive's Saturn top-down action game places a vigilante through crime-ridden urban environments in an isometric shooter format, an early 32-bit release drawing from the tradition of overhead crime-fighting arcade games.",
  },
  {
    gameId: 'cyber-doll-sega-saturn',
    title: 'Cyber Doll',
    summary: "Human Entertainment's Japan-only Saturn title blends life simulation with a sci-fi narrative about an android companion, offering interaction systems and a story-driven format in the tradition of Japanese virtual pet and dating simulation hybrids.",
  },
  {
    gameId: 'daisenryaku-sega-saturn',
    title: 'Daisenryaku',
    summary: "SystemSoft's Saturn entry in the long-running Daisenryaku hex-grid wargame series offers deep turn-based World War II operational-level strategy for dedicated wargaming enthusiasts, remaining Japan-only in a franchise that rarely crossed to Western markets.",
  },
  {
    gameId: 'daytona-usa-c-c-e-net-link-edition-sega-saturn',
    title: 'Daytona USA C.C.E. Net Link Edition',
    summary: "Sega's enhanced Saturn version of the arcade racing classic adds the Championship Circuit Edition content alongside Net Link modem multiplayer support, bringing online racing capability to the platform's premier oval circuit title.",
  },
  {
    gameId: 'defcon-5-sega-saturn',
    title: 'Defcon 5',
    summary: "Millennium Interactive's Saturn first-person strategy hybrid places the player in command of a defense installation under alien attack, blending base management with direct combat sequences across a 1990s PC port brought to the 32-bit platform.",
  },
  {
    gameId: 'densha-de-go-sega-saturn',
    title: 'Densha de Go!',
    summary: "Taito's Saturn port of the 1996 arcade train driving simulation tasks players with operating Japanese rail lines on schedule, pioneering the precision train operation genre that would become a long-running franchise across multiple platforms.",
  },
  {
    gameId: 'derby-stallion-sega-saturn',
    title: 'Derby Stallion',
    summary: "ASCII's Japan-only Saturn horse racing simulation lets players breed, train, and race thoroughbreds through a full seasonal calendar, continuing the popular Derby Stallion franchise that became one of Japan's most enduring horse racing game series.",
  },
  {
    gameId: 'discworld-ii-missing-presumed-sega-saturn',
    title: 'Discworld II: Missing Presumed...!?',
    summary: "Perfect Entertainment's Saturn sequel to the Discworld point-and-click adventure sends Rincewind on a quest to bring Death back after he goes on holiday, featuring Terry Pratchett's satirical humor with Eric Idle reprising his voice role.",
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
          notes = 'G2 summary batch 53'
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
      'G2 summary batch 53'
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
    ) VALUES (?, 'g2_summary_batch_53', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 53 — PS1 final + Saturn final gap closers')

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
  const runKey = `g2-summary-batch-53-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 53 applied locally on staging sqlite',
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
