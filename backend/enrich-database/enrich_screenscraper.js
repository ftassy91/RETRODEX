'use strict';
/**
 * scripts/enrich/enrich_screenscraper.js
 * ══════════════════════════════════════════════════════════════
 * Queries ScreenScraper.fr API to enrich games with media:
 *   - Cover art (box-2D front)
 *   - Screenshots
 *   - French synopsis (if available)
 *
 * Creates media_references records for external URLs.
 * Updates cover_url if empty.
 * Provenance: provider='screenscraper', storage_mode='external_reference'
 *
 * Usage:
 *   node enrich-database/enrich_screenscraper.js
 *   node enrich-database/enrich_screenscraper.js --dry-run
 *   node enrich-database/enrich_screenscraper.js --limit 10
 *   node enrich-database/enrich_screenscraper.js --dry-run --limit 5
 */

const { db, supabase, USE_SUPABASE } = require('./bootstrap');

const args  = process.argv.slice(2);
const DRY   = args.includes('--dry-run');
const LIMIT = (() => {
  const idx = args.indexOf('--limit');
  return idx >= 0 && args[idx + 1] ? parseInt(args[idx + 1], 10) : null;
})();

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Environment Validation ───────────────────────────────────────────────────
const SCREENSCRAPER_DEV_ID = process.env.SCREENSCRAPER_DEV_ID;
const SCREENSCRAPER_DEV_PASSWORD = process.env.SCREENSCRAPER_DEV_PASSWORD;

if (!SCREENSCRAPER_DEV_ID || !SCREENSCRAPER_DEV_PASSWORD) {
  console.error(`
Error: ScreenScraper API credentials not configured.

To use this script, register a free developer account at:
  https://www.screenscraper.fr/

Then add these to your backend/.env file:
  SCREENSCRAPER_DEV_ID=your_dev_id
  SCREENSCRAPER_DEV_PASSWORD=your_dev_password

API docs: https://www.screenscraper.fr/api2/
`);
  process.exit(1);
}

// ── Platform ID Mapping (ScreenScraper System IDs) ──────────────────────────
const PLATFORM_MAP = {
  'Sega Master System': 2,
  'Nintendo Entertainment System': 3,
  'Super Nintendo': 4,
  'Sega Genesis': 1,
  'Game Boy': 9,
  'Game Boy Advance': 12,
  'Nintendo 64': 14,
  'TurboGrafx-16': 31,
  'Game Gear': 21,
  'Sega Saturn': 22,
  'Dreamcast': 23,
  'Neo Geo': 142,
};

// ── ScreenScraper API Query ───────────────────────────────────────────────────
async function queryScreenScraper(title, platformId) {
  const params = new URLSearchParams({
    devid: SCREENSCRAPER_DEV_ID,
    devpassword: SCREENSCRAPER_DEV_PASSWORD,
    softname: 'retrodex',
    output: 'json',
    romnom: title,
    systemeid: platformId,
  });

  const url = `https://www.screenscraper.fr/api2/jeuInfos.php?${params}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'RetroDex/1.0 (retrodex enrichment script)',
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      return null; // No match found
    }

    const data = await res.json();
    return data.response || null;
  } catch (err) {
    console.log(`    [WARN] ScreenScraper query failed: ${err.message}`);
    return null;
  }
}

// ── Media Extraction ─────────────────────────────────────────────────────────
function extractMedia(response) {
  if (!response || !response.medias) {
    return { coverUrl: null, screenshots: [], synopsis: null };
  }

  const medias = response.medias;
  let coverUrl = null;
  let screenshots = [];
  let synopsis = response.synopsis?.fr || null;

  // Extract cover art (box-2D front)
  if (medias['box-2D']) {
    if (Array.isArray(medias['box-2D'])) {
      // Find front variant or use first
      const front = medias['box-2D'].find(m => m.type === 'front' || !m.type);
      coverUrl = front?.url || medias['box-2D'][0]?.url || null;
    } else {
      coverUrl = medias['box-2D'].url || null;
    }
  } else if (medias['box-2D-front']) {
    if (Array.isArray(medias['box-2D-front'])) {
      coverUrl = medias['box-2D-front'][0]?.url || null;
    } else {
      coverUrl = medias['box-2D-front'].url || null;
    }
  }

  // Extract screenshots (ss)
  if (medias.ss) {
    if (Array.isArray(medias.ss)) {
      screenshots = medias.ss
        .slice(0, 3) // Limit to 3 screenshots
        .map(s => s.url || s)
        .filter(Boolean);
    } else {
      screenshots = [medias.ss.url || medias.ss].filter(Boolean);
    }
  }

  return { coverUrl, screenshots, synopsis };
}

// ── DB Helpers ───────────────────────────────────────────────────────────────
async function getGamesWithoutCover(limit = null) {
  if (USE_SUPABASE) {
    let query = supabase
      .from('games')
      .select('id,title,console,cover_url,type')
      .is('cover_url', null)
      .eq('type', 'game');

    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) { console.error('[ERROR] getGamesWithoutCover failed:', error.message); return []; }
    return data || [];
  }

  let sql = "SELECT id,title,console,cover_url,type FROM games WHERE cover_url IS NULL AND type='game'";
  if (limit) sql += ` LIMIT ${limit}`;

  return db.prepare(sql).all();
}

async function insertMediaReference(gameId, url, type, provider = 'screenscraper') {
  if (DRY) {
    console.log(`      [DRY] INSERT media_reference: game_id=${gameId}, type=${type}, provider=${provider}`);
    return;
  }

  if (USE_SUPABASE) {
    const { error } = await supabase.from('media_references').insert({
      game_id: gameId,
      url: url,
      type: type,
      provider: provider,
      storage_mode: 'external_reference',
    });
    if (error) console.error(`  [ERROR] insertMediaReference failed for ${gameId}:`, error.message);
  } else {
    db.prepare(`
      INSERT INTO media_references (game_id, url, type, provider, storage_mode)
      VALUES (?, ?, ?, ?, ?)
    `).run(gameId, url, type, provider, 'external_reference');
  }
}

async function updateGameCoverUrl(gameId, coverUrl) {
  if (DRY) {
    console.log(`      [DRY] UPDATE game: id=${gameId}, cover_url=${coverUrl}`);
    return;
  }

  if (USE_SUPABASE) {
    const { error } = await supabase
      .from('games')
      .update({ cover_url: coverUrl })
      .eq('id', gameId);
    if (error) console.error(`  [ERROR] updateGameCoverUrl failed for ${gameId}:`, error.message);
  } else {
    db.prepare('UPDATE games SET cover_url = ? WHERE id = ?').run(coverUrl, gameId);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\nRetroDex — ScreenScraper Media Enrichment');
  if (DRY) console.log('[DRY RUN — no database writes]\n');
  if (LIMIT) console.log(`[LIMIT: ${LIMIT} games]\n`);

  const games = await getGamesWithoutCover(LIMIT);
  console.log(`Found ${games.length} games without cover art\n`);

  if (!games.length) {
    console.log('All games have cover art — nothing to do!');
    return;
  }

  let processed = 0;
  let matched = 0;
  let coversFilled = 0;
  let mediaCreated = 0;

  for (const game of games) {
    const platformId = PLATFORM_MAP[game.console];

    // Skip if platform not in our mapping
    if (!platformId) {
      console.log(`  [${game.title}] ⊘ Platform "${game.console}" not supported by ScreenScraper`);
      processed++;
      continue;
    }

    process.stdout.write(`  [${processed + 1}/${games.length}] ${game.title.padEnd(40)}`);

    // Query ScreenScraper
    const response = await queryScreenScraper(game.title, platformId);

    if (!response) {
      console.log(' ✗ No match');
      processed++;
      await sleep(1000); // Rate limit: 1s between requests
      continue;
    }

    console.log(' ✓ Found');
    matched++;

    const { coverUrl, screenshots, synopsis } = extractMedia(response);

    // Update cover_url if found
    if (coverUrl) {
      await updateGameCoverUrl(game.id, coverUrl);
      coversFilled++;
      console.log(`    • Cover: ${coverUrl.slice(0, 60)}...`);
    }

    // Insert media_reference for cover
    if (coverUrl) {
      await insertMediaReference(game.id, coverUrl, 'cover_image', 'screenscraper');
      mediaCreated++;
    }

    // Insert media_references for screenshots
    for (const ssUrl of screenshots) {
      await insertMediaReference(game.id, ssUrl, 'screenshot', 'screenscraper');
      mediaCreated++;
    }
    if (screenshots.length > 0) {
      console.log(`    • Screenshots: ${screenshots.length}`);
    }

    // Log synopsis if available
    if (synopsis) {
      const preview = synopsis.slice(0, 50).replace(/\n/g, ' ');
      console.log(`    • Synopsis (FR): ${preview}...`);
    }

    processed++;
    await sleep(1000); // Rate limit: 1s between requests
  }

  console.log(`\n\nDone: ${matched}/${games.length} matched, ${coversFilled} covers filled, ${mediaCreated} media created`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
