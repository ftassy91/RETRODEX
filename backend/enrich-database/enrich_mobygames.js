'use strict';
/**
 * enrich-database/enrich_mobygames.js
 * ══════════════════════════════════════════════════════════════
 * Queries the MobyGames API to fill missing metadata for existing games:
 *   - developer, genre, synopsis (description)
 *
 * Only updates NULL / empty fields — never overwrites existing data.
 * Provenance: source_name='mobygames', confidence=0.75
 *
 * Rate limit: 360 req/hr (free tier) → 10 seconds between requests.
 *
 * Usage:
 *   node enrich-database/enrich_mobygames.js
 *   node enrich-database/enrich_mobygames.js --dry-run
 *   node enrich-database/enrich_mobygames.js --console "Super Nintendo"
 *   node enrich-database/enrich_mobygames.js --console "PlayStation" --limit 50
 *   node enrich-database/enrich_mobygames.js --limit 100 --dry-run
 */

const { db, supabase, USE_SUPABASE } = require('./bootstrap');

// ── API key guard ────────────────────────────────────────────────────────────
const MOBYGAMES_API_KEY = process.env.MOBYGAMES_API_KEY;
if (!MOBYGAMES_API_KEY) {
  console.error('\n[ERROR] MOBYGAMES_API_KEY is not set.\n');
  console.error('To get a free API key:');
  console.error('  1. Register at https://www.mobygames.com/info/api/');
  console.error('  2. Copy your key');
  console.error('  3. Add MOBYGAMES_API_KEY=<your_key> to backend/.env\n');
  process.exit(1);
}

// ── CLI args ─────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY     = args.includes('--dry-run');
const CONSOLE = args.includes('--console') ? args[args.indexOf('--console') + 1] : null;
const LIMIT   = args.includes('--limit')   ? parseInt(args[args.indexOf('--limit') + 1], 10) : 0;
const sleep   = ms => new Promise(r => setTimeout(r, ms));

const RATE_LIMIT_MS = 10_000; // 10 seconds — stays safely under 360 req/hr

// ── MobyGames platform IDs ───────────────────────────────────────────────────
const PLATFORM_MAP = {
  'Super Nintendo':              15,
  'PlayStation':                  6,
  'Sega Genesis':                16,
  'Nintendo 64':                  9,
  'Game Boy':                    10,
  'Game Boy Advance':            12,
  'Nintendo Entertainment System': 22,
  'Sega Saturn':                 23,
  'Dreamcast':                    8,
  'Neo Geo':                     36,
  'TurboGrafx-16':               40,
  'Game Gear':                   25,
  'Sega Master System':          26,
  'Atari Lynx':                  18,
};

// ── Genre mapping: MobyGames → RetroDex taxonomy ─────────────────────────────
// MobyGames uses a "genre/subgenre" hierarchy. We map from common genre labels.
const GENRE_MAP = {
  // Action
  'Action':                         'Action',
  'Shooter':                        "Shoot'em up",
  'Shoot \'Em Up':                  "Shoot'em up",
  "Shoot 'Em Up":                   "Shoot'em up",
  'Rail Shooter':                   "Shoot'em up",
  'Run and Gun':                    "Shoot'em up",
  'Fighting':                       'Fighting',
  'Beat \'Em Up':                   "Beat'em up",
  "Beat 'Em Up":                    "Beat'em up",
  'Platformer':                     'Platformer',
  'Platform':                       'Platformer',
  // RPG
  'Role-Playing':                   'RPG',
  'Role-playing (RPG)':             'RPG',
  'RPG':                            'RPG',
  'Action RPG':                     'Action-RPG',
  'Action Role-Playing':            'Action-RPG',
  'Tactical RPG':                   'RPG Tactique',
  'Strategy / Tactics':             'RPG Tactique',
  // Adventure
  'Adventure':                      'Adventure',
  'Point-and-Click':                'Adventure',
  'Visual Novel':                   'Visual Novel',
  // Puzzle
  'Puzzle':                         'Puzzle',
  // Strategy
  'Strategy':                       'Strategy',
  'Turn-based Strategy':            'Strategy',
  'Real-time Strategy':             'Strategy',
  // Sport / Racing
  'Sports':                         'Sport',
  'Racing':                         'Racing',
  'Racing / Driving':               'Racing',
  // Other
  'Simulation':                     'Simulation',
  'Music':                          'Music',
  'Rhythm':                         'Music',
  'Educational':                    'Simulation',
  'Arcade':                         'Arcade',
  'Board / Party Game':             'Strategy',
  'Survival Horror':                'Survival Horror',
  'Horror':                         'Survival Horror',
};

// ── MobyGames API helpers ────────────────────────────────────────────────────
const MOBY_BASE = 'https://api.mobygames.com/v1';

async function mobyFetch(path) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${MOBY_BASE}${path}${sep}api_key=${MOBYGAMES_API_KEY}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'RetroDex/1.0 (retrodex enrichment script)',
      'Accept':     'application/json',
    },
  });
  if (res.status === 401) throw new Error('MobyGames API key rejected (401). Check MOBYGAMES_API_KEY.');
  if (res.status === 429) throw new Error('MobyGames rate limit hit (429). Slow down requests.');
  if (!res.ok) return null;
  return res.json();
}

/**
 * Search MobyGames for a game by title and optional platform.
 * Returns the best-matching game object or null.
 */
async function searchGame(title, platformId) {
  const q      = encodeURIComponent(title);
  const pParam = platformId ? `&platform=${platformId}` : '';
  const data   = await mobyFetch(`/games?title=${q}${pParam}`);
  if (!data || !data.games || data.games.length === 0) return null;

  // Prefer exact title match; fall back to first result
  const norm       = normalizeTitle(title);
  const exactMatch = data.games.find(g => normalizeTitle(g.title) === norm);
  return exactMatch || data.games[0];
}

/**
 * Fetch full game details (description, genres, developers) from MobyGames.
 */
async function fetchGameDetails(mobyId) {
  return mobyFetch(`/games/${mobyId}`);
}

// ── Genre extraction ─────────────────────────────────────────────────────────
/**
 * Pick the best RetroDex genre from a MobyGames game detail object.
 * MobyGames returns genres as [{genre_category, genre_name}, ...].
 */
function extractGenre(mobyGame) {
  const genres = mobyGame.genres || [];
  if (!genres.length) return null;

  // Try mapping each genre name to our taxonomy
  for (const g of genres) {
    const name    = g.genre_name || '';
    const mapped  = GENRE_MAP[name];
    if (mapped) return mapped;
  }

  // Fallback: return the first genre name unmapped
  return genres[0]?.genre_name || null;
}

/**
 * Extract developer from MobyGames game_id details.
 * MobyGames stores this in the "involved_companies" array at the platform level.
 * For search results, developer info is not included — we need the full details.
 */
function extractDeveloper(mobyGame) {
  // MobyGames full game object has a `platforms` array, each with `developers`
  const platforms = mobyGame.platforms || [];
  for (const p of platforms) {
    const devs = p.developers || [];
    if (devs.length) return devs.map(d => d.company_name).join(', ');
  }
  return null;
}

/**
 * Extract description/synopsis from MobyGames game details.
 * The API returns description in the `description` field (HTML-ish text).
 */
function extractSynopsis(mobyGame) {
  const desc = mobyGame.description || '';
  if (!desc) return null;
  // Strip basic HTML tags that MobyGames sometimes includes
  return desc
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim()
    .slice(0, 2000); // cap at 2000 chars
}

// ── Title normalization ──────────────────────────────────────────────────────
function normalizeTitle(t) {
  return t
    .toLowerCase()
    .replace(/[''`:!?.,()\-–—&\/\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── DB helpers ───────────────────────────────────────────────────────────────
async function getGamesToEnrich(consoleName) {
  if (USE_SUPABASE) {
    let query = supabase
      .from('games')
      .select('id,title,console,developer,genre,synopsis,source_name')
      .eq('type', 'game')
      .or('developer.is.null,developer.eq.Unknown,genre.eq.Action,genre.is.null');

    if (consoleName) query = query.eq('console', consoleName);
    if (LIMIT > 0)   query = query.limit(LIMIT);

    const { data } = await query;
    return data || [];
  }

  // SQLite
  const conditions = `(developer IS NULL OR developer = 'Unknown' OR genre = 'Action' OR genre IS NULL)`;
  const consoleClause = consoleName ? `AND console = ?` : '';
  const limitClause   = LIMIT > 0   ? `LIMIT ${LIMIT}` : '';
  const sql = `SELECT id,title,console,developer,genre,synopsis,source_name FROM games WHERE type='game' AND ${conditions} ${consoleClause} ${limitClause}`;

  try {
    return consoleName
      ? db.prepare(sql).all(consoleName)
      : db.prepare(sql).all();
  } catch {
    // Fallback if synopsis column doesn't exist yet
    const sqlFallback = `SELECT id,title,console,developer,genre,source_name FROM games WHERE type='game' AND ${conditions} ${consoleClause} ${limitClause}`;
    return consoleName
      ? db.prepare(sqlFallback).all(consoleName)
      : db.prepare(sqlFallback).all();
  }
}

async function updateGame(id, fields) {
  if (DRY) {
    const summary = Object.entries(fields).map(([k, v]) => {
      const preview = typeof v === 'string' && v.length > 40 ? v.slice(0, 40) + '…' : v;
      return `${k}=${preview}`;
    }).join(', ');
    console.log(`  [DRY] ${id} → ${summary}`);
    return;
  }

  if (USE_SUPABASE) {
    await supabase.from('games').update(fields).eq('id', id);
  } else {
    const keys = Object.keys(fields);
    const sets = keys.map(k => {
      const col = k === 'sourceName'       ? 'source_name'
                : k === 'sourceConfidence' ? 'source_confidence'
                : k;
      return `${col}=?`;
    }).join(', ');
    const vals = keys.map(k => fields[k]);
    db.prepare(`UPDATE games SET ${sets} WHERE id=?`).run(...vals, id);
  }
}

// ── Enrichment logic ─────────────────────────────────────────────────────────
function computeUpdates(dbGame, mobyGame) {
  const updates = {};

  const developer = extractDeveloper(mobyGame);
  if (developer && (!dbGame.developer || dbGame.developer === 'Unknown')) {
    updates.developer = developer;
  }

  const genre = extractGenre(mobyGame);
  if (genre && (!dbGame.genre || dbGame.genre === 'Action' || dbGame.genre === 'Other')) {
    updates.genre = genre;
  }

  const synopsis = extractSynopsis(mobyGame);
  if (synopsis && !dbGame.synopsis) {
    updates.synopsis = synopsis;
  }

  return updates;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\nRetroDex — MobyGames Enrichment');
  if (DRY)     console.log('[DRY RUN — no database writes]');
  if (CONSOLE) console.log(`[FILTER] Console: ${CONSOLE}`);
  if (LIMIT)   console.log(`[FILTER] Limit: ${LIMIT} games`);
  console.log('');

  const consolesToProcess = CONSOLE
    ? [CONSOLE]
    : Object.keys(PLATFORM_MAP);

  // Validate --console value
  if (CONSOLE && !PLATFORM_MAP[CONSOLE]) {
    console.error(`[ERROR] Unknown console: "${CONSOLE}"`);
    console.error(`Supported: ${Object.keys(PLATFORM_MAP).join(', ')}`);
    process.exit(1);
  }

  let totalProcessed = 0;
  let totalUpdated   = 0;
  let totalFields    = 0;
  let totalSkipped   = 0;
  let totalNotFound  = 0;
  let requestCount   = 0;

  for (const consoleName of consolesToProcess) {
    const platformId = PLATFORM_MAP[consoleName];

    console.log(`\n[${consoleName}] Loading games from DB...`);
    const dbGames = await getGamesToEnrich(CONSOLE ? null : consoleName);
    const filtered = CONSOLE ? dbGames : dbGames; // already filtered by console in query

    // When running all consoles, we already filtered by console in SQL; skip re-filter.
    // When --console is passed, SQL returns all missing games across consoles.
    const games = CONSOLE
      ? dbGames.filter(g => g.console === consoleName)
      : dbGames;

    console.log(`  ${games.length} games need enrichment`);

    if (!games.length) {
      console.log(`  Skipping — nothing to enrich`);
      continue;
    }

    let matched   = 0;
    let fields    = 0;
    let skipped   = 0;
    let notFound  = 0;

    for (const dbGame of games) {
      totalProcessed++;

      // Rate-limit: sleep before every API call (after the first)
      if (requestCount > 0) await sleep(RATE_LIMIT_MS);

      // Step 1: Search MobyGames
      let searchResult;
      try {
        searchResult = await searchGame(dbGame.title, platformId);
        requestCount++;
      } catch (err) {
        console.error(`\n  [ERROR] Search failed for "${dbGame.title}": ${err.message}`);
        break; // Fatal API error (auth / rate-limit) — stop processing
      }

      if (!searchResult) {
        notFound++;
        totalNotFound++;
        process.stdout.write(`\r  ${matched} updated · ${notFound} not found · ${skipped} skipped (searching: ${dbGame.title.slice(0, 25)})`);
        continue;
      }

      // Step 2: Fetch full game details
      await sleep(RATE_LIMIT_MS);
      let mobyGame;
      try {
        mobyGame = await fetchGameDetails(searchResult.game_id);
        requestCount++;
      } catch (err) {
        console.error(`\n  [ERROR] Details fetch failed for "${dbGame.title}" (id=${searchResult.game_id}): ${err.message}`);
        break;
      }

      if (!mobyGame) {
        notFound++;
        totalNotFound++;
        continue;
      }

      // Step 3: Compute updates
      const updates = computeUpdates(dbGame, mobyGame);
      if (Object.keys(updates).length === 0) {
        skipped++;
        totalSkipped++;
        process.stdout.write(`\r  ${matched} updated · ${notFound} not found · ${skipped} skipped (${dbGame.title.slice(0, 25)})`);
        continue;
      }

      // Provenance
      updates.source_name       = 'mobygames';
      updates.source_confidence = 0.75;

      await updateGame(dbGame.id, updates);
      matched++;
      totalUpdated++;
      const fieldCount = Object.keys(updates).filter(k => k !== 'source_name' && k !== 'source_confidence').length;
      fields      += fieldCount;
      totalFields += fieldCount;

      process.stdout.write(`\r  ${matched} updated · ${notFound} not found · ${skipped} skipped (${dbGame.title.slice(0, 25)})`);
    }

    console.log(`\n  [${consoleName}] Done: ${matched} updated, ${fields} fields filled, ${notFound} not found, ${skipped} already complete`);
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Total processed : ${totalProcessed}`);
  console.log(`Total updated   : ${totalUpdated} games (${totalFields} fields filled)`);
  console.log(`Not found       : ${totalNotFound}`);
  console.log(`Already complete: ${totalSkipped}`);
  console.log(`API requests    : ${requestCount}`);
  console.log('');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
