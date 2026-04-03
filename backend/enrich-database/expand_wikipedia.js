'use strict';
/**
 * scripts/enrich/expand_wikipedia.js
 * ══════════════════════════════════════════════════════════════
 * Parse Wikipedia "List of X games" pages to discover new games
 * for the catalogue. Fetches HTML via REST API and parses tables.
 *
 * Usage :
 *   node scripts/enrich/expand_wikipedia.js --dry-run
 *   node scripts/enrich/expand_wikipedia.js --platform "Super Nintendo"
 *   node scripts/enrich/expand_wikipedia.js
 *
 * Tables are parsed for: Title, Developer, Publisher, Year
 * Deduplication via (title, console) — case-insensitive.
 */

const { db, supabase, USE_SUPABASE } = require('./bootstrap');
const cheerio = require('cheerio');

const args    = process.argv.slice(2);
const DRY     = args.includes('--dry-run');
const PLATFORM = args.includes('--platform') ? args[args.indexOf('--platform')+1] : null;
const sleep   = ms => new Promise(r => setTimeout(r, ms));

// ── Wikipedia List URLs ─────────────────────────────────────────────────────
const PLATFORM_LISTS = [
  { console: 'Super Nintendo', url: 'List_of_Super_Nintendo_Entertainment_System_games' },
  { console: 'PlayStation', url: 'List_of_PlayStation_games_(A%E2%80%93L)' },
  { console: 'Sega Genesis', url: 'List_of_Sega_Genesis_games' },
  { console: 'Nintendo 64', url: 'List_of_Nintendo_64_games' },
  { console: 'Game Boy', url: 'List_of_Game_Boy_games' },
  { console: 'Game Boy Advance', url: 'List_of_Game_Boy_Advance_games' },
  { console: 'Nintendo Entertainment System', url: 'List_of_Nintendo_Entertainment_System_games' },
];

// ── ID generator ──────────────────────────────────────────────────────────
function makeId(title, console_) {
  return `${title}-${console_}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

// ── DB helpers ─────────────────────────────────────────────────────────────
async function gameExists(title, console_) {
  if (USE_SUPABASE) {
    const { data, error } = await supabase
      .from('games')
      .select('id')
      .eq('title', title)
      .eq('console', console_)
      .limit(1);
    if (error) { console.error('[DB] gameExists failed:', error.message); return false; }
    return data && data.length > 0;
  }
  return !!db.prepare(
    'SELECT id FROM games WHERE LOWER(title)=? AND console=? LIMIT 1'
  ).get(title.toLowerCase(), console_);
}

async function insertGame(game) {
  if (DRY) {
    console.log(`  [DRY] ${game.title} (${game.console}) — ${game.developer || 'Unknown Dev'}`);
    return;
  }
  if (USE_SUPABASE) {
    const { error } = await supabase.from('games').insert({
      id: game.id,
      title: game.title,
      console: game.console,
      year: game.year,
      developer: game.developer,
      genre: game.genre || 'Action',
      rarity: game.rarity || 'COMMON',
      type: 'game',
      source_confidence: 0.60,
      source_name: 'wikipedia_list',
    });
    if (error) console.error(`[DB] insertGame failed for "${game.title}":`, error.message);
  } else {
    db.prepare(`
      INSERT OR IGNORE INTO games
      (id, title, console, year, developer, genre, rarity, type, source_confidence, source_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      game.id, game.title, game.console, game.year, game.developer,
      game.genre || 'Action', game.rarity || 'COMMON', 'game', 0.60, 'wikipedia_list'
    );
  }
}

// ── HTML Parsing ────────────────────────────────────────────────────────────
function parseGameTable(html, consoleName) {
  const $ = cheerio.load(html);
  const games = [];

  // Find all tables in the page
  const tables = $('table.wikitable, table[border="1"]');

  if (tables.length === 0) {
    console.warn(`  ⚠ No tables found for ${consoleName}`);
    return games;
  }

  tables.each((tableIdx, table) => {
    const $table = $(table);
    const rows = $table.find('tbody tr');

    if (rows.length === 0) {
      return; // Skip empty tables
    }

    // Try to find header row to map columns
    const headerRow = $table.find('th');
    const headers = headerRow.map((_, h) => $(h).text().trim().toLowerCase()).get();

    // Find column indices
    let titleIdx = headers.findIndex(h => h.includes('title') || h.includes('game'));
    let devIdx = headers.findIndex(h => h.includes('developer'));
    let pubIdx = headers.findIndex(h => h.includes('publisher'));
    let yearIdx = headers.findIndex(h => h.includes('year') || h.includes('release'));

    // Fallback: assume common column order (Title, Developer, Publisher, Year)
    if (titleIdx === -1) titleIdx = 0;
    if (devIdx === -1) devIdx = 1;
    if (pubIdx === -1) pubIdx = 2;
    if (yearIdx === -1) yearIdx = 3;

    // Parse data rows
    rows.each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td');

      if (cells.length < 2) return; // Skip rows with too few cells

      const getCellText = (idx) => {
        if (idx >= cells.length) return null;
        const $cell = $(cells[idx]);
        // Remove citations and links, keep text
        $cell.find('sup').remove();
        return $cell.text().trim();
      };

      const title = getCellText(titleIdx);
      const developer = getCellText(devIdx);
      const publisher = getCellText(pubIdx);
      const year = getCellText(yearIdx);

      if (!title || title.length < 2) return; // Skip empty titles

      // Parse year as integer
      let parsedYear = null;
      if (year) {
        const match = year.match(/\d{4}/);
        if (match) parsedYear = parseInt(match[0]);
      }

      games.push({
        title,
        console: consoleName,
        developer: developer && developer.length > 1 ? developer : null,
        publisher: publisher && publisher.length > 1 ? publisher : null,
        year: parsedYear,
      });
    });
  });

  return games;
}

// ── Wikipedia API Fetch ─────────────────────────────────────────────────────
async function fetchWikipediaList(consoleName, pageTitle) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(pageTitle)}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'RetroDex/1.0 (retrogaming-collector-tool; non-commercial)',
        'Accept': 'text/html',
      },
    });

    if (!res.ok) {
      console.warn(`  ✗ Failed to fetch (HTTP ${res.status})`);
      return [];
    }

    const html = await res.text();
    return parseGameTable(html, consoleName);
  } catch (err) {
    console.warn(`  ✗ Fetch error: ${err.message}`);
    return [];
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nRetroDex — Wikipedia game list expansion`);
  if (DRY) console.log('[DRY RUN]');

  const platformsToFetch = PLATFORM
    ? PLATFORM_LISTS.filter(p => p.console === PLATFORM)
    : PLATFORM_LISTS;

  if (platformsToFetch.length === 0) {
    console.log(`No platforms matched: ${PLATFORM}`);
    process.exit(1);
  }

  let totalNew = 0;
  let totalDupe = 0;

  for (const platform of platformsToFetch) {
    console.log(`\n[${platform.console}] Fetching from Wikipedia...`);
    const games = await fetchWikipediaList(platform.console, platform.url);
    console.log(`  Found ${games.length} game entries in table(s)`);

    let newCount = 0;
    let dupeCount = 0;

    for (const game of games) {
      const exists = await gameExists(game.title, game.console);
      if (exists) {
        dupeCount++;
        continue;
      }

      game.id = makeId(game.title, game.console);
      game.genre = 'Action'; // Default genre for Wikipedia-sourced games
      game.rarity = 'COMMON';

      await insertGame(game);
      newCount++;
      process.stdout.write(
        `\r  ✓ ${newCount} new · ${dupeCount} exist  (${game.title.slice(0, 35)})`
      );
      await sleep(50); // Light rate limiting
    }

    totalNew += newCount;
    totalDupe += dupeCount;
    console.log(`\n  ✓ ${newCount} inserted · ✗ ${dupeCount} already in DB`);
    await sleep(2000); // 2s between platforms (Wikipedia rate limit respect)
  }

  console.log(`\n\n✅ Complete`);
  console.log(`  Total new: ${totalNew}`);
  console.log(`  Total dupes: ${totalDupe}`);
  console.log(`  Total processed: ${totalNew + totalDupe}`);
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
