#!/usr/bin/env node
'use strict'
const path = require('path'), crypto = require('crypto'), Database = require('better-sqlite3')
const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')
const G2_BATCH = [
  {
    gameId: "extreme-g-nintendo-64",
    title: "Extreme-G",
    summary: "Acclaim's N64 anti-gravity racer delivers high-speed futuristic motorcycle combat racing with boost management and weapon pickups, offering an adrenaline-focused alternative to F-Zero 64's purer racing at velocities that blur track geometry.",
  },
  {
    gameId: "fighter-destiny-2-nintendo-64",
    title: "Fighter Destiny 2",
    summary: "Ocean's N64 fighting game sequel expands the point-scoring combat system of the original, rewarding specific knockdown types with score increments rather than life depletion in a mechanically distinct approach to competitive fighting.",
  },
  {
    gameId: "forsaken-nintendo-64",
    title: "Forsaken 64",
    summary: "Iguana Entertainment's N64 six-degrees-of-freedom shooter places players on hoverbikes through post-apocalyptic underground environments, delivering corridor-tunnel combat influenced by the Descent PC series in a home console adaptation.",
  },
  {
    gameId: "f-zero-x-nintendo-64",
    title: "F-Zero X",
    summary: "Nintendo's N64 anti-gravity racer sacrifices graphical detail for a locked 60fps with 30 simultaneous racers, delivering the purest expression of the franchise's high-speed circuit format and adding a Death Race mode and randomized course generator.",
  },
  {
    gameId: "goemon-s-great-adventure-nintendo-64",
    title: "Goemon's Great Adventure",
    summary: "Konami's N64 sequel returns Goemon to 2D side-scrolling format after the previous game's 3D adventure, featuring two-player co-op through samurai-era Japan with the franchise's surreal humor and robot giant battle sequences.",
  },
  {
    gameId: "goldeneye-007-nintendo-64",
    title: "GoldenEye 007",
    summary: "Rare's N64 James Bond FPS established the template for console first-person shooters with its mission-objective structure, split-screen multiplayer, and contextual animation, becoming one of the most influential games ever made.",
  },
  {
    gameId: "jet-force-gemini-nintendo-64",
    title: "Jet Force Gemini",
    summary: "Rare's N64 third-person shooter follows three heroes across the galaxy battling an insectoid army in missions emphasizing heavy firepower, twin-stick-like targeting, and the franchise's characteristic visual polish and dark-edged humor.",
  },
  {
    gameId: "kirby-64-crystal-shards-nintendo-64",
    title: "Kirby 64: The Crystal Shards",
    summary: "HAL Laboratory's N64 platformer introduces a copy-combine mechanic where two swallowed powers fuse into unique hybrid abilities, delivering a gentler platformer experience across five planets in Kirby's only original N64 console appearance.",
  },
  {
    gameId: "majoras-mask-nintendo-64",
    title: "The Legend of Zelda: Majora's Mask",
    summary: "Nintendo's N64 Zelda sequel constrains its entire world to a three-day loop reset using Ocarina of Time's engine, building a deeply melancholy time-manipulation adventure around recurring character schedules and the impending fall of the moon.",
  },
  {
    gameId: "mario-party-nintendo-64",
    title: "Mario Party",
    summary: "Hudson Soft's N64 party game established the board-game-plus-minigame formula with 50 unique minigames across six boards, becoming the definitive multiplayer experience on the platform and spawning one of Nintendo's most enduring party franchises.",
  },
  {
    gameId: "mario-party-2-nintendo-64",
    title: "Mario Party 2",
    summary: "Hudson Soft's N64 sequel expands the party formula with themed board settings that give each map a distinct costume identity, refining minigame variety and addressing criticisms of the original's more luck-dependent board design.",
  },
  {
    gameId: "mario-party-3-nintendo-64",
    title: "Mario Party 3",
    summary: "Hudson Soft's third and final N64 Mario Party adds a duel map mode and item system to the established board-game formula, delivering the most mechanically complex entry in the original trilogy and the platform's largest minigame collection.",
  },
  {
    gameId: "castlevania-nintendo-64",
    title: "Castlevania (Nintendo 64)",
    summary: "Konami's N64 experiment translates the Castlevania franchise into full 3D for the first time, following Reinhardt Schneider and Carrie Fernandez through gothic environments in a transition that divided fans between its atmospheric ambition and camera struggles.",
  },
  {
    gameId: "castlevania-legacy-of-darkness-nintendo-64",
    title: "Castlevania: Legacy of Darkness",
    summary: "Konami's N64 Castlevania expansion adds Cornell the man-beast as a new protagonist with additional chapters and refined mechanics, serving as both a prequel and enhanced version of the controversial 3D series experiment.",
  },
  {
    gameId: "paper-mario-nintendo-64",
    title: "Paper Mario",
    summary: "Intelligent Systems' N64 RPG revisits the Super Mario RPG format with a flat paper aesthetic, introducing partners and a badge-based ability system across a turn-based adventure that launched one of Nintendo's most creatively inventive RPG franchises.",
  },
  {
    gameId: "big-mountain-2000-nintendo-64",
    title: "Big Mountain 2000",
    summary: "Success's N64 snowboarding game delivers fast slope-racing across mountain courses with a simple trick system, serving as a late-era N64 snowboarding entry competing against 1080° Snowboarding and other established winter sports titles on the platform.",
  },
  {
    gameId: "bottom-of-the-9th-nintendo-64",
    title: "Bottom of the 9th",
    summary: "Konami's N64 baseball game focuses on the critical late-inning moments of a baseball game with a tension-based batting and pitching mechanic, distilling the sport's most dramatic moments into a compact head-to-head competition format.",
  },
  {
    gameId: "brunswick-circuit-pro-bowling-nintendo-64",
    title: "Brunswick Circuit Pro Bowling",
    summary: "THQ's N64 bowling simulation carries the Brunswick brand across licensed lanes with a realistic ball-arc and pin-physics system, offering a straightforward ten-pin bowling simulation in a format suited to casual multiplayer sessions.",
  },
  {
    gameId: "centre-court-tennis-nintendo-64",
    title: "Centre Court Tennis",
    summary: "Boss Game Studios' N64 tennis simulation delivers a realistic serve-return-volley structure with licensed player archetypes across clay, grass, and hard courts, offering a simulation alternative to the Mario Tennis arcade approach on the platform.",
  },
  {
    gameId: "charlie-s-blast-territory-nintendo-64",
    title: "Charlie's Blast Territory",
    summary: "Bam! Entertainment's N64 puzzle game tasks players with guiding Charlie through grid-based stages by detonating colored bombs in a chain-reaction mechanic, offering an obscure but mechanically interesting puzzle challenge in the N64's sparse puzzle library.",
  },
]
function nowIso(){return new Date().toISOString()}
function hashValue(v){return crypto.createHash('sha256').update(String(v||'')).digest('hex')}
function ensureGameIds(db,p){const r=db.prepare(`SELECT id FROM games WHERE id IN (${p.map(()=>'?').join(', ')})`).all(...p.map(e=>e.gameId));const ids=new Set(r.map(x=>String(x.id)));const m=p.map(e=>e.gameId).filter(id=>!ids.has(id));if(m.length)throw new Error('Missing target games in sqlite: '+m.join(', '))}
function ensureSourceRecord(db,gameId,ts){const ex=db.prepare(`SELECT id FROM source_records WHERE entity_type='game' AND entity_id=? AND field_name='summary' AND source_name='internal' AND source_type='knowledge_registry' ORDER BY id DESC LIMIT 1`).get(gameId);if(ex){db.prepare(`UPDATE source_records SET compliance_status='approved',last_verified_at=?,confidence_level=0.8,notes='G2 summary batch 21' WHERE id=?`).run(ts,ex.id);return Number(ex.id)}const r=db.prepare(`INSERT INTO source_records (entity_type,entity_id,field_name,source_name,source_type,source_url,source_license,compliance_status,ingested_at,last_verified_at,confidence_level,notes) VALUES ('game',?,'summary','internal','knowledge_registry',NULL,NULL,'approved',?,?,0.8,'G2 summary batch 21')`).run(gameId,ts,ts);return Number(r.lastInsertRowid)}
function ensureFieldProvenance(db,gameId,srcId,summary,ts){const ex=db.prepare(`SELECT id FROM field_provenance WHERE entity_type='game' AND entity_id=? AND field_name='summary' ORDER BY id DESC LIMIT 1`).get(gameId);const vh=hashValue(summary);if(ex){db.prepare(`UPDATE field_provenance SET source_record_id=?,value_hash=?,is_inferred=0,confidence_level=0.8,verified_at=? WHERE id=?`).run(srcId,vh,ts,ex.id);return false}db.prepare(`INSERT INTO field_provenance (entity_type,entity_id,field_name,source_record_id,value_hash,is_inferred,confidence_level,verified_at) VALUES ('game',?,'summary',?,?,0,0.8,?)`).run(gameId,srcId,vh,ts);return true}
function upsertGameEditorialSummary(db,gameId,summary,srcId,ts){db.prepare(`INSERT INTO game_editorial (game_id,summary,source_record_id,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(game_id) DO UPDATE SET summary=excluded.summary,source_record_id=excluded.source_record_id,updated_at=excluded.updated_at`).run(gameId,summary,srcId,ts,ts)}
function createRun(db,runKey,ts,dry){const r=db.prepare(`INSERT INTO enrichment_runs (run_key,pipeline_name,mode,source_name,status,dry_run,started_at,items_seen,items_created,items_updated,items_skipped,items_flagged,error_count,notes) VALUES (?,'g2_summary_batch_21','apply','internal_curated','running',?,?,0,0,0,0,0,0,'G2 batch 21 — N64 wave 4 + notable')`).run(runKey,dry?1:0,ts);return Number(r.lastInsertRowid)}
function finalizeRun(db,runId,ts,m){db.prepare(`UPDATE enrichment_runs SET status='completed',finished_at=?,items_seen=?,items_created=0,items_updated=?,items_skipped=?,items_flagged=?,error_count=0,notes=? WHERE id=?`).run(ts,m.itemsSeen,m.itemsUpdated,m.itemsSkipped,m.itemsFlagged,m.notes,runId)}
function readBefore(db,p){const r=db.prepare(`SELECT id,summary FROM games WHERE id IN (${p.map(()=>'?').join(', ')})`).all(...p.map(e=>e.gameId));return new Map(r.map(x=>[String(x.id),String(x.summary||'')]))}
function dryRun(db){const b=readBefore(db,G2_BATCH);return{targetedGames:G2_BATCH.length,summaryUpdates:G2_BATCH.filter(e=>!b.get(e.gameId).trim()).length,targets:G2_BATCH.map(e=>({gameId:e.gameId,title:e.title,hadSummaryBefore:Boolean(b.get(e.gameId).trim())}))}}
function applyBatch(db){const ts=nowIso();const runKey='g2-summary-batch-21-'+ts;const runId=createRun(db,runKey,ts,false);const m={itemsSeen:G2_BATCH.length,itemsUpdated:0,itemsSkipped:0,itemsFlagged:0,notes:'G2 summary batch 21 applied locally on staging sqlite'};db.transaction(()=>{for(const e of G2_BATCH){const srcId=ensureSourceRecord(db,e.gameId,ts);db.prepare('UPDATE games SET summary=? WHERE id=?').run(e.summary,e.gameId);upsertGameEditorialSummary(db,e.gameId,e.summary,srcId,ts);ensureFieldProvenance(db,e.gameId,srcId,e.summary,ts);m.itemsUpdated++}})();finalizeRun(db,runId,nowIso(),m);return{runId,runKey,metrics:m}}
function main(){const db=new Database(SQLITE_PATH);try{ensureGameIds(db,G2_BATCH);if(!APPLY){console.log(JSON.stringify({mode:'dry-run',sqlitePath:SQLITE_PATH,summary:dryRun(db)},null,2));return}console.log(JSON.stringify({mode:'apply',sqlitePath:SQLITE_PATH,summary:dryRun(db),result:applyBatch(db)},null,2))}finally{db.close()}}
main()
