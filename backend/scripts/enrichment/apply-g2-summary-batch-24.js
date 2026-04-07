#!/usr/bin/env node
'use strict'
const path = require('path'), crypto = require('crypto'), Database = require('better-sqlite3')
const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')
const G2_BATCH = [
  {
    gameId: "daytona-usa-sega-saturn",
    title: "Daytona USA",
    summary: "Sega's Saturn port of the 1993 arcade racing phenomenon delivers the coin-op's three oval and circuit tracks to the home console, a technically challenged but commercially dominant Saturn launch title that defined the platform's early library despite its rough edges.",
  },
  {
    gameId: "die-hard-arcade-sega-saturn",
    title: "Die Hard Arcade",
    summary: "Sega's Saturn beat-'em-up uses the Die Hard license over a police action brawler with two-player co-op, featuring a weapons-from-environment system and branching stage structure across a skyscraper hostage rescue setting.",
  },
  {
    gameId: "dragon-force-sega-saturn",
    title: "Dragon Force",
    summary: "Working Designs's Saturn strategy RPG governs eight kingdoms across a fantasy continent through massive 100-vs-100 troop battles, representing one of the Saturn's most acclaimed Japan-developed strategy titles with a deep faction-based campaign structure.",
  },
  {
    gameId: "darius-gaiden-sega-saturn",
    title: "Darius Gaiden",
    summary: "Taito's Saturn port of the 1994 arcade shooter delivers the franchise's mechanical sea-beast bosses and branching stage tree to the home console, with the Black Hole Bomb screen-clearing weapon and a capture mechanic for using enemy craft.",
  },
  {
    gameId: "battle-garegga-sega-saturn",
    title: "Battle Garegga",
    summary: "Raizing's Saturn port of the 1996 vertical arcade shoot-'em-up introduces the rank system that secretly raises difficulty based on player performance, establishing a foundational bullet-hell mechanic and a scoring meta built around deliberate power-down strategies.",
  },
  {
    gameId: "bulk-slash-sega-saturn",
    title: "Bulk Slash",
    summary: "Hudson's Japan-only Saturn third-person mecha shooter places a transforming robot through city rescue missions where civilian-saving count determines route progression, blending aerial combat with a branching structure driven by performance score.",
  },
  {
    gameId: "blazing-dragons-sega-saturn",
    title: "Blazing Dragons",
    summary: "Crystal Dynamics's Saturn point-and-click adventure inverts the classic dragon-slaying narrative by casting dragon knights defending a medieval kingdom from human oppressors, written by Terry Jones of Monty Python with absurdist cartoon humor.",
  },
  {
    gameId: "cleopatra-fortune-sega-saturn",
    title: "Cleopatra Fortune",
    summary: "Taito's Saturn puzzle game drops blocks into a well where enclosing mummies and sarcophagi in complete rectangles clears them, delivering an original falling-block formula with a distinct match-enclosure mechanic in an Egyptian-themed presentation.",
  },
  {
    gameId: "cotton-2-magical-night-dreams-sega-saturn",
    title: "Cotton 2: Magical Night Dreams",
    summary: "Success's Japan-only Saturn horizontal shooter is the third Cotton entry, featuring a tag team mechanic that swaps between Cotton and Silk mid-battle and a scoring system built around candy collection across colorful fantasy environments.",
  },
  {
    gameId: "d-sega-saturn",
    title: "D",
    summary: "Warp's Saturn FMV horror adventure follows a woman investigating her father's hospital massacre through a surreal first-person journey, designed with a two-hour real-time play limit and no save points to heighten its cinematic tension.",
  },
  {
    gameId: "the-legend-of-zelda-phantom-hourglass-nintendo-ds",
    title: "The Legend of Zelda: Phantom Hourglass",
    summary: "Nintendo's DS Zelda sequel to Wind Waker uses the touchscreen exclusively for all movement and combat, building a ship-based ocean adventure around the Temple of the Ocean King dungeon that players return to repeatedly with new abilities.",
  },
  {
    gameId: "pokemon-heartgold-nintendo-ds",
    title: "Pokémon HeartGold",
    summary: "Game Freak's DS remake of Gold Version adds the Pokéwalker pedometer accessory, fully animated walking Pokémon companions, and the Battle Frontier post-game to the Johto adventure, elevating the Gold and Silver formula to fourth-generation standards.",
  },
  {
    gameId: "7th-dragon-nintendo-ds",
    title: "7th Dragon",
    summary: "imageepoch's Japan-only DS dungeon RPG follows a guild of dragon hunters through a world overrun by flowers that transform into powerful dragon enemies, delivering a challenging first-person dungeon crawler with a memorable Yuzo Koshiro soundtrack.",
  },
  {
    gameId: "ace-attorney-investigations-miles-edgeworth-nintendo-ds",
    title: "Ace Attorney Investigations: Miles Edgeworth",
    summary: "Capcom's DS spin-off shifts perspective from defense attorney to prosecutor Miles Edgeworth, delivering a new crime-scene traversal mechanic and a deductive Logic system across five cases that flesh out the popular secondary character's worldview.",
  },
  {
    gameId: "contra-hard-corps-sega-genesis",
    title: "Contra: Hard Corps",
    summary: "Konami's Genesis Contra entry offers four selectable characters with unique weapon sets across a campaign with multiple branching endings, delivering the franchise's most mechanically varied 16-bit entry with an uncompromising difficulty that rewarded mastery.",
  },
  {
    gameId: "comix-zone-sega-genesis",
    title: "Comix Zone",
    summary: "Sega's Genesis beat-'em-up places hero Sketch Turner inside his own comic book pages, navigating panel-to-panel through hand-drawn environments in a graphically inventive brawler with a distinctive visual premise and a self-aware narrative structure.",
  },
  {
    gameId: "castlevania-bloodlines-sega-genesis",
    title: "Castlevania: Bloodlines",
    summary: "Konami's sole Genesis Castlevania follows John Morris and Eric Lecarde through European locations tied to World War I vampire mythology, offering two distinct play styles and the franchise's most geographically varied 16-bit setting.",
  },
  {
    gameId: "earthworm-jim-2-sega-genesis",
    title: "Earthworm Jim 2",
    summary: "Interplay's Genesis sequel follows the suited worm through surreal stage types including a slo-mo opera sequence and a hamster launcher, expanding the original's platform-game parody with even wilder tonal variety and new Andy Asterisk characters.",
  },
  {
    gameId: "captain-commando-sega-genesis",
    title: "Captain Commando",
    summary: "Capcom's Genesis port of the 1991 arcade brawler brings four futuristic heroes through 26th-century Metro City, compressing the coin-op's diverse weapon-based character combat and two-player co-op into the 16-bit Sega platform.",
  },
  {
    gameId: "atelier-marie-the-alchemist-of-salburg-sega-saturn",
    title: "Atelier Marie: The Alchemist of Salburg",
    summary: "Gust's Saturn debut launches the long-running Atelier franchise with a five-year time-limit structure in which an alchemy student gathers ingredients, crafts items, and completes commissions in a low-stakes life-simulation RPG format.",
  },
]
function nowIso(){return new Date().toISOString()}
function hashValue(v){return crypto.createHash('sha256').update(String(v||'')).digest('hex')}
function ensureGameIds(db,p){const r=db.prepare(`SELECT id FROM games WHERE id IN (${p.map(()=>'?').join(', ')})`).all(...p.map(e=>e.gameId));const ids=new Set(r.map(x=>String(x.id)));const m=p.map(e=>e.gameId).filter(id=>!ids.has(id));if(m.length)throw new Error('Missing target games in sqlite: '+m.join(', '))}
function ensureSourceRecord(db,gameId,ts){const ex=db.prepare(`SELECT id FROM source_records WHERE entity_type='game' AND entity_id=? AND field_name='summary' AND source_name='internal' AND source_type='knowledge_registry' ORDER BY id DESC LIMIT 1`).get(gameId);if(ex){db.prepare(`UPDATE source_records SET compliance_status='approved',last_verified_at=?,confidence_level=0.8,notes='G2 summary batch 24' WHERE id=?`).run(ts,ex.id);return Number(ex.id)}const r=db.prepare(`INSERT INTO source_records (entity_type,entity_id,field_name,source_name,source_type,source_url,source_license,compliance_status,ingested_at,last_verified_at,confidence_level,notes) VALUES ('game',?,'summary','internal','knowledge_registry',NULL,NULL,'approved',?,?,0.8,'G2 summary batch 24')`).run(gameId,ts,ts);return Number(r.lastInsertRowid)}
function ensureFieldProvenance(db,gameId,srcId,summary,ts){const ex=db.prepare(`SELECT id FROM field_provenance WHERE entity_type='game' AND entity_id=? AND field_name='summary' ORDER BY id DESC LIMIT 1`).get(gameId);const vh=hashValue(summary);if(ex){db.prepare(`UPDATE field_provenance SET source_record_id=?,value_hash=?,is_inferred=0,confidence_level=0.8,verified_at=? WHERE id=?`).run(srcId,vh,ts,ex.id);return false}db.prepare(`INSERT INTO field_provenance (entity_type,entity_id,field_name,source_record_id,value_hash,is_inferred,confidence_level,verified_at) VALUES ('game',?,'summary',?,?,0,0.8,?)`).run(gameId,srcId,vh,ts);return true}
function upsertGameEditorialSummary(db,gameId,summary,srcId,ts){db.prepare(`INSERT INTO game_editorial (game_id,summary,source_record_id,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(game_id) DO UPDATE SET summary=excluded.summary,source_record_id=excluded.source_record_id,updated_at=excluded.updated_at`).run(gameId,summary,srcId,ts,ts)}
function createRun(db,runKey,ts,dry){const r=db.prepare(`INSERT INTO enrichment_runs (run_key,pipeline_name,mode,source_name,status,dry_run,started_at,items_seen,items_created,items_updated,items_skipped,items_flagged,error_count,notes) VALUES (?,'g2_summary_batch_24','apply','internal_curated','running',?,?,0,0,0,0,0,0,'G2 batch 24 — Saturn wave 2 + NDS wave 3 + Genesis wave 6')`).run(runKey,dry?1:0,ts);return Number(r.lastInsertRowid)}
function finalizeRun(db,runId,ts,m){db.prepare(`UPDATE enrichment_runs SET status='completed',finished_at=?,items_seen=?,items_created=0,items_updated=?,items_skipped=?,items_flagged=?,error_count=0,notes=? WHERE id=?`).run(ts,m.itemsSeen,m.itemsUpdated,m.itemsSkipped,m.itemsFlagged,m.notes,runId)}
function readBefore(db,p){const r=db.prepare(`SELECT id,summary FROM games WHERE id IN (${p.map(()=>'?').join(', ')})`).all(...p.map(e=>e.gameId));return new Map(r.map(x=>[String(x.id),String(x.summary||'')]))}
function dryRun(db){const b=readBefore(db,G2_BATCH);return{targetedGames:G2_BATCH.length,summaryUpdates:G2_BATCH.filter(e=>!b.get(e.gameId).trim()).length,targets:G2_BATCH.map(e=>({gameId:e.gameId,title:e.title,hadSummaryBefore:Boolean(b.get(e.gameId).trim())}))}}
function applyBatch(db){const ts=nowIso();const runKey='g2-summary-batch-24-'+ts;const runId=createRun(db,runKey,ts,false);const m={itemsSeen:G2_BATCH.length,itemsUpdated:0,itemsSkipped:0,itemsFlagged:0,notes:'G2 summary batch 24 applied locally on staging sqlite'};db.transaction(()=>{for(const e of G2_BATCH){const srcId=ensureSourceRecord(db,e.gameId,ts);db.prepare('UPDATE games SET summary=? WHERE id=?').run(e.summary,e.gameId);upsertGameEditorialSummary(db,e.gameId,e.summary,srcId,ts);ensureFieldProvenance(db,e.gameId,srcId,e.summary,ts);m.itemsUpdated++}})();finalizeRun(db,runId,nowIso(),m);return{runId,runKey,metrics:m}}
function main(){const db=new Database(SQLITE_PATH);try{ensureGameIds(db,G2_BATCH);if(!APPLY){console.log(JSON.stringify({mode:'dry-run',sqlitePath:SQLITE_PATH,summary:dryRun(db)},null,2));return}console.log(JSON.stringify({mode:'apply',sqlitePath:SQLITE_PATH,summary:dryRun(db),result:applyBatch(db)},null,2))}finally{db.close()}}
main()
