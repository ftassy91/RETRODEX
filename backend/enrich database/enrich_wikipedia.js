'use strict';
/**
 * scripts/enrich/enrich_wikipedia.js
 * ══════════════════════════════════════════════════════════════
 * Enrichit synopsis + summary depuis Wikipedia REST API (gratuit, sans clé).
 * Cible : ~1481 jeux sans synopsis (98% de la base).
 *
 * Usage :
 *   node scripts/enrich/enrich_wikipedia.js
 *   node scripts/enrich/enrich_wikipedia.js --limit 200
 *   node scripts/enrich/enrich_wikipedia.js --dry-run
 *   node scripts/enrich/enrich_wikipedia.js --console "PlayStation"
 *
 * Aucune clé API requise.
 */

const { db, supabase, USE_SUPABASE } = require('./bootstrap');

const args       = process.argv.slice(2);
const DRY_RUN    = args.includes('--dry-run');
const LIMIT      = args.includes('--limit')   ? parseInt(args[args.indexOf('--limit')+1])   : 100;
const CONSOLE_F  = args.includes('--console') ? args[args.indexOf('--console')+1] : null;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Wikipedia API ──────────────────────────────────────────────────────────
async function wikiSearch(query) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.replace(/ /g,'_'))}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'RetroDex/1.0 (retrogaming-collector-tool; non-commercial)' } });
    if (!res.ok) return null;
    const d = await res.json();
    if (!d.extract || d.extract.length < 80) return null;
    return d;
  } catch { return null; }
}

function isVideoGameResult(data, game) {
  if (!data) return false;
  const desc = (data.description || '').toLowerCase();
  const title = (data.title || '').toLowerCase();
  return desc.includes('video game') || desc.includes('game') ||
         title.includes('game') || String(data.extract || '').includes(String(game.year || ''));
}

async function fetchSynopsis(game) {
  const attempts = [
    `${game.title} (video game)`,
    `${game.title} (${game.year} video game)`,
    `${game.title} (${game.console} game)`,
    game.title,
  ];
  for (const q of attempts) {
    const d = await wikiSearch(q);
    if (d && isVideoGameResult(d, game)) {
      return {
        synopsis: d.extract.slice(0, 1200),
        summary:  d.extract.slice(0, 250),
        wiki_url: d.content_urls?.desktop?.page || null,
      };
    }
    await sleep(150);
  }
  return null;
}

// ── DB helpers ─────────────────────────────────────────────────────────────
async function getGames() {
  if (USE_SUPABASE) {
    let q = supabase.from('games').select('id,title,console,year,developer').eq('type','game').is('synopsis',null);
    if (CONSOLE_F) q = q.eq('console', CONSOLE_F);
    const { data } = await q.limit(LIMIT);
    return data || [];
  }
  const where = CONSOLE_F ? `AND console=?` : '';
  const params = CONSOLE_F ? [LIMIT, CONSOLE_F] : [LIMIT];
  return db.prepare(`SELECT id,title,console,year,developer FROM games WHERE type='game' AND synopsis IS NULL ${where} LIMIT ?`)
    .all(LIMIT, ...(CONSOLE_F ? [CONSOLE_F] : []));
}

async function save(id, fields) {
  if (DRY_RUN) { console.log(`  [DRY] ${id}`, Object.keys(fields)); return; }
  if (USE_SUPABASE) await supabase.from('games').update(fields).eq('id', id);
  else {
    const sets = Object.keys(fields).map(k=>`${k}=?`).join(',');
    db.prepare(`UPDATE games SET ${sets} WHERE id=?`).run(...Object.values(fields), id);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const games = await getGames();
  console.log(`\nRetroDex — Wikipedia enrichment`);
  console.log(`Target: ${games.length} games without synopsis`);
  if (DRY_RUN) console.log('[DRY RUN]');

  let ok = 0, miss = 0;
  for (const g of games) {
    const result = await fetchSynopsis(g);
    if (result) {
      await save(g.id, { synopsis: result.synopsis, summary: result.summary });
      ok++;
      process.stdout.write(`\r  ✓ ${ok} updated  ✗ ${miss} missed  (${g.title.slice(0,30)})`);
    } else {
      miss++;
    }
    await sleep(300);
  }
  console.log(`\n\n✅ Done: ${ok} updated · ${miss} not found`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
