#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // Sega Genesis — wave 8 (N through Z range, French-placeholder replacements)
  {
    gameId: 'nba-jam-sega-genesis',
    title: 'NBA Jam',
    summary: "Acclaim's 1993 Genesis port of Midway's landmark two-on-two basketball arcade game brings the over-the-top dunking, on-fire streak mechanic, and unlockable celebrity roster to the home console in a conversion that captured most of the arcade title's frantic energy.",
  },
  {
    gameId: 'pac-man-2-the-new-adventures-sega-genesis',
    title: 'Pac-Man 2: The New Adventures',
    summary: "Namco's 1994 Genesis game abandons traditional maze-eating for an indirect adventure where players guide Pac-Man through side-scrolling stages using a slingshot to point his attention, a bizarre genre departure that functioned more like a graphical adventure than an action game.",
  },
  {
    gameId: 'quackshot-sega-genesis',
    title: 'QuackShot',
    summary: "Sega's 1991 Genesis platformer stars Donald Duck on a globe-trotting treasure hunt, using a plunger gun that sticks to surfaces or stuns enemies across international stages in a non-linear adventure format that predated many later open-progression platformers.",
  },
  {
    gameId: 'ristar-sega-genesis',
    title: 'Ristar',
    summary: "Sega's 1995 Genesis platformer gives its star-shaped hero extending arms for grabbing, climbing, and hurling enemies rather than jumping on them, a late-era Genesis showcase that demonstrated polished original design even as the platform's commercial window was closing.",
  },
  {
    gameId: 'shining-force-sega-genesis',
    title: 'Shining Force',
    summary: "Camelot's 1992 Genesis tactical RPG pioneered accessible grid-based strategy with a party of warriors, mages, and centaurs advancing through a fantasy continent, an entry point into the strategy RPG genre that balanced Fire Emblem-style positioning with approachable mechanics.",
  },
  {
    gameId: 'shining-force-ii-sega-genesis',
    title: 'Shining Force II',
    summary: "Camelot's 1993 Genesis tactical RPG sequel expanded the original's formula with a larger world map exploration, branching promotion paths, and a longer campaign, refining the accessible grid-combat design into what many consider the peak of the 16-bit strategy RPG form.",
  },
  {
    gameId: 'shinobi-iii-sega-genesis',
    title: 'Shinobi III',
    summary: "Sega's 1993 Genesis action game is widely regarded as the series' best entry, giving ninja Joe Musashi new movement abilities including wall-running and surfing alongside precise shuriken and sword combat across colorful stages with exceptional soundtrack work.",
  },
  {
    gameId: 'sonic-knuckles-sega-genesis',
    title: 'Sonic & Knuckles',
    summary: "Sega's 1994 Genesis platformer introduced the lock-on cartridge system, letting players attach Sonic 3 or Sonic 2 to combine games, while delivering its own full Knuckles campaign with gliding and wall-climbing abilities that added a second perspective to the Sonic 3 world.",
  },
  {
    gameId: 'sonic-3d-blast-sega-genesis',
    title: 'Sonic 3D Blast',
    summary: "Traveller's Tales' 1996 Genesis isometric platformer places Sonic in a pre-rendered three-quarter perspective to rescue Flickies across themed zones, a late-era Genesis title that traded the series' speed for collectathon structure as Sega transitioned attention to Saturn.",
  },
  {
    gameId: 'sonic-spinball-sega-genesis',
    title: 'Sonic Spinball',
    summary: "Sega Technical Institute's 1993 Genesis pinball-platformer converts Sonic into a ball bouncing through flipper-driven stages inside Dr. Robotnik's fortress, a creative genre hybrid that translated the ball-rolling physics of pinball into a Sonic-universe action game.",
  },
  {
    gameId: 'sonic-the-hedgehog-3-sega-genesis',
    title: 'Sonic the Hedgehog 3',
    summary: "Sega's 1994 Genesis platformer introduced Knuckles as an antagonist and added shield power-ups with elemental properties across interconnected zones, designed as the first half of a larger game that completed when locked on with Sonic & Knuckles.",
  },
  {
    gameId: 'spider-man-vs-the-kingpin-sega-genesis',
    title: 'Spider-Man vs. The Kingpin',
    summary: "Sega's 1991 Genesis action-platformer lets Spider-Man swing and crawl through Manhattan while collecting bomb components from Marvel villains hired by the Kingpin, an early 16-bit licensed superhero game notable for web-slinging traversal and a ticking-clock story structure.",
  },
  {
    gameId: 'splatterhouse-2-sega-genesis',
    title: 'Splatterhouse 2',
    summary: "Namco's 1992 Genesis sequel continues Rick's hockey-masked horror brawl through grotesque monster-filled stages, a graphically violent beat-'em-up that pushed the Genesis hardware with detailed gore effects and earned its place as a definitive adult-oriented Genesis exclusive.",
  },
  {
    gameId: 'streets-of-rage-sega-genesis',
    title: 'Streets of Rage',
    summary: "Sega's 1991 Genesis beat-'em-up launched one of the platform's defining franchises with three playable ex-cops cleaning up a crime-controlled city, establishing the series' signature call-for-backup special moves and Yuzo Koshiro's influential electronic soundtrack.",
  },
  {
    gameId: 'streets-of-rage-3-sega-genesis',
    title: 'Streets of Rage 3',
    summary: "Sega's 1994 Genesis brawler introduced multiple endings, dashing moves, and a faster combat tempo to the series alongside a controversial localization that altered story content from the Japanese Bare Knuckle III, a divisive final Genesis entry in the franchise.",
  },
  {
    gameId: 'tmnt-the-hyperstone-heist-sega-genesis',
    title: 'TMNT: The Hyperstone Heist',
    summary: "Konami's 1992 Genesis exclusive Teenage Mutant Ninja Turtles brawler used different stage layouts from the SNES Turtles in Time while sharing its core four-turtle side-scrolling beat-'em-up combat, a solid Genesis-exclusive co-op action game in the Konami TMNT lineage.",
  },
  {
    gameId: 'the-revenge-of-shinobi-sega-genesis',
    title: 'The Revenge of Shinobi',
    summary: "Sega's 1989 Genesis action game established the modern Shinobi template with precise sword and shuriken combat, a magic system, and an iconic Yuzo Koshiro soundtrack, a landmark early Genesis title whose cameo bosses and tight mechanics defined the ninja genre on 16-bit hardware.",
  },
  {
    gameId: 'story-of-thor-sega-genesis',
    title: 'The Story of Thor',
    summary: "Ancient's 1994 Genesis action RPG follows a young warrior awakening ancient spirit creatures to defeat the evil Amon in a Zelda-influenced top-down adventure, a polished late-era Genesis RPG that received acclaim in Europe and Japan but limited North American visibility.",
  },
  {
    gameId: 'toejam-and-earl-sega-genesis',
    title: 'ToeJam & Earl',
    summary: "Johnson Voorsanger Productions' 1991 Genesis roguelike follows two alien rappers stranded on Earth hunting ship parts across randomized scrolling levels, an eccentric design outlier that became a cult Genesis classic for its cooperative play and laid-back funky personality.",
  },
  {
    gameId: 'truxton-sega-genesis',
    title: 'Truxton',
    summary: "Toaplan's 1990 Genesis port of the 1988 arcade vertical shoot-'em-up delivers relentless bullet patterns across space-set stages with three weapon types and a powerful bomb, a demanding early Genesis shmup that preserved the coin-op's arcade intensity for home players.",
  },
  {
    gameId: 'vectorman-sega-genesis',
    title: 'Vectorman',
    summary: "BlueSky Software's 1995 Genesis run-and-gun stars a trash-collecting robot through pre-rendered sprite environments with fluid animation technically showcasing late-era Genesis capabilities, a platform exclusive that rivaled SNES Mode 7 effects in visual ambition.",
  },
  {
    gameId: 'world-of-illusion-sega-genesis',
    title: 'World of Illusion',
    summary: "Sega's 1992 Genesis platformer stars Mickey Mouse and Donald Duck navigating a magician's conjured world with character-specific routes for solo or cooperative play, a technically impressive Disney platformer with distinct path designs depending on which character or mode is chosen.",
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
          notes = 'G2 summary batch 35'
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
      'G2 summary batch 35'
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
    ) VALUES (?, 'g2_summary_batch_35', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 35 — Genesis wave 8 (N-Z)')

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
  const runKey = `g2-summary-batch-35-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 35 applied locally on staging sqlite',
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
