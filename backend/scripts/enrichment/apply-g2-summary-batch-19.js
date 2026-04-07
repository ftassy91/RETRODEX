#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  {
    gameId: "abadox-nes",
    title: "Abadox",
    summary: "Natsume's NES horizontal shooter sends a soldier inside a massive alien organism to rescue a swallowed princess, delivering a visceral biological horror aesthetic through densely patterned enemy formations and a grueling difficulty that defines the game's cult appeal.",
  },
  {
    gameId: "adventure-island-nes",
    title: "Adventure Island",
    summary: "Hudson's NES adaptation of Wonder Boy follows Master Higgins through tropical stages collecting fruit to sustain a health-draining timer, establishing the food-as-health mechanic that would define the franchise across multiple sequels.",
  },
  {
    gameId: "adventure-island-ii-nes",
    title: "Adventure Island II",
    summary: "Hudson's NES sequel improves on the original with rideable dinosaur companions and a selectable stage structure, expanding the fruit-collecting platformer loop into a more varied tropical adventure across eight distinct island worlds.",
  },
  {
    gameId: "adventure-island-3-nes",
    title: "Adventure Island 3",
    summary: "Hudson's third NES Adventure Island continues the dinosaur-companion formula with new prehistoric creature types and stage mechanics, pushing the series' platformer formula to its most refined 8-bit expression across a prehistoric setting.",
  },
  {
    gameId: "adventures-of-lolo-nes",
    title: "Adventures of Lolo",
    summary: "HAL Laboratory's NES puzzle game follows the round blue Lolo through single-screen rooms using heart framers to freeze enemies and collect hearts, establishing a methodical enemy-manipulation puzzle formula that spawned two NES sequels.",
  },
  {
    gameId: "adventures-of-lolo-2-nes",
    title: "Adventures of Lolo 2",
    summary: "HAL Laboratory's NES sequel expands the enemy-freezing heart puzzle rooms of the original with new enemy types and room configurations, maintaining the precise single-screen puzzle structure that made the first game a cult favorite.",
  },
  {
    gameId: "adventures-of-lolo-3-nes",
    title: "Adventures of Lolo 3",
    summary: "HAL Laboratory's final NES Lolo adds Lala as a second playable character to the established single-screen puzzle formula, offering the most content-rich entry in the trilogy with the largest room count and deepest mechanical variety.",
  },
  {
    gameId: "air-fortress-nes",
    title: "Air Fortress",
    summary: "HAL Laboratory's NES hybrid action game alternates between a side-scrolling space shooter approach phase and a first-person interior infiltration phase where Hal Bailman plants bombs inside enemy fortresses before escaping before detonation.",
  },
  {
    gameId: "airwolf-nes",
    title: "Airwolf",
    summary: "Kyugo's NES adaptation of the CBS helicopter TV series delivers multidirectional scrolling aerial combat through cave systems and open terrain, converting the show's high-tech supercopter missions into a compact 8-bit shooter.",
  },
  {
    gameId: "alien-3-nes",
    title: "Alien 3",
    summary: "Probe Software's NES port of the film-based game scales the prison-planet xenomorph hunt to the 8-bit platform, adapting the rescue mission structure and side-scrolling combat of the console versions to the NES hardware's constraints.",
  },
  {
    gameId: "alien-syndrome-nes",
    title: "Alien Syndrome",
    summary: "Tengen's NES port of the Sega arcade game follows soldiers through maze-like spacecraft rescuing hostages before a timer expires, delivering the top-down run-and-gun cooperative format of the original coin-op in a home console adaptation.",
  },
  {
    gameId: "alpha-mission-nes",
    title: "Alpha Mission",
    summary: "SNK's NES vertical shooter is an early entry in the company's shooter catalogue, featuring surface and aerial weapon layers that the player must separately maintain while navigating densely populated enemy formations.",
  },
  {
    gameId: "altered-beast-nes",
    title: "Altered Beast",
    summary: "Sega's NES port of the 1988 arcade beat-'em-up follows resurrected warriors collecting power orbs to transform into mythological creatures, scaling the coin-op's two-player brawling and transformation spectacle to the 8-bit Nintendo platform.",
  },
  {
    gameId: "amagon-nes",
    title: "Amagon",
    summary: "Aicom's NES action platformer follows a marine stranded on a monster-filled island who can transform into the giant Megagon by expending ammo, introducing a risk-reward power conversion mechanic into an otherwise conventional side-scrolling format.",
  },
  {
    gameId: "american-gladiators-nes",
    title: "American Gladiators",
    summary: "Gametek's NES adaptation of the syndicated TV competition show compiles the show's main events — joust, assault, powerball, the wall, and the eliminator — into a multi-event athletic competition game with the program's physical challenge format.",
  },
  {
    gameId: "anticipation-nes",
    title: "Anticipation",
    summary: "Rare's NES board game adaptation is the first Nintendo-published Rare title, featuring a Pictionary-style drawing guessing game across a color-coded board where players race to identify illustrations drawn by an onscreen cursor.",
  },
  {
    gameId: "antarctic-adventure-nes",
    title: "Antarctic Adventure",
    summary: "Konami's NES port of the MSX and Famicom penguin racing game follows Penta the penguin through an obstacle-filled Antarctic sprint between bases, serving as one of the earliest endless-runner-style games in a simple but addictive format.",
  },
  {
    gameId: "arch-rivals-nes",
    title: "Arch Rivals",
    summary: "Midway's NES port of the 1989 arcade basketball game offers two-on-two streetball without fouls, encouraging physical play and dirty tactics in an early sports title that anticipated the Barkley and NBA Jam games of the following decade.",
  },
  {
    gameId: "adventures-in-the-magic-kingdom-nes",
    title: "Adventures in the Magic Kingdom",
    summary: "Capcom's NES Disney theme park game tasks players with collecting six silver keys from mini-games representing Disneyland attractions to unlock the Magic Kingdom's gate, blending trivia and action challenges in a unique licensed format.",
  },
  {
    gameId: "adventures-of-dino-riki-nes",
    title: "Adventures of Dino Riki",
    summary: "Hudson's NES vertical shooter follows a prehistoric warrior through dinosaur-filled jungle and cave stages, delivering a top-down run-and-gun format with stone-age weapon upgrades across a compact four-world campaign.",
  },
  {
    gameId: "airwolf-nes",
    title: "Airwolf",
    summary: "The NES Airwolf game follows the armed superhelicopter through multidirectional scrolling cavern and surface missions, delivering a compact top-down aerial combat experience based on the 1980s CBS TV series.",
  },
  {
    gameId: "al-unser-jr-s-turbo-racing-nes",
    title: "Al Unser Jr.'s Turbo Racing",
    summary: "Data East's NES IndyCar racing game carries the licensed Al Unser Jr. brand across oval circuits with drafting and pit strategy, offering a modest simulation of the CART racing series in an isometric perspective on 8-bit hardware.",
  },
  {
    gameId: "alfred-chicken-nes",
    title: "Alfred Chicken",
    summary: "Mindscape's NES port of the Amiga and Game Boy platformer brings the beak-attacking chicken through a compact set of stages, delivering a late-era NES licensed platformer with simple but functional mechanics on a platform already winding down.",
  },
  {
    gameId: "argus-nes",
    title: "Argus",
    summary: "Jaleco's NES vertical shooter follows a spacecraft through alien territory collecting weapon pods that orbit the player ship, featuring a rotating satellite system that requires spatial awareness to use effectively in dense enemy formations.",
  },
  {
    gameId: "air-fortress-nes",
    title: "Air Fortress",
    summary: "HAL Laboratory's NES shooter-infiltration hybrid alternates a horizontal shooter approach with a first-person interior phase inside enemy fortresses, building a dual-mode structure that challenges both quick reflexes and navigation under timer pressure.",
  },
  {
    gameId: "abadox-nes",
    title: "Abadox",
    summary: "Natsume's NES horizontal and vertical shooter challenges players inside a living alien planet, combining biological horror enemy design with punishing difficulty and dense bullet patterns that give the game an enduring cult reputation.",
  },
  {
    gameId: "all-pro-basketball-nes",
    title: "All-Pro Basketball",
    summary: "VARIE's NES basketball simulation offers a statistical management layer alongside on-court five-on-five action, providing a more simulation-minded alternative to the era's arcade basketball games in a late NES library entry.",
  },
  {
    gameId: "airwolf-nes",
    title: "Airwolf",
    summary: "KID's NES Airwolf delivers multidirectional scrolling helicopter missions rescuing hostages from enemy bases, translating the TV show's high-tech rescue premise into a top-down action format with weapon and fuel management.",
  },
  {
    gameId: "akira-nes",
    title: "Akira",
    summary: "Taito's Japan-only NES adaptation of Katsuhiro Otomo's landmark 1988 anime film compresses the Neo-Tokyo dystopia into a hybrid action-puzzle game, allowing players to guide Kaneda and Tetsuo through scenarios drawn from the film's narrative.",
  },
  {
    gameId: "amagon-nes",
    title: "Amagon",
    summary: "Amagon's NES side-scroller distinguishes itself with a transformation mechanic where collecting enough ammo converts the marine into the giant invincible Megagon, rewarding resource discipline with a spectacular power spike that defines its risk-reward identity.",
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
  if (ex) { db.prepare(`UPDATE source_records SET compliance_status='approved', last_verified_at=?, confidence_level=0.8, notes='G2 summary batch 19' WHERE id=?`).run(ts, ex.id); return Number(ex.id) }
  const r = db.prepare(`INSERT INTO source_records (entity_type,entity_id,field_name,source_name,source_type,source_url,source_license,compliance_status,ingested_at,last_verified_at,confidence_level,notes) VALUES ('game',?,'summary','internal','knowledge_registry',NULL,NULL,'approved',?,?,0.8,'G2 summary batch 19')`).run(gameId, ts, ts)
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
  const r = db.prepare(`INSERT INTO enrichment_runs (run_key,pipeline_name,mode,source_name,status,dry_run,started_at,items_seen,items_created,items_updated,items_skipped,items_flagged,error_count,notes) VALUES (?,'g2_summary_batch_19','apply','internal_curated','running',?,?,0,0,0,0,0,0,'G2 batch 19 — NES wave 1')`).run(runKey, dry?1:0, ts)
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
  const runKey = 'g2-summary-batch-19-' + ts
  const runId = createRun(db, runKey, ts, false)
  const m = { itemsSeen: G2_BATCH.length, itemsUpdated: 0, itemsSkipped: 0, itemsFlagged: 0, notes: 'G2 summary batch 19 applied locally on staging sqlite' }
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
