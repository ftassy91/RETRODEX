#!/usr/bin/env node
'use strict'
const path = require('path'), crypto = require('crypto'), Database = require('better-sqlite3')
const APPLY = process.argv.includes('--apply')
const SQLITE_PATH = path.join(__dirname, '..', '..', 'storage', 'retrodex.sqlite')
const G2_BATCH = [
  {
    gameId: "crash-bandicoot-playstation",
    title: "Crash Bandicoot",
    summary: "Naughty Dog's PS1 platformer launched Sony's answer to Mario with a spin-attacking marsupial across corridor-structured 3D stages, combining tight linear design with humorous character animation in a mascot game that sold the PlayStation brand.",
  },
  {
    gameId: "crash-bandicoot-2-cortex-strikes-back-playstation",
    title: "Crash Bandicoot 2: Cortex Strikes Back",
    summary: "Naughty Dog's PS1 sequel improves on the original with a hub world structure, new moves, and more varied stage types, refining the corridor platformer formula that made the first game a landmark and deepening its mechanical breadth.",
  },
  {
    gameId: "crash-bandicoot-3-warped-playstation",
    title: "Crash Bandicoot: Warped",
    summary: "Naughty Dog's PS1 trilogy closer adds motorcycle racing, biplane shooting, and underwater stages to the franchise, delivering the most mechanically varied Crash entry and widely regarded as the peak of the original Naughty Dog trilogy.",
  },
  {
    gameId: "crash-team-racing-playstation",
    title: "Crash Team Racing",
    summary: "Naughty Dog's PS1 kart racer puts the Crash Bandicoot cast through weapon-equipped circuit racing with a power-slide boost mechanic, widely considered one of the best kart racers of its era and a genuine rival to Mario Kart 64.",
  },
  {
    gameId: "castlevania-symphony-of-the-night-playstation",
    title: "Castlevania: Symphony of the Night",
    summary: "Konami's PS1 masterwork inverts the Castlevania formula into open RPG castle exploration with Alucard collecting gear and leveling stats, defining the Metroidvania template and serving as one of the most celebrated games of the 32-bit era.",
  },
  {
    gameId: "bushido-blade-playstation",
    title: "Bushido Blade",
    summary: "Light Weight's PS1 weapon fighter eliminates health bars for a limb-damage injury system where a single clean strike ends a match, creating a deliberate pacing and tactical depth unlike any competitive fighting game of its era.",
  },
  {
    gameId: "2-on-2-open-ice-challenge-playstation",
    title: "2 on 2 Open Ice Challenge",
    summary: "Midway's PS1 port of the 1995 arcade hockey game delivers a fast two-on-two no-rules ice hockey format with heavy body checking and arcade scoring, translating the coin-op's brutal ice combat to the PlayStation.",
  },
  {
    gameId: "a-train-playstation",
    title: "A-Train",
    summary: "Artdink's PS1 train management simulator tasks players with building and operating a profitable rail network across expanding urban environments, adapting the long-running Japanese economic simulation for the PlayStation platform.",
  },
  {
    gameId: "actua-soccer-playstation",
    title: "Actua Soccer",
    summary: "Gremlin Interactive's PS1 football simulation focuses on realistic ball physics and player stamina management, offering a simulation-oriented alternative to the era's more arcade-driven football games with licensed European leagues.",
  },
  {
    gameId: "3d-baseball-playstation",
    title: "3D Baseball",
    summary: "Crystal Dynamics' PS1 baseball simulation offers a 3D stadium perspective with licensed teams and a season mode, serving as an early PlayStation sports title demonstrating the hardware's ability to render dynamic camera baseball.",
  },
  {
    gameId: "actua-golf-playstation",
    title: "Actua Golf",
    summary: "Gremlin Interactive's PS1 golf simulation features realistic course terrain rendering and swing mechanics across licensed courses, positioning itself as a physics-driven alternative to the era's more arcade-oriented golf games.",
  },
  {
    gameId: "3d-lemmings-playstation",
    title: "3D Lemmings",
    summary: "Psygnosis's PS1 entry shifts the lemming-guiding puzzle franchise into three-dimensional stage structures, maintaining the assign-abilities puzzle loop in a perspective change that divided fans of the definitive 2D original.",
  },
  {
    gameId: "adidas-power-soccer-playstation",
    title: "Adidas Power Soccer",
    summary: "Psygnosis's PS1 licensed football game offers a fast arcade-oriented play style with the Adidas brand roster, arriving as an early high-quality soccer title at a time when football simulation was finding its footing on the platform.",
  },
  {
    gameId: "actua-tennis-playstation",
    title: "Actua Tennis",
    summary: "Gremlin Interactive's PS1 tennis simulation delivers a realistic serve-and-volley game with multiple camera angles and a full tournament structure, serving as the studio's extension of its Actua sports simulation series to the court.",
  },
  {
    gameId: "actua-golf-2-playstation",
    title: "Actua Golf 2",
    summary: "Gremlin Interactive's PS1 golf sequel improves on the original with additional courses and refined swing mechanics, continuing the studio's physics-focused simulation approach in a sport that the PlayStation library covered extensively.",
  },
  {
    gameId: "actua-pool-playstation",
    title: "Actua Pool",
    summary: "Gremlin Interactive's PS1 billiards game delivers an overhead and camera-selectable pool simulation with trick shot modes and a tournament structure, applying the Actua simulation brand to the billiards sport.",
  },
  {
    gameId: "007-racing-playstation",
    title: "007 Racing",
    summary: "Black Box's PS1 vehicular action game places Bond behind the wheel of licensed vehicles from the film franchise across mission-based stages, departing from the spy gameplay of other Bond titles to focus on automotive combat.",
  },
  {
    gameId: "007-the-world-is-not-enough-playstation",
    title: "007: The World Is Not Enough",
    summary: "Black Box's PS1 adaptation of the 1999 Bond film delivers third-person action across missions from the movie, offering a competent licensed action game that preceded the superior N64 GoldenEye follow-up by Black Box with similar mission structure.",
  },
  {
    gameId: "advan-racing-playstation",
    title: "Advan Racing",
    summary: "Genki's PS1 Advan-sponsored racing game offers licensed Yokohama tire physics simulation across Japanese mountain pass circuits, targeting the JDM enthusiast audience with a simulation-leaning format and tuning-focused progression.",
  },
  {
    gameId: "actua-ice-hockey-2-playstation",
    title: "Actua Ice Hockey 2",
    summary: "Gremlin Interactive's PS1 ice hockey sequel updates the original's simulation-oriented hockey with improved player AI and refined stick-handling mechanics, extending the Actua sports brand's pursuit of realistic sports simulation.",
  },
]
function nowIso(){return new Date().toISOString()}
function hashValue(v){return crypto.createHash('sha256').update(String(v||'')).digest('hex')}
function ensureGameIds(db,p){const r=db.prepare(`SELECT id FROM games WHERE id IN (${p.map(()=>'?').join(', ')})`).all(...p.map(e=>e.gameId));const ids=new Set(r.map(x=>String(x.id)));const m=p.map(e=>e.gameId).filter(id=>!ids.has(id));if(m.length)throw new Error('Missing target games in sqlite: '+m.join(', '))}
function ensureSourceRecord(db,gameId,ts){const ex=db.prepare(`SELECT id FROM source_records WHERE entity_type='game' AND entity_id=? AND field_name='summary' AND source_name='internal' AND source_type='knowledge_registry' ORDER BY id DESC LIMIT 1`).get(gameId);if(ex){db.prepare(`UPDATE source_records SET compliance_status='approved',last_verified_at=?,confidence_level=0.8,notes='G2 summary batch 20' WHERE id=?`).run(ts,ex.id);return Number(ex.id)}const r=db.prepare(`INSERT INTO source_records (entity_type,entity_id,field_name,source_name,source_type,source_url,source_license,compliance_status,ingested_at,last_verified_at,confidence_level,notes) VALUES ('game',?,'summary','internal','knowledge_registry',NULL,NULL,'approved',?,?,0.8,'G2 summary batch 20')`).run(gameId,ts,ts);return Number(r.lastInsertRowid)}
function ensureFieldProvenance(db,gameId,srcId,summary,ts){const ex=db.prepare(`SELECT id FROM field_provenance WHERE entity_type='game' AND entity_id=? AND field_name='summary' ORDER BY id DESC LIMIT 1`).get(gameId);const vh=hashValue(summary);if(ex){db.prepare(`UPDATE field_provenance SET source_record_id=?,value_hash=?,is_inferred=0,confidence_level=0.8,verified_at=? WHERE id=?`).run(srcId,vh,ts,ex.id);return false}db.prepare(`INSERT INTO field_provenance (entity_type,entity_id,field_name,source_record_id,value_hash,is_inferred,confidence_level,verified_at) VALUES ('game',?,'summary',?,?,0,0.8,?)`).run(gameId,srcId,vh,ts);return true}
function upsertGameEditorialSummary(db,gameId,summary,srcId,ts){db.prepare(`INSERT INTO game_editorial (game_id,summary,source_record_id,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(game_id) DO UPDATE SET summary=excluded.summary,source_record_id=excluded.source_record_id,updated_at=excluded.updated_at`).run(gameId,summary,srcId,ts,ts)}
function createRun(db,runKey,ts,dry){const r=db.prepare(`INSERT INTO enrichment_runs (run_key,pipeline_name,mode,source_name,status,dry_run,started_at,items_seen,items_created,items_updated,items_skipped,items_flagged,error_count,notes) VALUES (?,'g2_summary_batch_20','apply','internal_curated','running',?,?,0,0,0,0,0,0,'G2 batch 20 — PlayStation wave 5')`).run(runKey,dry?1:0,ts);return Number(r.lastInsertRowid)}
function finalizeRun(db,runId,ts,m){db.prepare(`UPDATE enrichment_runs SET status='completed',finished_at=?,items_seen=?,items_created=0,items_updated=?,items_skipped=?,items_flagged=?,error_count=0,notes=? WHERE id=?`).run(ts,m.itemsSeen,m.itemsUpdated,m.itemsSkipped,m.itemsFlagged,m.notes,runId)}
function readBefore(db,p){const r=db.prepare(`SELECT id,summary FROM games WHERE id IN (${p.map(()=>'?').join(', ')})`).all(...p.map(e=>e.gameId));return new Map(r.map(x=>[String(x.id),String(x.summary||'')]))}
function dryRun(db){const b=readBefore(db,G2_BATCH);return{targetedGames:G2_BATCH.length,summaryUpdates:G2_BATCH.filter(e=>!b.get(e.gameId).trim()).length,targets:G2_BATCH.map(e=>({gameId:e.gameId,title:e.title,hadSummaryBefore:Boolean(b.get(e.gameId).trim())}))}}
function applyBatch(db){const ts=nowIso();const runKey='g2-summary-batch-20-'+ts;const runId=createRun(db,runKey,ts,false);const m={itemsSeen:G2_BATCH.length,itemsUpdated:0,itemsSkipped:0,itemsFlagged:0,notes:'G2 summary batch 20 applied locally on staging sqlite'};db.transaction(()=>{for(const e of G2_BATCH){const srcId=ensureSourceRecord(db,e.gameId,ts);db.prepare('UPDATE games SET summary=? WHERE id=?').run(e.summary,e.gameId);upsertGameEditorialSummary(db,e.gameId,e.summary,srcId,ts);ensureFieldProvenance(db,e.gameId,srcId,e.summary,ts);m.itemsUpdated++}})();finalizeRun(db,runId,nowIso(),m);return{runId,runKey,metrics:m}}
function main(){const db=new Database(SQLITE_PATH);try{ensureGameIds(db,G2_BATCH);if(!APPLY){console.log(JSON.stringify({mode:'dry-run',sqlitePath:SQLITE_PATH,summary:dryRun(db)},null,2));return}console.log(JSON.stringify({mode:'apply',sqlitePath:SQLITE_PATH,summary:dryRun(db),result:applyBatch(db)},null,2))}finally{db.close()}}
main()
