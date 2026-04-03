'use strict';
/**
 * backend/enrich-database/enrich_hltb.js
 * ══════════════════════════════════════════════════════════════
 * Queries HowLongToBeat API to fill completion time metadata for existing games:
 *   - comp_main: Main story completion time (hours)
 *   - comp_plus: Main + Extras (hours)
 *   - comp_100: Completionist (hours)
 *   - comp_all: All styles average (hours)
 *
 * Stores as JSON in game_editorial.completion_times field.
 * Only updates NULL fields — never overwrites existing data.
 * Provenance: source_name='howlongtobeat', confidence=0.85
 *
 * Usage:
 *   node enrich-database/enrich_hltb.js
 *   node enrich-database/enrich_hltb.js --dry-run
 *   node enrich-database/enrich_hltb.js --limit 10
 *   node enrich-database/enrich_hltb.js --dry-run --limit 5
 */

const { db, supabase, USE_SUPABASE } = require('./bootstrap');

const args  = process.argv.slice(2);
const DRY   = args.includes('--dry-run');
const LIMIT = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : null;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const HLTB_BASE = 'https://howlongtobeat.com';
const HLTB_API_URL = 'https://howlongtobeat.com/api/find';
const RATE_LIMIT_MS = 1500; // 1.5 seconds between requests

// ── Resolve HLTB session credentials ─────────────────────────────────────
// HLTB uses a session init endpoint that returns a short-lived token + keys.
// Endpoint: GET /api/find/init?t=<timestamp>
// Returns: { token, hpKey, hpVal }
let _hltbAuth = null;
let _hltbAuthFetchedAt = 0;
const HLTB_AUTH_TTL_MS = 10 * 60 * 1000; // refresh every 10 minutes

async function resolveHltbAuth() {
  const now = Date.now();
  if (_hltbAuth && (now - _hltbAuthFetchedAt) < HLTB_AUTH_TTL_MS) return _hltbAuth;

  try {
    const res = await fetch(`${HLTB_BASE}/api/find/init?t=${now}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': HLTB_BASE,
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Init returned ${res.status}`);
    const data = await res.json();
    if (!data.token) throw new Error('No token in init response');
    _hltbAuth = { token: data.token, hpKey: data.hpKey, hpVal: data.hpVal };
    _hltbAuthFetchedAt = now;
    console.log(`  [HLTB] Session initialized (hpKey: ${data.hpKey})`);
    return _hltbAuth;
  } catch (err) {
    // Auth failure is unrecoverable for this run — abort rather than silently burning through all games
    throw new Error(`HLTB session init failed: ${err.message}`);
  }
}

// ── Fetch from HowLongToBeat API ──────────────────────────────────────────
async function fetchHLTBData(gameTitle) {
  const auth = await resolveHltbAuth(); // throws on failure — propagates to main()

  const payload = {
    searchType: 'games',
    searchTerms: gameTitle.trim().split(' '),
    searchPage: 1,
    size: 20,
    searchOptions: {
      games: {
        userId: 0,
        platform: '',
        sortCategory: 'popular',
        rangeCategory: 'main',
        rangeTime: { min: null, max: null },
        gameplay: { perspective: '', flow: '', genre: '', difficulty: '' },
        rangeYear: { min: '', max: '' },
        modifier: ''
      },
      users: { sortCategory: 'postcount' },
      lists: { sortCategory: 'follows' },
      filter: '',
      sort: 0,
      randomizer: 0
    },
    useCache: true,
  };
  // HLTB requires [hpKey]: hpVal injected directly into the payload body
  if (auth.hpKey) payload[auth.hpKey] = auth.hpVal;

  try {
    const res = await fetch(HLTB_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': HLTB_BASE,
        'Origin': HLTB_BASE,
        'x-auth-token': auth.token,
        'x-hp-key': auth.hpKey,
        'x-hp-val': auth.hpVal,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    // Session expired — clear cache so next call re-initializes
    if (res.status === 401 || res.status === 403) {
      _hltbAuth = null;
      console.warn(`  [WARN] HLTB session expired (${res.status}), will re-init on next call`);
      return null;
    }

    if (!res.ok) {
      console.warn(`  [WARN] HLTB returned ${res.status} for "${gameTitle}"`);
      return null;
    }

    const data = await res.json();
    const games = data.data || [];
    if (!games.length) return null;

    const match = games[0];
    return {
      title: match.game_name || gameTitle,
      main: match.comp_main ? Math.round((match.comp_main / 3600) * 10) / 10 : null,
      extras: match.comp_plus ? Math.round((match.comp_plus / 3600) * 10) / 10 : null,
      completionist: match.comp_100 ? Math.round((match.comp_100 / 3600) * 10) / 10 : null,
      all: match.comp_all ? Math.round((match.comp_all / 3600) * 10) / 10 : null
    };
  } catch (err) {
    console.error(`  [ERROR] HLTB fetch failed for "${gameTitle}": ${err.message}`);
    return null;
  }
}

// ── Fuzzy title matching ──────────────────────────────────────────────────
function normalizeTitle(t) {
  return t
    .toLowerCase()
    .replace(/[''`:!?.,()\-–—&\/\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titlesMatch(a, b) {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return true;
  // Check containment for subtitle variations
  if (na.length > 5 && nb.length > 5) {
    if (na.includes(nb) || nb.includes(na)) return true;
  }
  return false;
}

// ── DB helpers ────────────────────────────────────────────────────────────
async function getAllGames() {
  if (USE_SUPABASE) {
    // Supabase paginates at 1000 rows — fetch all pages
    const PAGE = 1000;
    const all = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('games')
        .select('id,title,console')
        .eq('type', 'game')
        .range(from, from + PAGE - 1);
      if (error) { console.error('[ERROR] getAllGames failed:', error.message); return []; }
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  }
  // SQLite
  try {
    return db.prepare(
      "SELECT id,title,console FROM games WHERE type='game'"
    ).all();
  } catch (err) {
    console.error('[ERROR] Failed to query games:', err.message);
    return [];
  }
}

async function getGameEditorial(gameId) {
  if (USE_SUPABASE) {
    const { data, error } = await supabase
      .from('game_editorial')
      .select('avg_duration_main,avg_duration_complete')
      .eq('game_id', gameId)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.error(`  [ERROR] getGameEditorial failed for ${gameId}:`, error.message);
      return undefined; // distinct from null (not found) — caller should skip upsert
    }
    return data || null;
  }
  // SQLite
  try {
    const row = db.prepare(
      'SELECT avg_duration_main, avg_duration_complete FROM game_editorial WHERE game_id=?'
    ).get(gameId);
    return row || null;
  } catch (err) {
    console.error(`  [ERROR] getGameEditorial (SQLite) failed for ${gameId}:`, err.message);
    return undefined;
  }
}

async function upsertGameEditorial(gameId, hltbData) {
  const fields = {};
  if (hltbData.main !== null)         fields.avg_duration_main     = hltbData.main;
  if (hltbData.completionist !== null) fields.avg_duration_complete = hltbData.completionist;

  if (DRY) {
    console.log(`  [DRY] game_editorial[${gameId}] ← ${JSON.stringify(fields)}`);
    return;
  }

  if (USE_SUPABASE) {
    const { error } = await supabase
      .from('game_editorial')
      .upsert({ game_id: gameId, ...fields }, { onConflict: 'game_id' });
    if (error) console.error(`  [ERROR] upsertGameEditorial failed for ${gameId}:`, error.message);
  } else {
    try {
      const existing = db.prepare(
        'SELECT game_id FROM game_editorial WHERE game_id=?'
      ).get(gameId);

      if (existing) {
        const sets = Object.keys(fields).map(k => `${k}=?`).join(', ');
        db.prepare(
          `UPDATE game_editorial SET ${sets} WHERE game_id=?`
        ).run(...Object.values(fields), gameId);
      } else {
        const cols = ['game_id', ...Object.keys(fields)].join(', ');
        const phs  = ['?', ...Object.keys(fields).map(() => '?')].join(', ');
        db.prepare(
          `INSERT INTO game_editorial (${cols}) VALUES (${phs})`
        ).run(gameId, ...Object.values(fields));
      }
    } catch (err) {
      console.error(`  [ERROR] upsertGameEditorial (SQLite) failed for ${gameId}:`, err.message);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('\nRetroDex — HowLongToBeat Enrichment');
  if (DRY) console.log('[DRY RUN — no database writes]\n');

  const games = await getAllGames();
  console.log(`Loaded ${games.length} games from database\n`);

  if (!games.length) {
    console.log('No games found. Exiting.');
    return;
  }

  const gamesToProcess = LIMIT ? games.slice(0, LIMIT) : games;
  let matched = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < gamesToProcess.length; i++) {
    const game = gamesToProcess[i];

    // Check if already has completion times
    const existing = await getGameEditorial(game.id);
    if (existing === undefined) {
      // getGameEditorial logged the error — skip to avoid blind upsert
      errors++;
      process.stdout.write(
        `\r  ${i + 1}/${gamesToProcess.length} | ${matched} matched · ${updated} updated · ${skipped} skipped · ${errors} errors`
      );
      continue;
    }
    if (existing && (existing.avg_duration_main || existing.avg_duration_complete)) {
      skipped++;
      process.stdout.write(
        `\r  ${i + 1}/${gamesToProcess.length} | ${matched} matched · ${updated} updated · ${skipped} skipped · ${errors} errors`
      );
      continue;
    }

    // Query HLTB
    let hltbData;
    try {
      hltbData = await fetchHLTBData(game.title);
    } catch (err) {
      console.error(`  [ERROR] fetchHLTBData fatal for "${game.title}": ${err.message}`);
      errors++;
      process.stdout.write(
        `\r  ${i + 1}/${gamesToProcess.length} | ${matched} matched · ${updated} updated · ${skipped} skipped · ${errors} errors`
      );
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    if (!hltbData) {
      errors++;
      process.stdout.write(
        `\r  ${i + 1}/${gamesToProcess.length} | ${matched} matched · ${updated} updated · ${skipped} skipped · ${errors} errors`
      );
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    // Match by title
    if (!titlesMatch(game.title, hltbData.title)) {
      skipped++;
      process.stdout.write(
        `\r  ${i + 1}/${gamesToProcess.length} | ${matched} matched · ${updated} updated · ${skipped} skipped · ${errors} errors`
      );
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    // Skip if no usable data
    if (hltbData.main === null && hltbData.completionist === null) {
      skipped++;
      process.stdout.write(
        `\r  ${i + 1}/${gamesToProcess.length} | ${matched} matched · ${updated} updated · ${skipped} skipped · ${errors} errors`
      );
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    // Upsert
    await upsertGameEditorial(game.id, hltbData);
    matched++;
    updated++;

    process.stdout.write(
      `\r  ${i + 1}/${gamesToProcess.length} | ${matched} matched · ${updated} updated · ${skipped} skipped · ${errors} errors`
    );

    // Rate limit between requests
    await sleep(RATE_LIMIT_MS);
  }

  console.log(
    `\n\nDone: ${matched} matched, ${updated} updated, ${skipped} skipped, ${errors} errors`
  );
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
