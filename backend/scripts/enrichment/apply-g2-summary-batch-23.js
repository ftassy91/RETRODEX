#!/usr/bin/env node
'use strict'
const path = require('path'), crypto = require('crypto'), Database = require('better-sqlite3')
const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')
const G2_BATCH = [
  {
    gameId: "hack-infection-playstation-2",
    title: ".hack//Infection",
    summary: "CyberConnect2's PS2 RPG simulates an MMORPG from within, following Kite exploring a fictional online game called The World while uncovering a mystery behind players falling into comas, blending MMORPG aesthetics with single-player RPG structure.",
  },
  {
    gameId: "hack-g-u-vol-1-rebirth-playstation-2",
    title: ".hack//G.U. Vol. 1//Rebirth",
    summary: "CyberConnect2's PS2 standalone sequel to the original .hack series follows Haseo through a more action-oriented combat system in a darker tone, revisiting The World setting with faster real-time battles and a deeper PC community simulation layer.",
  },
  {
    gameId: "007-quantum-of-solace-playstation-2",
    title: "007: Quantum of Solace",
    summary: "Activision's PS2 adaptation of the Daniel Craig Bond film delivers third-person cover shooting through the film's locations, translating the grittier reboot era of the spy franchise into an accessible cover-based action format.",
  },
  {
    gameId: "18-wheeler-american-pro-trucker-playstation-2",
    title: "18 Wheeler: American Pro Trucker",
    summary: "Sega's PS2 port of the arcade trucker delivers coast-to-coast cargo hauling across American highways with a rival-ramming competitive mode, bringing the coin-op's big-rig power fantasy to the home console with satisfying vehicular weight.",
  },
  {
    gameId: "24-the-game-playstation-2",
    title: "24: The Game",
    summary: "SCE Cambridge's PS2 action game bridges seasons two and three of the Fox drama series with Jack Bauer pursuing terrorists through a mix of driving, shooting, and stealth missions, produced with the show's cast and showrunners.",
  },
  {
    gameId: "50-cent-bulletproof-playstation-2",
    title: "50 Cent: Bulletproof",
    summary: "Vivendi's PS2 third-person shooter follows 50 Cent on a revenge mission through New York criminal organizations, featuring the rapper's voice acting and music throughout a violent urban action narrative with G-Unit branding.",
  },
  {
    gameId: "hack-mutation-playstation-2",
    title: ".hack//Mutation",
    summary: "CyberConnect2's PS2 second volume of the .hack franchise continues Kite's investigation into The World's mysteries, expanding the simulated MMORPG environment and deepening the conspiracy narrative across a new set of dungeons and story events.",
  },
  {
    gameId: "hack-outbreak-playstation-2",
    title: ".hack//Outbreak",
    summary: "CyberConnect2's PS2 third .hack volume escalates the coma-player mystery with new party members and increasingly unstable areas of The World, advancing the episodic RPG narrative toward a climax across a darker and more dangerous virtual environment.",
  },
  {
    gameId: "hack-quarantine-playstation-2",
    title: ".hack//Quarantine",
    summary: "CyberConnect2's PS2 concluding .hack volume resolves the Kite narrative with a final confrontation against the corrupted AI Morganna Mode Gone, closing the four-part episodic RPG with save transfers carrying progression from all three prior volumes.",
  },
  {
    gameId: "4x4-evo-playstation-2",
    title: "4x4 Evo",
    summary: "Terminal Reality's PS2 off-road racing simulation offers a licensed truck and SUV roster across muddy terrain courses, combining simulation-oriented vehicle customization with a career mode spanning diverse off-road environments.",
  },
  {
    gameId: "4x4-evo-2-playstation-2",
    title: "4x4 EVO 2",
    summary: "Terminal Reality's PS2 sequel expands the off-road vehicle roster and course selection of the original, refining the mud physics and suspension simulation in a more comprehensive take on the SUV and truck racing simulation format.",
  },
  {
    gameId: "25-to-life-playstation-2",
    title: "25 to Life",
    summary: "Eidos's PS2 urban crime third-person shooter places a detective against street gangs in a hip-hop influenced action game, released into a controversial cultural moment and notable for its online multiplayer mode alongside the single-player campaign.",
  },
  {
    gameId: "187-ride-or-die-playstation-2",
    title: "187 Ride or Die",
    summary: "Ubisoft's PS2 street racing game combines arcade driving with drive-by shooting mechanics across Los Angeles gang territory, blending vehicular combat and unlicensed urban racing in a budget-tier title targeting the hip-hop street racing genre.",
  },
  {
    gameId: "10-000-bullets-playstation-2",
    title: "10,000 Bullets",
    summary: "TYO's Japan-only PS2 third-person action game delivers a stylish bullet-time combat system across urban environments, using slow-motion dodge mechanics in a Japanese take on the cinematic gun-action genre popularized by Max Payne.",
  },
  {
    gameId: "7-blades-playstation-2",
    title: "7 Blades",
    summary: "Konami's PS2 samurai hack-and-slash follows a ninja through feudal Japan stages clearing multiple opponents with directional sword strikes, delivering a budget-tier Japanese action game in the tradition of console sword combat releases of the PS2 era.",
  },
  {
    gameId: "2nd-super-robot-wars-alpha-playstation-2",
    title: "2nd Super Robot Wars Alpha",
    summary: "Banpresto's Japan-only PS2 tactical RPG assembles mechs from dozens of anime series in grid-based strategic combat, building on the Super Robot Wars Alpha storyline with a massive roster of 80s and 90s super and real robot anime protagonists.",
  },
  {
    gameId: "3rd-super-robot-wars-alpha-to-the-end-of-the-galaxy-playstation-2",
    title: "3rd Super Robot Wars Alpha: To the End of the Galaxy",
    summary: "Banpresto's Japan-only PS2 conclusion to the Alpha storyline assembles the largest roster in the Alpha trilogy across a climactic campaign, closing out a multi-game arc that spanned the PS1 and PS2 eras of the long-running mech crossover franchise.",
  },
  {
    gameId: "hack-g-u-vol-2-reminisce-playstation-2",
    title: ".hack//G.U. Vol. 2//Reminisce",
    summary: "CyberConnect2's PS2 second G.U. volume continues Haseo's story in The World R:2, deepening the player-versus-player tournament arc and the investigation into the mysterious AIDA entities corrupting the game's virtual environment.",
  },
  {
    gameId: "hack-g-u-vol-3-redemption-playstation-2",
    title: ".hack//G.U. Vol. 3//Redemption",
    summary: "CyberConnect2's PS2 concluding G.U. volume resolves Haseo's redemption arc across a final battle against the corrupted Cubia, closing the three-part standalone sequel series with save progression and bonus content rewarding trilogy completion.",
  },
  {
    gameId: "2006-fifa-world-cup-playstation-2",
    title: "2006 FIFA World Cup",
    summary: "EA Canada's PS2 official tie-in to the 2006 Germany tournament features the complete 32-team World Cup competition with story presentation around the host nation's infrastructure, offering the definitive console recreation of the quadrennial football event.",
  },
]
function nowIso(){return new Date().toISOString()}
function hashValue(v){return crypto.createHash('sha256').update(String(v||'')).digest('hex')}
function ensureGameIds(db,p){const r=db.prepare(`SELECT id FROM games WHERE id IN (${p.map(()=>'?').join(', ')})`).all(...p.map(e=>e.gameId));const ids=new Set(r.map(x=>String(x.id)));const m=p.map(e=>e.gameId).filter(id=>!ids.has(id));if(m.length)throw new Error('Missing target games in sqlite: '+m.join(', '))}
function ensureSourceRecord(db,gameId,ts){const ex=db.prepare(`SELECT id FROM source_records WHERE entity_type='game' AND entity_id=? AND field_name='summary' AND source_name='internal' AND source_type='knowledge_registry' ORDER BY id DESC LIMIT 1`).get(gameId);if(ex){db.prepare(`UPDATE source_records SET compliance_status='approved',last_verified_at=?,confidence_level=0.8,notes='G2 summary batch 23' WHERE id=?`).run(ts,ex.id);return Number(ex.id)}const r=db.prepare(`INSERT INTO source_records (entity_type,entity_id,field_name,source_name,source_type,source_url,source_license,compliance_status,ingested_at,last_verified_at,confidence_level,notes) VALUES ('game',?,'summary','internal','knowledge_registry',NULL,NULL,'approved',?,?,0.8,'G2 summary batch 23')`).run(gameId,ts,ts);return Number(r.lastInsertRowid)}
function ensureFieldProvenance(db,gameId,srcId,summary,ts){const ex=db.prepare(`SELECT id FROM field_provenance WHERE entity_type='game' AND entity_id=? AND field_name='summary' ORDER BY id DESC LIMIT 1`).get(gameId);const vh=hashValue(summary);if(ex){db.prepare(`UPDATE field_provenance SET source_record_id=?,value_hash=?,is_inferred=0,confidence_level=0.8,verified_at=? WHERE id=?`).run(srcId,vh,ts,ex.id);return false}db.prepare(`INSERT INTO field_provenance (entity_type,entity_id,field_name,source_record_id,value_hash,is_inferred,confidence_level,verified_at) VALUES ('game',?,'summary',?,?,0,0.8,?)`).run(gameId,srcId,vh,ts);return true}
function upsertGameEditorialSummary(db,gameId,summary,srcId,ts){db.prepare(`INSERT INTO game_editorial (game_id,summary,source_record_id,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(game_id) DO UPDATE SET summary=excluded.summary,source_record_id=excluded.source_record_id,updated_at=excluded.updated_at`).run(gameId,summary,srcId,ts,ts)}
function createRun(db,runKey,ts,dry){const r=db.prepare(`INSERT INTO enrichment_runs (run_key,pipeline_name,mode,source_name,status,dry_run,started_at,items_seen,items_created,items_updated,items_skipped,items_flagged,error_count,notes) VALUES (?,'g2_summary_batch_23','apply','internal_curated','running',?,?,0,0,0,0,0,0,'G2 batch 23 — PlayStation 2 wave 1')`).run(runKey,dry?1:0,ts);return Number(r.lastInsertRowid)}
function finalizeRun(db,runId,ts,m){db.prepare(`UPDATE enrichment_runs SET status='completed',finished_at=?,items_seen=?,items_created=0,items_updated=?,items_skipped=?,items_flagged=?,error_count=0,notes=? WHERE id=?`).run(ts,m.itemsSeen,m.itemsUpdated,m.itemsSkipped,m.itemsFlagged,m.notes,runId)}
function readBefore(db,p){const r=db.prepare(`SELECT id,summary FROM games WHERE id IN (${p.map(()=>'?').join(', ')})`).all(...p.map(e=>e.gameId));return new Map(r.map(x=>[String(x.id),String(x.summary||'')]))}
function dryRun(db){const b=readBefore(db,G2_BATCH);return{targetedGames:G2_BATCH.length,summaryUpdates:G2_BATCH.filter(e=>!b.get(e.gameId).trim()).length,targets:G2_BATCH.map(e=>({gameId:e.gameId,title:e.title,hadSummaryBefore:Boolean(b.get(e.gameId).trim())}))}}
function applyBatch(db){const ts=nowIso();const runKey='g2-summary-batch-23-'+ts;const runId=createRun(db,runKey,ts,false);const m={itemsSeen:G2_BATCH.length,itemsUpdated:0,itemsSkipped:0,itemsFlagged:0,notes:'G2 summary batch 23 applied locally on staging sqlite'};db.transaction(()=>{for(const e of G2_BATCH){const srcId=ensureSourceRecord(db,e.gameId,ts);db.prepare('UPDATE games SET summary=? WHERE id=?').run(e.summary,e.gameId);upsertGameEditorialSummary(db,e.gameId,e.summary,srcId,ts);ensureFieldProvenance(db,e.gameId,srcId,e.summary,ts);m.itemsUpdated++}})();finalizeRun(db,runId,nowIso(),m);return{runId,runKey,metrics:m}}
function main(){const db=new Database(SQLITE_PATH);try{ensureGameIds(db,G2_BATCH);if(!APPLY){console.log(JSON.stringify({mode:'dry-run',sqlitePath:SQLITE_PATH,summary:dryRun(db)},null,2));return}console.log(JSON.stringify({mode:'apply',sqlitePath:SQLITE_PATH,summary:dryRun(db),result:applyBatch(db)},null,2))}finally{db.close()}}
main()
