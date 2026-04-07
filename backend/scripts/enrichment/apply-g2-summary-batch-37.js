#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  // PlayStation — wave 8 (N through Z range, French-placeholder replacements)
  {
    gameId: 'oddworld-abes-oddysee-playstation',
    title: "Oddworld: Abe's Oddysee",
    summary: "Oddworld Inhabitants' 1997 PlayStation cinematic platformer follows Abe, a Mudokon slave escaping a meat-processing factory by possessing enemies and guiding fellow workers to exits, a darkly comedic puzzle-platformer renowned for its fart-based communication mechanic and ecological satire.",
  },
  {
    gameId: 'omega-boost-playstation',
    title: 'Omega Boost',
    summary: "Polyphony Digital's 1999 PlayStation mecha rail shooter puts a giant robot through time-traveling space combat missions against the Kette artificial intelligence, a technically polished 3D shooter from the Gran Turismo developer showcasing the PS1's visual ceiling.",
  },
  {
    gameId: 'parasite-eve-playstation',
    title: 'Parasite Eve',
    summary: "Square's 1998 PlayStation RPG blends survival horror atmosphere with ATB-style combat as NYPD officer Aya Brea confronts mitochondrial mutations in New York, a cinematic genre hybrid adapting Hideaki Sena's novel that spawned a franchise and defined the 'cinematic RPG' label.",
  },
  {
    gameId: 'point-blank-playstation',
    title: 'Point Blank',
    summary: "Namco's 1994 PlayStation port of the arcade light-gun mini-game collection replaces the GunCon peripheral with analog aiming across dozens of target-shooting and object-discrimination stages, a party-focused multi-player game built entirely around precision shooting challenges.",
  },
  {
    gameId: 'rayman-playstation',
    title: 'Rayman',
    summary: "Ubi Pictures' 1995 PlayStation platformer launched the Rayman franchise with a limbless hero whose fists, feet, and helicopter hair detach to attack across pre-rendered fantasy stages, a technically ambitious debut that stood out for its absence of visible limb connections.",
  },
  {
    gameId: 'resident-evil-3-nemesis-playstation',
    title: 'Resident Evil 3: Nemesis',
    summary: "Capcom's 1999 PlayStation survival horror game follows STARS officer Jill Valentine escaping Raccoon City while being stalked by the adaptive B.O.W. Nemesis, adding a dodge mechanic and dynamic branching story decisions to the fixed-camera formula established in the original.",
  },
  {
    gameId: 'soul-blade-playstation',
    title: 'Soul Blade',
    summary: "Namco's 1996 PlayStation weapon-based 3D fighter is the first entry in the Soulcalibur series, offering eight-way movement and character-specific weapon durability in a quest mode that provided individual story arcs for each fighter seeking the legendary sword Soul Edge.",
  },
  {
    gameId: 'spyro-2-riptos-rage-playstation',
    title: "Spyro 2: Ripto's Rage!",
    summary: "Insomniac Games' 1999 PlayStation 3D platformer sequel expanded Spyro's world with hub-based realm exploration, NPC quest objectives, and Ripto as the primary antagonist after Gnasty Gnorc, refining the collectathon structure into a more narrative-driven adventure.",
  },
  {
    gameId: 'spyro-the-dragon-playstation',
    title: 'Spyro the Dragon',
    summary: "Insomniac Games' 1998 PlayStation 3D platformer introduced the purple dragon Spyro through six homeworlds of gem-collecting and dragon-freeing stages, a technical feat whose seamless level streaming and 30fps performance demonstrated PS1 3D capabilities rivaling N64 platformers.",
  },
  {
    gameId: 'spyro-year-of-the-dragon-playstation',
    title: 'Spyro: Year of the Dragon',
    summary: "Insomniac Games' 2000 PlayStation platformer concluded the original trilogy by adding playable dragon eggs with alternate characters including a kangaroo, a cheetah, and a yeti, while Spyro recovered stolen dragon eggs from the Sorceress in a 117-egg collectathon finale.",
  },
  {
    gameId: 'street-fighter-alpha-2-playstation',
    title: 'Street Fighter Alpha 2',
    summary: "Capcom's 1996 PlayStation port of the arcade fighter added new custom combo mechanics, alternate costume colors, and expanded roster over the original Alpha, delivering a comprehensive home conversion of Capcom's prequel-era Street Fighter with extra World Warrior mode content.",
  },
  {
    gameId: 'suikoden-playstation',
    title: 'Suikoden',
    summary: "Konami's 1995 PlayStation RPG collects 108 Stars of Destiny across a revolution-against-empire narrative with six-character parties and strategic castle management, a compact JRPG that established a beloved franchise built on army-scale political storytelling.",
  },
  {
    gameId: 'suikoden-ii-playstation',
    title: 'Suikoden II',
    summary: "Konami's 1998 PlayStation RPG expanded the Stars of Destiny formula across a war between city-states with a deeply personal narrative of friendship, betrayal, and political manipulation, widely regarded as the series peak and among the finest story-driven JRPGs on the platform.",
  },
  {
    gameId: 'syphon-filter-playstation',
    title: 'Syphon Filter',
    summary: "Eidetic's 1999 PlayStation stealth-action game follows government agent Gabe Logan hunting a bioweapon conspiracy across third-person cover-based missions, a technically polished PS1-exclusive espionage game that launched a long-running Sony first-party franchise.",
  },
  {
    gameId: 'tenchu-stealth-assassins-playstation',
    title: 'Tenchu: Stealth Assassins',
    summary: "Acquire's 1998 PlayStation stealth-action game was among the first games to build a full mechanical system around stealth kill execution, placing ninja Rikimaru and Ayame through feudal Japan missions where silent takedowns and environmental awareness determined success.",
  },
  {
    gameId: 'legend-of-dragoon-playstation',
    title: 'The Legend of Dragoon',
    summary: "Sony Japan's 2000 PlayStation RPG follows war veteran Dart Feld discovering Dragoon transformation powers in a four-disc JRPG with a timed-hit 'Addition' combat system that rewarded precise button inputs during attack sequences alongside traditional ATB-style turn ordering.",
  },
  {
    gameId: 'threads-of-fate-playstation',
    title: 'Threads of Fate',
    summary: "Square's 2000 PlayStation action RPG offers two separate campaigns following a magic researcher and a princess seeking an ancient relic, with distinct combat styles and story perspectives that intersect without fully overlapping for a dual-narrative structure across a compact playtime.",
  },
  {
    gameId: 'tomb-raider-playstation',
    title: 'Tomb Raider',
    summary: "Core Design's 1996 PlayStation action-adventure launched Lara Croft as a cultural icon through tank-controlled 3D exploration across Egyptian tombs, Peruvian ruins, and Atlantean labyrinths, a landmark 3D adventure that sold over seven million copies and defined the PlayStation brand.",
  },
  {
    gameId: 'tony-hawks-pro-skater-2-playstation',
    title: "Tony Hawk's Pro Skater 2",
    summary: "Neversoft's 2000 PlayStation skateboarding game refined the original's two-minute run format with manual linking and a create-a-skater mode, widely considered the peak of the THPS series and among the most acclaimed PS1 games with a licensed soundtrack that defined a generation.",
  },
  {
    gameId: 'twisted-metal-2-playstation',
    title: 'Twisted Metal 2',
    summary: "SingleTrac's 1996 PlayStation vehicular combat game is the definitive entry in the series, pitting armored cars through international city arenas including Paris and Moscow in a demolition-derby format with character-specific special weapons and a dark wish-granting Calypso storyline.",
  },
  {
    gameId: 'um-jammer-lammy-playstation',
    title: 'Um Jammer Lammy',
    summary: "NanaOn-Sha's 1999 PlayStation rhythm game is a spin-off of PaRappa the Rapper starring guitar-playing lamb Lammy through surreal stages that included a firefighting band and a chainsaw surgery, extending the original's call-and-response button-timing system with a guitar framing.",
  },
  {
    gameId: 'wild-arms-playstation',
    title: 'Wild Arms',
    summary: "Media.Vision's 1996 PlayStation RPG set a fantasy western tone with gunslinger Rudy wielding ARMs weapons through turn-based dungeons on the dying world of Filgaia, a genre-blending JRPG that launched a series and offered an anime opening sequence before Square popularized the format.",
  },
  {
    gameId: 'wipeout-xl-playstation',
    title: 'Wipeout XL',
    summary: "Psygnosis' 1996 PlayStation anti-gravity racing sequel expanded the original's futuristic hover-craft formula with new tracks, weapons, and craft handling refinements, packaged with a Designers Republic visual identity and electronic music soundtrack that cemented Wipeout's style reputation.",
  },
  {
    gameId: 'xenogears-playstation',
    title: 'Xenogears',
    summary: "Square's 1998 PlayStation RPG follows Fei Fong Wong piloting mecha Gears through a densely layered philosophical narrative touching on Jungian psychology, Nietzsche, and Gnostic myth across a disc one that delivers a full RPG and a disc two that compresses the remainder into cutscene recaps.",
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
          notes = 'G2 summary batch 37'
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
      'G2 summary batch 37'
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
    ) VALUES (?, 'g2_summary_batch_37', 'apply', 'internal_curated', 'running', ?, ?, 0, 0, 0, 0, 0, 0, ?)
  `).run(runKey, dryRun ? 1 : 0, timestamp, 'G2 batch 37 — PS1 wave 8 (N-Z)')

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
  const runKey = `g2-summary-batch-37-${timestamp}`
  const runId = createRun(db, runKey, timestamp, false)
  const metrics = {
    itemsSeen: G2_BATCH.length,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFlagged: 0,
    notes: 'G2 summary batch 37 applied locally on staging sqlite',
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
