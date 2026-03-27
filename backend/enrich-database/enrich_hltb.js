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

const HLTB_API_URL = 'https://howlongtobeat.com/api/search';
const RATE_LIMIT_MS = 1500; // 1.5 seconds between requests

// ── Fetch from HowLongToBeat API ──────────────────────────────────────────
async function fetchHLTBData(gameTitle) {
  const payload = {
    searchType: 'games',
    searchTerms: [gameTitle],
    searchPage: 1,
    size: 5,
    searchOptions: {
      games: {
        userId: 0,
        platform: '',
        sortCategory: 'popular',
        rangeCategory: 'main',
        rangeTime: { min: null, max: null },
        gameplay: {
          perspective: '',
          flow: '',
          genre: ''
        },
        rangeYear: { min: '', max: '' },
        modifier: ''
      }
    }
  };

  try {
    const res = await fetch(HLTB_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://howlongtobeat.com'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.log(`  [WARN] HLTB returned ${res.status} for "${gameTitle}"`);
      return null;
    }

    const data = await res.json();
    const games = data.data || [];

    if (!games.length) {
      return null;
    }

    // Return first match
    const match = games[0];
    return {
      title: match.game_name || gameTitle,
      main: match.comp_main ? Math.round((match.comp_main / 3600) * 10) / 10 : null,
      extras: match.comp_plus ? Math.round((match.comp_plus / 3600) * 10) / 10 : null,
      completionist: match.comp_100 ? Math.round((match.comp_100 / 3600) * 10) / 10 : null,
      all: match.comp_all ? Math.round((match.comp_all / 3600) * 10) / 10 : null
    };
  } catch (err) {
    console.log(`  [ERROR] HLTB fetch failed for "${gameTitle}": ${err.message}`);
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
    const { data } = await supabase
      .from('games')
      .select('id,title,console,source_name')
      .eq('type', 'game');
    return data || [];
  }
  // SQLite
  try {
    return db.prepare(
      "SELECT id,title,console,source_name FROM games WHERE type='game'"
    ).all();
  } catch (err) {
    console.error('[ERROR] Failed to query games:', err.message);
    return [];
  }
}

async function getGameEditorial(gameId) {
  if (USE_SUPABASE) {
    const { data } = await supabase
      .from('game_editorial')
      .select('completion_times')
      .eq('game_id', gameId)
      .single();
    return data?.completion_times ? JSON.parse(data.completion_times) : null;
  }
  // SQLite
  try {
    const row = db.prepare(
      'SELECT completion_times FROM game_editorial WHERE game_id=?'
    ).get(gameId);
    return row?.completion_times ? JSON.parse(row.completion_times) : null;
  } catch {
    return null;
  }
}

async function upsertGameEditorial(gameId, completionTimes) {
  if (DRY) {
    const summary = JSON.stringify(completionTimes);
    console.log(`  [DRY] game_editorial[${gameId}].completion_times = ${summary}`);
    return;
  }

  if (USE_SUPABASE) {
    await supabase
      .from('game_editorial')
      .upsert({
        game_id: gameId,
        completion_times: JSON.stringify(completionTimes)
      }, { onConflict: 'game_id' });
  } else {
    // SQLite — upsert logic
    const existing = db.prepare(
      'SELECT id FROM game_editorial WHERE game_id=?'
    ).get(gameId);

    if (existing) {
      db.prepare(
        'UPDATE game_editorial SET completion_times=? WHERE game_id=?'
      ).run(JSON.stringify(completionTimes), gameId);
    } else {
      db.prepare(
        'INSERT INTO game_editorial (game_id, completion_times) VALUES (?, ?)'
      ).run(gameId, JSON.stringify(completionTimes));
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
    if (existing && (existing.main || existing.extras || existing.completionist || existing.all)) {
      skipped++;
      process.stdout.write(
        `\r  ${i + 1}/${gamesToProcess.length} | ${matched} matched · ${updated} updated · ${skipped} skipped · ${errors} errors`
      );
      continue;
    }

    // Query HLTB
    const hltbData = await fetchHLTBData(game.title);

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

    // Build completion_times object — only include non-null values
    const completionTimes = {};
    if (hltbData.main !== null) completionTimes.main = hltbData.main;
    if (hltbData.extras !== null) completionTimes.extras = hltbData.extras;
    if (hltbData.completionist !== null) completionTimes.completionist = hltbData.completionist;
    if (hltbData.all !== null) completionTimes.all = hltbData.all;

    if (Object.keys(completionTimes).length === 0) {
      skipped++;
      process.stdout.write(
        `\r  ${i + 1}/${gamesToProcess.length} | ${matched} matched · ${updated} updated · ${skipped} skipped · ${errors} errors`
      );
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    // Upsert
    await upsertGameEditorial(game.id, completionTimes);
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
