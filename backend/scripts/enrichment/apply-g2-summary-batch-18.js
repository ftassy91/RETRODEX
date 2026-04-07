#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  {
    gameId: "adventure-island-ii-game-boy",
    title: "Adventure Island II",
    summary: "Hudson's Game Boy sequel follows Master Higgins through a new island set with additional dinosaur companions and improved platformer mechanics, carrying forward the food-depleting health system and rapid-pace stage design of the original portable entry.",
  },
  {
    gameId: "alfred-chicken-game-boy",
    title: "Alfred Chicken",
    summary: "Mindscape's Game Boy platformer follows a chicken hero through stages clearing balloons and enemies with his pecking beak, offering a compact British-developed handheld game with cheerful platformer mechanics and a distinctive avian protagonist.",
  },
  {
    gameId: "asterix-game-boy",
    title: "Asterix",
    summary: "Infogrames' Game Boy adaptation follows the Gaulish warrior through side-scrolling combat stages against Roman legions, compressing the licensed platformer format of the console Asterix games into a monochrome handheld structure.",
  },
  {
    gameId: "battle-city-game-boy",
    title: "Battle City",
    summary: "Namco's Game Boy port of the 1985 Famicom/NES tank arcade game preserves the top-down base-defense shooting formula, placing a tank through waves of enemy armor in a single-screen combat structure well-suited to handheld play.",
  },
  {
    gameId: "beetlejuice-game-boy",
    title: "Beetlejuice",
    summary: "LJN's Game Boy platformer adapts Tim Burton's eccentric ghost character through side-scrolling stages using the bio-exorcist's supernatural tricks, targeting the film and animated series' audience with a licensed compact handheld adventure.",
  },
  {
    gameId: "bill-ted-s-excellent-game-boy-adventure-a-bogus-journey-game-boy",
    title: "Bill & Ted's Excellent Game Boy Adventure: A Bogus Journey!",
    summary: "LJN's Game Boy game based on the 1991 film sequel sends Bill and Ted through time-traveling side-scrolling stages collecting items, adapting the comedy duo's phone-booth adventures to a portable licensed format.",
  },
  {
    gameId: "boxxle-game-boy",
    title: "Boxxle",
    summary: "Pony Canyon's Game Boy port of the classic Sokoban warehouse puzzle game tasks players with pushing boxes onto marked targets across progressively complex floor layouts, delivering the definitive portable version of the foundational push-puzzle format.",
  },
  {
    gameId: "bram-stoker-s-dracula-game-boy",
    title: "Bram Stoker's Dracula",
    summary: "Sony Imagesoft's Game Boy adaptation of the 1992 Coppola film delivers side-scrolling combat against vampires through castle environments, condensing the console versions' action structure into a monochrome handheld format tied to the prestige horror film.",
  },
  {
    gameId: "catrap-game-boy",
    title: "Catrap",
    summary: "Asmik's Game Boy puzzle game is a port of the 1985 MSX game Pitman, featuring a boy and girl who traverse grid stages by pushing enemies into corners and can rewind any number of moves — an early rewind mechanic preceding its modern revival.",
  },
  {
    gameId: "cave-noire-game-boy",
    title: "Cave Noire",
    summary: "Konami's Japan-only Game Boy roguelike sends an adventurer through procedurally generated dungeons collecting treasures, notable as a 1991 handheld roguelike that predates the genre's mainstream visibility by more than a decade.",
  },
  {
    gameId: "centipede-game-boy",
    title: "Centipede",
    summary: "Accolade's Game Boy adaptation of the Atari arcade classic brings the mushroom-filled shooter to the handheld, condensing the segmented bug descent and shooter mechanics of the 1980 original into a compact portable format.",
  },
  {
    gameId: "choplifter-ii-game-boy",
    title: "Choplifter II",
    summary: "Broderbund's Game Boy helicopter rescue game continues the hostage-retrieval mission structure of the original, tasking the pilot with navigating side-scrolling conflict zones to extract trapped civilians under fire.",
  },
  {
    gameId: "cliffhanger-game-boy",
    title: "Cliffhanger",
    summary: "Ocean's Game Boy action game adapts the 1993 Sylvester Stallone mountain-rescue thriller into a side-scrolling format following Gabe Walker through snowy alpine environments against terrorists, as a condensed portable tie-in to the action film.",
  },
  {
    gameId: "cosmo-tank-game-boy",
    title: "Cosmo Tank",
    summary: "Atlus' Game Boy RPG hybrid follows a pilot defending alien planets in a tank, blending overhead shooter stages with turn-based RPG battles in a genre combination unusual for the hardware that foreshadowed later portable RPG-shooter hybrids.",
  },
  {
    gameId: "daedalian-opus-game-boy",
    title: "Daedalian Opus",
    summary: "Vic Tokai's Game Boy puzzle game tasks players with fitting geometric pieces into outlined frames across increasingly complex layouts, a polished shape-fitting puzzle that stands among the original Game Boy library's most accomplished pure puzzle designs.",
  },
  {
    gameId: "daffy-duck-game-boy",
    title: "Daffy Duck",
    summary: "Ocean's Game Boy platformer follows Daffy Duck through side-scrolling stages using the Looney Tunes character's slapstick sensibility, adapting the Warner Bros. cartoon duck in a licensed compact handheld adventure.",
  },
  {
    gameId: "darkman-game-boy",
    title: "Darkman",
    summary: "Ocean's Game Boy adaptation of Sam Raimi's 1990 superhero film sends the disfigured vigilante through side-scrolling stages against criminal organizations, compressing the film's pulp action narrative into a monochrome handheld platformer.",
  },
  {
    gameId: "days-of-thunder-game-boy",
    title: "Days of Thunder",
    summary: "Mindscape's Game Boy racing game adapts the 1990 Tom Cruise NASCAR film into a top-down oval circuit racer, translating the stock car racing premise of the film into a compact handheld format with basic race management.",
  },
  {
    gameId: "deadeus-game-boy",
    title: "Deadeus",
    summary: "IZMA's 2019 Game Boy homebrew horror RPG gives the player seven days to prevent an apocalyptic nightmare vision, offering multiple branching endings and an oppressive atmosphere that demonstrates the original hardware's capacity for genuinely unsettling narrative.",
  },
  {
    gameId: "dick-tracy-game-boy",
    title: "Dick Tracy",
    summary: "Bandai's Game Boy adaptation of the 1990 Warren Beatty film sends the square-jawed detective through side-scrolling stages against gangsters, condensing the film's comic-strip aesthetic into a monochrome handheld action format.",
  },
  {
    gameId: "dino-breeder-game-boy",
    title: "Dino Breeder",
    summary: "Bandai's Japan-only Game Boy monster-raising game tasks players with hatching and training dinosaurs through feeding and battle sequences, serving as a precursor to the Tamagotchi-and-Pokémon era of creature-nurturing portable games.",
  },
  {
    gameId: "battle-unit-zeoth-game-boy",
    title: "Battle Unit Zeoth",
    summary: "Jaleco's Game Boy horizontal shooter places a spacecraft through alien-infested stages with power-up collecting and boss confrontations, offering an early example of the genre's compact portable format on the original Game Boy hardware.",
  },
  {
    gameId: "baseball-game-boy",
    title: "Baseball",
    summary: "Nintendo's Game Boy launch baseball title delivers a stripped-down version of the NES Baseball with simplified controls and a two-team roster, serving as the first handheld baseball game and a demonstration of the platform's sports game potential at launch.",
  },
  {
    gameId: "aerostar-game-boy",
    title: "Aerostar",
    summary: "Vic Tokai's Game Boy vertical shooter sends a spacecraft through scrolling asteroid and enemy waves, delivering a compact shoot-'em-up with a power-up accumulation system across a short campaign suited to handheld session play.",
  },
  {
    gameId: "atomic-punk-game-boy",
    title: "Atomic Punk",
    summary: "Hudson's Game Boy Bomberman variant — released as Atomic Punk in North America — maintains the maze-bomb gameplay of the franchise but replaces Bomberman's name and design, offering the core arena bomb formula in a compact early handheld format.",
  },
  {
    gameId: "cool-world-game-boy",
    title: "Cool World",
    summary: "Ocean's Game Boy adaptation of Ralph Bakshi's 1992 hybrid animated film follows detective Frank Harris through cartoon-world environments, translating the film's crossover premise into a side-scrolling action format for the monochrome handheld.",
  },
  {
    gameId: "block-hole-game-boy",
    title: "Block Hole",
    summary: "Kaneko's Game Boy puzzle-shooter hybrid tasks players with using a robot to clear blocks by shooting matches while avoiding hazards, combining a fixed-shooter perspective with a falling-block puzzle structure in a compact early handheld release.",
  },
  {
    gameId: "boxing-game-boy",
    title: "Boxing",
    summary: "Activision's Game Boy boxing game puts two fighters through a side-view punch exchange with stamina management, delivering a simplified version of the sport's competitive fundamentals in a compact handheld format for the original Game Boy.",
  },
  {
    gameId: "bubsy-2-game-boy",
    title: "Bubsy 2",
    summary: "Accolade's Game Boy port compresses the second 16-bit Bubsy platformer's stage design into the monochrome handheld format, following the wisecracking bobcat through side-scrolling environments as a portable entry in the controversial 90s mascot franchise.",
  },
  {
    gameId: "black-bass-lure-fishing-game-boy",
    title: "Black Bass: Lure Fishing",
    summary: "HOT-B's Game Boy fishing simulation adapts the console Black Bass series to the handheld with simplified lure selection and casting mechanics across lake environments, targeting the sportfishing audience with a compact portable fishing experience.",
  },
]

function nowIso() { return new Date().toISOString() }
function hashValue(v) { return crypto.createHash('sha256').update(String(v||'')).digest('hex') }

function ensureGameIds(db, payload) {
  const rows = db.prepare(`SELECT id FROM games WHERE id IN (${payload.map(()=>'?').join(', ')})`).all(...payload.map(e=>e.gameId))
  const ids = new Set(rows.map(r=>String(r.id)))
  const missing = payload.map(e=>e.gameId).filter(id=>!ids.has(id))
  if (missing.length) throw new Error('Missing target games in sqlite: ' + missing.join(', '))
}

function ensureSourceRecord(db, gameId, ts) {
  const ex = db.prepare(`SELECT id FROM source_records WHERE entity_type='game' AND entity_id=? AND field_name='summary' AND source_name='internal' AND source_type='knowledge_registry' ORDER BY id DESC LIMIT 1`).get(gameId)
  if (ex) { db.prepare(`UPDATE source_records SET compliance_status='approved', last_verified_at=?, confidence_level=0.8, notes='G2 summary batch 18' WHERE id=?`).run(ts, ex.id); return Number(ex.id) }
  const r = db.prepare(`INSERT INTO source_records (entity_type,entity_id,field_name,source_name,source_type,source_url,source_license,compliance_status,ingested_at,last_verified_at,confidence_level,notes) VALUES ('game',?,'summary','internal','knowledge_registry',NULL,NULL,'approved',?,?,0.8,'G2 summary batch 18')`).run(gameId, ts, ts)
  return Number(r.lastInsertRowid)
}

function ensureFieldProvenance(db, gameId, srcId, summary, ts) {
  const ex = db.prepare(`SELECT id FROM field_provenance WHERE entity_type='game' AND entity_id=? AND field_name='summary' ORDER BY id DESC LIMIT 1`).get(gameId)
  const vh = hashValue(summary)
  if (ex) { db.prepare(`UPDATE field_provenance SET source_record_id=?, value_hash=?, is_inferred=0, confidence_level=0.8, verified_at=? WHERE id=?`).run(srcId, vh, ts, ex.id); return false }
  db.prepare(`INSERT INTO field_provenance (entity_type,entity_id,field_name,source_record_id,value_hash,is_inferred,confidence_level,verified_at) VALUES ('game',?,'summary',?,?,0,0.8,?)`).run(gameId, srcId, vh, ts)
  return true
}

function upsertGameEditorialSummary(db, gameId, summary, srcId, ts) {
  db.prepare(`INSERT INTO game_editorial (game_id,summary,source_record_id,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(game_id) DO UPDATE SET summary=excluded.summary, source_record_id=excluded.source_record_id, updated_at=excluded.updated_at`).run(gameId, summary, srcId, ts, ts)
}

function createRun(db, runKey, ts, dry) {
  const r = db.prepare(`INSERT INTO enrichment_runs (run_key,pipeline_name,mode,source_name,status,dry_run,started_at,items_seen,items_created,items_updated,items_skipped,items_flagged,error_count,notes) VALUES (?,'g2_summary_batch_18','apply','internal_curated','running',?,?,0,0,0,0,0,0,'G2 batch 18 — Game Boy wave 2')`).run(runKey, dry?1:0, ts)
  return Number(r.lastInsertRowid)
}

function finalizeRun(db, runId, ts, m) {
  db.prepare(`UPDATE enrichment_runs SET status='completed', finished_at=?, items_seen=?, items_created=0, items_updated=?, items_skipped=?, items_flagged=?, error_count=0, notes=? WHERE id=?`).run(ts, m.itemsSeen, m.itemsUpdated, m.itemsSkipped, m.itemsFlagged, m.notes, runId)
}

function readBefore(db, payload) {
  const rows = db.prepare(`SELECT id, summary FROM games WHERE id IN (${payload.map(()=>'?').join(', ')})`).all(...payload.map(e=>e.gameId))
  return new Map(rows.map(r=>[String(r.id), String(r.summary||'')]))
}

function dryRun(db) {
  const before = readBefore(db, G2_BATCH)
  return { targetedGames: G2_BATCH.length, summaryUpdates: G2_BATCH.filter(e=>!before.get(e.gameId).trim()).length, targets: G2_BATCH.map(e=>({ gameId: e.gameId, title: e.title, hadSummaryBefore: Boolean(before.get(e.gameId).trim()) })) }
}

function applyBatch(db) {
  const ts = nowIso()
  const runKey = 'g2-summary-batch-18-' + ts
  const runId = createRun(db, runKey, ts, false)
  const m = { itemsSeen: G2_BATCH.length, itemsUpdated: 0, itemsSkipped: 0, itemsFlagged: 0, notes: 'G2 summary batch 18 applied locally on staging sqlite' }
  db.transaction(() => {
    for (const entry of G2_BATCH) {
      const srcId = ensureSourceRecord(db, entry.gameId, ts)
      db.prepare('UPDATE games SET summary=? WHERE id=?').run(entry.summary, entry.gameId)
      upsertGameEditorialSummary(db, entry.gameId, entry.summary, srcId, ts)
      ensureFieldProvenance(db, entry.gameId, srcId, entry.summary, ts)
      m.itemsUpdated++
    }
  })()
  finalizeRun(db, runId, nowIso(), m)
  return { runId, runKey, metrics: m }
}

function main() {
  const db = new Database(SQLITE_PATH)
  try {
    ensureGameIds(db, G2_BATCH)
    if (!APPLY) { console.log(JSON.stringify({ mode: 'dry-run', sqlitePath: SQLITE_PATH, summary: dryRun(db) }, null, 2)); return }
    console.log(JSON.stringify({ mode: 'apply', sqlitePath: SQLITE_PATH, summary: dryRun(db), result: applyBatch(db) }, null, 2))
  } finally { db.close() }
}

main()
