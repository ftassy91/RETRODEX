#!/usr/bin/env node
'use strict'

const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')

const G2_BATCH = [
  {
    gameId: "007-the-world-is-not-enough-game-boy-color",
    title: "007: The World is Not Enough",
    summary: "Vicarious Visions' GBC adaptation of the Bond film delivers top-down stealth and action missions across the film's locations, translating the spy franchise's gadget-and-infiltration structure to a compact handheld perspective.",
  },
  {
    gameId: "azure-dreams-game-boy-color",
    title: "Azure Dreams",
    summary: "Konami's GBC port of the PS1 town-building roguelike follows Koh collecting monster eggs in an ever-changing tower, scaling the original's rogue dungeon and relationship-building systems into a portable format.",
  },
  {
    gameId: "blade-game-boy-color",
    title: "Blade",
    summary: "Warthog's GBC action game adapts the Marvel vampire hunter Blade in an isometric beat-'em-up structure, following the half-vampire's blade-and-gun combat across a licensed movie tie-in to the 1998 Wesley Snipes film.",
  },
  {
    gameId: "blaster-master-enemy-below-game-boy-color",
    title: "Blaster Master: Enemy Below",
    summary: "Sunsoft's GBC original follows the Blaster Master formula of tank combat and on-foot dungeon exploration in a fresh Color-exclusive adventure, revisiting the franchise's dual-mode gameplay on the handheld with enhanced color visuals.",
  },
  {
    gameId: "bomberman-max-game-boy-color",
    title: "Bomberman Max",
    summary: "Hudson's GBC dual-release Bomberman follows a maze-bomb format with a Charabom monster companion system, letting players capture and level up creature allies in a handheld adventure framed by single-player puzzle stages and link cable battles.",
  },
  {
    gameId: "bomberman-quest-game-boy-color",
    title: "Bomberman Quest",
    summary: "Hudson's GBC action RPG breaks from the franchise's arena bomb format to deliver a top-down RPG adventure where Bomberman traverses an island recovering parts from monster bosses in a structure closer to Zelda than the mainline series.",
  },
  {
    gameId: "buffy-the-vampire-slayer-game-boy-color",
    title: "Buffy the Vampire Slayer",
    summary: "The Game Boy Color Buffy licensed game follows the Slayer through isometric action stages against vampires and demons, translating the WB series' supernatural combat into a portable format aimed at the show's younger fanbase.",
  },
  {
    gameId: "bust-a-move-millennium-game-boy-color",
    title: "Bust-a-Move Millennium",
    summary: "Taito's GBC bubble-shooting puzzle game extends the arcade franchise to the Color hardware with new stage layouts and a two-player link cable mode, maintaining the bubble-match formula that made the series a handheld puzzle staple.",
  },
  {
    gameId: "cannon-fodder-game-boy-color",
    title: "Cannon Fodder",
    summary: "Sensible Software's GBC port of the iconic PC squad shooter adapts the isometric troop-command and satirical tone of the original to the handheld, reducing squad size and map scale for the portable platform's technical constraints.",
  },
  {
    gameId: "carmageddon-ii-carpocalypse-now-game-boy-color",
    title: "Carmageddon II: Carpocalypse Now",
    summary: "Titus Software's GBC vehicular carnage game compresses the controversial PC racing sequel's pedestrian-targeting premise into a top-down handheld format, offering a significantly toned-down interpretation of the original's shock content.",
  },
  {
    gameId: "batman-beyond-return-of-the-joker-game-boy-color",
    title: "Batman Beyond: Return of the Joker",
    summary: "The GBC adaptation of the animated Batman Beyond film follows Terry McGinnis through side-scrolling combat in a futuristic Gotham, offering licensed handheld action tied to the animated film's Joker confrontation narrative.",
  },
  {
    gameId: "batman-chaos-in-gotham-game-boy-color",
    title: "Batman: Chaos in Gotham",
    summary: "Kemco's GBC Batman action game features both Batman and Batgirl as selectable characters across side-scrolling stages battling Arkham escapees, delivering a licensed handheld adventure set in the Batman Beyond animated universe.",
  },
  {
    gameId: "aliens-thanatos-encounter-game-boy-color",
    title: "Aliens: Thanatos Encounter",
    summary: "Crawfish Interactive's GBC top-down shooter places marines through xenomorph-infested corridors on a derelict spaceship, offering four playable characters and a co-op link cable mode in a budget-tier licensed handheld adaptation.",
  },
  {
    gameId: "asteroids-game-boy-color",
    title: "Asteroids",
    summary: "Activision's GBC update of the 1979 Atari arcade classic adds new game modes and power-ups to the original's vector-geometry space shooting formula, presenting the foundational shoot-'em-up in a small-screen handheld format with Color enhancements.",
  },
  {
    gameId: "castlevania-ii-belmont-s-revenge-game-boy-color",
    title: "Castlevania II: Belmont's Revenge",
    summary: "Konami's GBC port of the Game Boy Castlevania sequel brings Christopher Belmont's four-castle vampire hunt to the Color platform, presenting the original's superior subweapon mechanics and multi-route structure with enhanced color visuals.",
  },
  {
    gameId: "a-bug-s-life-game-boy-color",
    title: "A Bug's Life",
    summary: "The GBC adaptation of the Disney-Pixar film follows Flik through insect-scale levels in a side-scrolling platformer, translating the animated film's colony narrative into a compact portable structure for the Color handheld.",
  },
  {
    gameId: "animorphs-game-boy-color",
    title: "Animorphs",
    summary: "Ubisoft's GBC game adapts the K.A. Applegate book series about teens who can morph into animals, using each transformation's abilities across puzzle-platformer stages in a licensed adventure aimed at the books' young adult audience.",
  },
  {
    gameId: "alice-in-wonderland-game-boy-color",
    title: "Alice in Wonderland",
    summary: "The GBC Alice adaptation follows the Disney film's version of the story through Wonderland environments in a side-scrolling format, using Alice's size-changing mechanics as a puzzle element tied to the story's iconic imagery.",
  },
  {
    gameId: "airforce-delta-game-boy-color",
    title: "Airforce Delta",
    summary: "Konami's GBC aerial combat game delivers a scaled-down version of the console flight franchise's mission-based dogfighting, offering a portable top-down air combat experience with a small fighter roster across a campaign structure.",
  },
  {
    gameId: "atlantis-the-lost-empire-game-boy-color",
    title: "Atlantis: The Lost Empire",
    summary: "The GBC licensed game adapts the Disney animated film's underwater exploration narrative into an action-adventure structure, following Milo Thatch through the titular lost civilization with puzzle and combat elements.",
  },
  {
    gameId: "austin-powers-welcome-to-my-underground-lair-game-boy-color",
    title: "Austin Powers: Welcome to My Underground Lair!",
    summary: "Black Ops Entertainment's GBC game places players in the role of Dr. Evil managing a villain organization through strategy minigames, inverting the usual action-hero licensed game structure in a comedy simulation tied to the film franchise.",
  },
  {
    gameId: "armorines-project-s-w-a-r-m-game-boy-color",
    title: "Armorines: Project S.W.A.R.M.",
    summary: "Valiant Comics' GBC adaptation of the alien-bug invasion license delivers top-down shooter action through military environments, porting the franchise's insect-combat premise to the Color platform in a budget-tier handheld format.",
  },
  {
    gameId: "army-men-sarge-s-heroes-2-game-boy-color",
    title: "Army Men: Sarge's Heroes 2",
    summary: "The GBC entry in 3DO's plastic soldier franchise delivers top-down action across household-scale environments, following Sarge through mission-based combat as a miniaturized portable entry in the Army Men series.",
  },
  {
    gameId: "buzz-lightyear-of-star-command-game-boy-color",
    title: "Buzz Lightyear of Star Command",
    summary: "The GBC licensed game adapts the Disney animated series about the space ranger through side-scrolling action stages, using Buzz's laser blaster and jetpack in a compact portable format tied to the animated TV show's missions.",
  },
  {
    gameId: "asterix-search-for-dogmatix-game-boy-color",
    title: "Asterix: Search for Dogmatix",
    summary: "The GBC Asterix puzzle-adventure sends the Gaulish warrior through environments searching for Obelix's dog Dogmatix, using item collection and obstacle clearing in a licensed portable format suited to the Color hardware's capabilities.",
  },
  {
    gameId: "bass-masters-classic-game-boy-color",
    title: "Bass Masters Classic",
    summary: "The GBC fishing simulation adapts the bass tournament format of the console series to the handheld, offering simplified casting mechanics and lure management across seasonal lake conditions in a portable sportfishing experience.",
  },
  {
    gameId: "battletanx-game-boy-color",
    title: "BattleTanx",
    summary: "The GBC port of 3DO's post-apocalyptic tank combat game adapts the street-level urban armored vehicle combat to a top-down handheld perspective, scaling the console's story mode and multiplayer structure for the Color platform.",
  },
  {
    gameId: "buffy-the-vampire-slayer-game-boy-color",
    title: "Buffy the Vampire Slayer",
    summary: "The GBC Buffy action game sends the Slayer through isometric vampire-hunting stages, using the series' supernatural combat in a portable licensed format targeting the TV show's fanbase with a mission structure drawn from the show's early seasons.",
  },
  {
    gameId: "bugs-bunny-in-crazy-castle-4-game-boy-color",
    title: "Bugs Bunny in Crazy Castle 4",
    summary: "Kemco's GBC continuation of the Crazy Castle puzzle series follows Bugs Bunny through maze stages collecting items while avoiding enemies, maintaining the franchise's simple but addictive collect-and-avoid structure in Color handheld form.",
  },
  {
    gameId: "bugs-bunny-lola-bunny-operation-carrot-patch-game-boy-color",
    title: "Bugs Bunny & Lola Bunny: Operation Carrot Patch",
    summary: "The GBC action game pairs Bugs and Lola Bunny through side-scrolling missions defending their garden from Elmer Fudd and Yosemite Sam, offering two-character play as a licensed handheld entry in the Looney Tunes portable game series.",
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
  if (ex) { db.prepare(`UPDATE source_records SET compliance_status='approved', last_verified_at=?, confidence_level=0.8, notes='G2 summary batch 17' WHERE id=?`).run(ts, ex.id); return Number(ex.id) }
  const r = db.prepare(`INSERT INTO source_records (entity_type,entity_id,field_name,source_name,source_type,source_url,source_license,compliance_status,ingested_at,last_verified_at,confidence_level,notes) VALUES ('game',?,'summary','internal','knowledge_registry',NULL,NULL,'approved',?,?,0.8,'G2 summary batch 17')`).run(gameId, ts, ts)
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
  const r = db.prepare(`INSERT INTO enrichment_runs (run_key,pipeline_name,mode,source_name,status,dry_run,started_at,items_seen,items_created,items_updated,items_skipped,items_flagged,error_count,notes) VALUES (?,'g2_summary_batch_17','apply','internal_curated','running',?,?,0,0,0,0,0,0,'G2 batch 17 — GBC wave 1')`).run(runKey, dry?1:0, ts)
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
  const runKey = 'g2-summary-batch-17-' + ts
  const runId = createRun(db, runKey, ts, false)
  const m = { itemsSeen: G2_BATCH.length, itemsUpdated: 0, itemsSkipped: 0, itemsFlagged: 0, notes: 'G2 summary batch 17 applied locally on staging sqlite' }
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
