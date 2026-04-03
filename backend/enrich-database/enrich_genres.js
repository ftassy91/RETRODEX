'use strict';
/**
 * scripts/enrich/enrich_genres.js
 * ══════════════════════════════════════════════════════════════
 * Deux missions :
 * 1. Normaliser les genres incohérents en base (Action RPG → Action-RPG, etc.)
 * 2. Remplir les genres "Other" et NULL via RAWG API (gratuit, 20k req/mois)
 *
 * RAWG ne requiert pas de clé pour un usage basique.
 *
 * Usage :
 *   node scripts/enrich/enrich_genres.js --normalize
 *   node scripts/enrich/enrich_genres.js --rawg --limit 200
 *   node scripts/enrich/enrich_genres.js --all
 */

const { db, supabase, USE_SUPABASE } = require('./bootstrap');

const args     = process.argv.slice(2);
const DRY_RUN  = args.includes('--dry-run');
const NORMALIZE = args.includes('--normalize') || args.includes('--all');
const DO_RAWG  = args.includes('--rawg') || args.includes('--all');
const LIMIT    = args.includes('--limit') ? parseInt(args[args.indexOf('--limit')+1]) : 200;
const sleep    = ms => new Promise(r => setTimeout(r, ms));

// ── Normalization map ──────────────────────────────────────────────────────
const NORM = {
  'Action RPG':                'Action-RPG',
  'Action-Platformer':         'Platformer',
  'Action Platformer':         'Platformer',
  'Beat em Up':                "Beat'em up",
  'Beat\'em Up':               "Beat'em up",
  'Shoot em Up':               "Shoot'em up",
  "Shoot'Em Up":               "Shoot'em up",
  'Rail Shooter':              "Shoot'em up",
  'Run & Gun':                 "Shoot'em up",
  'Run and Gun':               "Shoot'em up",
  'Strategy RPG':              'RPG Tactique',
  'Tactical RPG':              'RPG Tactique',
  'Turn-Based RPG':            'RPG',
  'Turn Based RPG':            'RPG',
  "RPG / Roguelike":           'RPG',
  "Beat'em up / RPG":          "Beat'em up",
  'Visual Novel / Puzzle':     'Visual Novel',
  'Puzzle / Aventure':         'Adventure',
  'Puzzle Platformer':         'Platformer',
  'Survival Horror':           'Survival Horror',
  'Survival Horr':             'Survival Horror',
  'Horror':                    'Survival Horror',
  'Racing / Shoot em Up':      'Racing',
  'Combat 2D':                 'Fighting',
  'Fighting Game':             'Fighting',
  'Sports':                    'Sport',
  'Sport Game':                'Sport',
  'Simulation Game':           'Simulation',
  'Strategy Game':             'Strategy',
  'Music Game':                'Music',
  'Rhythm':                    'Music',
  'Rhythm Game':               'Music',
};

// RAWG platform slugs
const RAWG_PLATFORMS = {
  'PlayStation':              18,
  'Super Nintendo':           79,
  'Sega Genesis':             167,
  'Mega Drive':               167,
  'Nintendo 64':              83,
  'Game Boy':                 43,
  'Game Boy Color':           43,
  'Game Boy Advance':         24,
  'Sega Saturn':              19,
  'NES':                      49,
  'Nintendo Entertainment System': 49,
  'PlayStation 2':            15,
  'Dreamcast':                167,
  'Nintendo DS':              77,
  'PSP':                      17,
  'Atari 2600':               71,
  'Neo Geo':                  166,
};

async function rawgSearch(title, consoleName) {
  const platformId = RAWG_PLATFORMS[consoleName];
  const q = encodeURIComponent(title.replace(/['"]/g, ''));
  const url = `https://api.rawg.io/api/games?search=${q}${platformId ? `&platforms=${platformId}` : ''}&page_size=3`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'RetroDex/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results || [];
    if (!results.length) return null;
    // Trouver le meilleur match titre
    const best = results.find(r => r.name.toLowerCase() === title.toLowerCase()) || results[0];
    if (!best.genres?.length) return null;
    // Mapper les genres RAWG vers nos genres
    return best.genres.map(g => g.name)[0] || null;
  } catch { return null; }
}

const RAWG_GENRE_MAP = {
  'Action':               'Action',
  'Indie':                'Action',
  'Adventure':            'Adventure',
  'RPG':                  'RPG',
  'Role-playing (RPG)':   'RPG',
  'Strategy':             'Strategy',
  'Shooter':              "Shoot'em up",
  'Casual':               'Action',
  'Simulation':           'Simulation',
  'Puzzle':               'Puzzle',
  'Arcade':               'Arcade',
  'Platformer':           'Platformer',
  'Racing':               'Racing',
  'Sports':               'Sport',
  'Massively Multiplayer':'RPG',
  'Family':               'Platformer',
  'Fighting':             'Fighting',
  'Board Games':          'Strategy',
  'Educational':          'Simulation',
  'Card':                 'Strategy',
};

// ── DB helpers ─────────────────────────────────────────────────────────────
async function getAllGames() {
  if (USE_SUPABASE) {
    const { data, error } = await supabase.from('games').select('id,title,console,genre').eq('type','game');
    if (error) { console.error('[ERROR] getAllGames failed:', error.message); return []; }
    return data || [];
  }
  return db.prepare("SELECT id,title,console,genre FROM games WHERE type='game'").all();
}

async function getGamesOtherGenre() {
  if (USE_SUPABASE) {
    const { data, error } = await supabase.from('games').select('id,title,console,year')
      .eq('type','game').or('genre.eq.Other,genre.is.null').limit(LIMIT);
    if (error) { console.error('[ERROR] getGamesOtherGenre failed:', error.message); return []; }
    return data || [];
  }
  return db.prepare("SELECT id,title,console,year FROM games WHERE type='game' AND (genre='Other' OR genre IS NULL) LIMIT ?").all(LIMIT);
}

async function save(id, genre) {
  if (DRY_RUN) { console.log(`  [DRY] ${id} → ${genre}`); return; }
  if (USE_SUPABASE) {
    const { error } = await supabase.from('games').update({ genre }).eq('id', id);
    if (error) console.error(`  [ERROR] Failed to save genre for ${id}:`, error.message);
  } else {
    db.prepare('UPDATE games SET genre=? WHERE id=?').run(genre, id);
  }
}

// ── Normalize ──────────────────────────────────────────────────────────────
async function normalizeGenres() {
  console.log('\n[NORMALIZE] Standardizing genre names...');
  const games = await getAllGames();
  let fixed = 0;
  for (const g of games) {
    const normalized = NORM[g.genre];
    if (normalized && normalized !== g.genre) {
      await save(g.id, normalized);
      fixed++;
      if (fixed <= 20) console.log(`  ✓ "${g.genre}" → "${normalized}" (${g.title})`);
    }
  }
  console.log(`[NORMALIZE] Fixed: ${fixed} games`);
}

// ── RAWG enrichment ────────────────────────────────────────────────────────
async function enrichViaRAWG() {
  console.log('\n[RAWG] Filling "Other" genres...');
  const games = await getGamesOtherGenre();
  console.log(`Target: ${games.length} games`);
  let ok = 0, miss = 0;

  for (const g of games) {
    const rawgGenre = await rawgSearch(g.title, g.console);
    const mapped = rawgGenre ? (RAWG_GENRE_MAP[rawgGenre] || rawgGenre) : null;
    if (mapped) {
      await save(g.id, mapped);
      ok++;
      process.stdout.write(`\r  ✓ ${ok} · ✗ ${miss} (${g.title.slice(0,25)})`);
    } else {
      miss++;
    }
    await sleep(400);
  }
  console.log(`\n[RAWG] Done: ${ok} filled · ${miss} not found`);
}

async function main() {
  if (NORMALIZE) await normalizeGenres();
  if (DO_RAWG)   await enrichViaRAWG();
  if (!NORMALIZE && !DO_RAWG) {
    console.log('Usage:\n  --normalize  Fix inconsistent genre names\n  --rawg       Fill "Other" genres via RAWG\n  --all        Both');
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
