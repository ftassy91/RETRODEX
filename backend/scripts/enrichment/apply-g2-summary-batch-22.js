#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  {
    gameId: "ace-combat-advance-game-boy-advance",
    title: "Ace Combat Advance",
    summary: "Ubisoft's GBA entry in the Ace Combat franchise delivers top-down aerial mission combat across a small campaign, scaling the series' mission-based dogfighting to the handheld in a format diverging significantly from the console franchise's cockpit perspective.",
  },
  {
    gameId: "aggressive-inline-game-boy-advance",
    title: "Aggressive Inline",
    summary: "Z-Axis's GBA port of the console inline skating game adapts the trick-combo rail-grinding formula to the handheld, compressing the urban skating sandbox of the console versions into a mission-based portable format.",
  },
  {
    gameId: "asterix-obelix-xxl-game-boy-advance",
    title: "Asterix & Obelix XXL",
    summary: "The GBA Asterix XXL follows the Gaulish warriors through side-scrolling beat-'em-up combat against Roman camps, adapting the 3D console game's licensed franchise combat to a 2D handheld structure suited to the GBA's capabilities.",
  },
  {
    gameId: "asterix-obelix-bash-them-all-game-boy-advance",
    title: "Asterix & Obelix: Bash Them All!",
    summary: "Ubisoft's GBA licensed brawler sends Asterix and Obelix through European regions bashing Romans across side-scrolling stages, delivering straightforward two-character beat-'em-up action in a portable entry in the long-running Gaulish franchise.",
  },
  {
    gameId: "atlantis-the-lost-empire-game-boy-advance",
    title: "Atlantis: The Lost Empire",
    summary: "The GBA game based on Disney's 2001 animated film follows Milo Thatch through the underwater civilization in a side-scrolling action-adventure, adapting the film's archaeological exploration narrative to a portable licensed format.",
  },
  {
    gameId: "avatar-the-last-airbender-the-burning-earth-game-boy-advance",
    title: "Avatar: The Last Airbender – The Burning Earth",
    summary: "THQ's GBA sequel to the first Avatar game continues Aang's journey in a side-scrolling action format, expanding the bending combat system with additional elemental disciplines across stages drawn from the animated series' second season.",
  },
  {
    gameId: "balloon-fight-game-boy-advance",
    title: "Balloon Fight",
    summary: "Nintendo's GBA port of the 1984 NES launch title brings the balloon-jousting aerial combat to the handheld with a faithful recreation of the original game's mechanics and the addictive endless Balloon Trip mode.",
  },
  {
    gameId: "alex-rider-stormbreaker-game-boy-advance",
    title: "Alex Rider: Stormbreaker",
    summary: "Vicarious Visions's GBA action-adventure adapts Anthony Horowitz's young adult spy novel following teenage MI6 agent Alex Rider through gadget-assisted stealth and combat missions tied to the 2006 film adaptation.",
  },
  {
    gameId: "airforce-delta-storm-game-boy-advance",
    title: "Airforce Delta Storm",
    summary: "Konami's GBA aerial combat game delivers mission-based dogfighting across a campaign with multiple aircraft unlockable through score performance, adapting the franchise's flight combat to a top-down handheld perspective.",
  },
  {
    gameId: "army-men-advance-game-boy-advance",
    title: "Army Men Advance",
    summary: "The GBA Army Men entry follows plastic soldiers through top-down action missions in the franchise's miniature-scale warfare setting, offering a portable interpretation of 3DO's long-running budget plastic toy soldier combat series.",
  },
  {
    gameId: "army-men-operation-green-game-boy-advance",
    title: "Army Men: Operation Green",
    summary: "Majesco's GBA Army Men game delivers isometric plastic soldier combat across mission-based stages in the franchise's familiar miniaturized warfare setting, providing a portable continuation of the budget action series.",
  },
  {
    gameId: "army-men-turf-wars-game-boy-advance",
    title: "Army Men: Turf Wars",
    summary: "The GBA Army Men entry delivers squad-based top-down combat across territorial control missions, following the franchise's plastic soldier warfare concept into a portable format focused on capturing and holding map positions.",
  },
  {
    gameId: "aero-the-acro-bat-game-boy-advance",
    title: "Aero the Acro-Bat",
    summary: "The GBA port of Sunsoft's circus acrobat platformer brings Aero's drill-attack traversal and big-top stage themes to the handheld, adapting the 16-bit mascot franchise's second title to a portable format.",
  },
  {
    gameId: "adventure-island-game-boy-advance",
    title: "Adventure Island",
    summary: "Hudson's GBA Adventure Island delivers the food-health platform formula of the original series in a handheld format, following Master Higgins through tropical stages with the franchise's characteristic rapid-timer health drain mechanic.",
  },
  {
    gameId: "an-american-tail-fievel-s-gold-rush-game-boy-advance",
    title: "An American Tail: Fievel's Gold Rush",
    summary: "The GBA licensed platformer follows the immigrant mouse Fievel through Gold Rush-era American West environments, adapting Don Bluth's animated character into a compact handheld action-platformer with western-themed stage design.",
  },
  {
    gameId: "action-man-robot-atak-game-boy-advance",
    title: "Action Man: Robot Atak",
    summary: "Rage Software's GBA licensed action game follows the Hasbro action hero through robotic enemy combat in side-scrolling stages, delivering a portable entry in the European action figure brand's video game adaptations.",
  },
  {
    gameId: "007-nightfire-game-boy-advance",
    title: "007: Nightfire",
    summary: "Gizmondo Studios' GBA adaptation of the Bond game delivers top-down stealth and action missions with a small arsenal of spy gadgets, scaling the console game's Phoenix criminal organization narrative to a compact handheld format.",
  },
  {
    gameId: "around-the-world-in-80-days-game-boy-advance",
    title: "Around the World in 80 Days",
    summary: "The GBA adventure game adapts Jules Verne's classic novel of Phileas Fogg's wager-driven global circumnavigation into a portable action-adventure, following the Victorian gentleman through exotic international locations in a licensed handheld format.",
  },
  {
    gameId: "arthur-and-the-invisibles-game-boy-advance",
    title: "Arthur and the Invisibles",
    summary: "The GBA licensed game based on Luc Besson's animated film follows Arthur in the miniature Minimoy world through side-scrolling stages, adapting the film's tiny-scale adventure to a compact portable format for the GBA hardware.",
  },
  {
    gameId: "backyard-skateboarding-game-boy-advance",
    title: "Backyard Skateboarding",
    summary: "Humongous Entertainment's GBA entry in the Backyard Sports series applies the franchise's child athlete cast to skateboarding, delivering simple trick mechanics and ramp-based skating in a portable spin on the long-running licensed sports series.",
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
  if (ex) { db.prepare(`UPDATE source_records SET compliance_status='approved', last_verified_at=?, confidence_level=0.8, notes='G2 summary batch 22' WHERE id=?`).run(ts, ex.id); return Number(ex.id) }
  const r = db.prepare(`INSERT INTO source_records (entity_type,entity_id,field_name,source_name,source_type,source_url,source_license,compliance_status,ingested_at,last_verified_at,confidence_level,notes) VALUES ('game',?,'summary','internal','knowledge_registry',NULL,NULL,'approved',?,?,0.8,'G2 summary batch 22')`).run(gameId, ts, ts)
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
  const r = db.prepare(`INSERT INTO enrichment_runs (run_key,pipeline_name,mode,source_name,status,dry_run,started_at,items_seen,items_created,items_updated,items_skipped,items_flagged,error_count,notes) VALUES (?,'g2_summary_batch_22','apply','internal_curated','running',?,?,0,0,0,0,0,0,'G2 batch 22 — GBA wave 2')`).run(runKey, dry?1:0, ts)
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
  const runKey = 'g2-summary-batch-22-' + ts
  const runId = createRun(db, runKey, ts, false)
  const m = { itemsSeen: G2_BATCH.length, itemsUpdated: 0, itemsSkipped: 0, itemsFlagged: 0, notes: 'G2 summary batch 22 applied locally on staging sqlite' }
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
