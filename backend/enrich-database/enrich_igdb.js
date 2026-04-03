'use strict';
/**
 * enrich-database/enrich_igdb.js
 * ══════════════════════════════════════════════════════════════
 * Enriches the RetroDex database with IGDB (Twitch) data:
 *   - cover_url (transforms IGDB image hash to t_cover_big_2x URL)
 *   - developer  (company flagged as developer)
 *   - synopsis   (IGDB summary field)
 *   - Inserts a media_references row for each cover found
 *
 * Only updates NULL / empty fields — never overwrites existing data.
 *
 * Usage:
 *   node enrich-database/enrich_igdb.js
 *   node enrich-database/enrich_igdb.js --dry-run
 *   node enrich-database/enrich_igdb.js --limit 50
 *   node enrich-database/enrich_igdb.js --dry-run --limit 10
 *
 * Env vars required:
 *   TWITCH_CLIENT_ID     — from dev.twitch.tv
 *   TWITCH_CLIENT_SECRET — from dev.twitch.tv
 */

const { db, supabase, USE_SUPABASE } = require('./bootstrap');

// ── CLI args ─────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY     = args.includes('--dry-run');
const LIMIT   = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : null;
const sleep   = ms => new Promise(r => setTimeout(r, ms));

// ── IGDB Platform IDs ─────────────────────────────────────────────────────
const PLATFORM_MAP = {
  'Super Nintendo':                  19,
  'PlayStation':                      7,
  'Sega Genesis':                    29,
  'Nintendo 64':                      4,
  'Game Boy':                        33,
  'Game Boy Advance':                24,
  'Nintendo Entertainment System':   18,
  'Sega Saturn':                     32,
  'Dreamcast':                       23,
  'Neo Geo':                         80,
  'TurboGrafx-16':                   86,
  'Game Gear':                       35,
  'Sega Master System':              64,
};

// ── Env var check ─────────────────────────────────────────────────────────
function checkEnvVars() {
  const clientId     = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('\n[ERROR] Missing required environment variables.\n');
    console.error('To use the IGDB enrichment script, you need Twitch API credentials:');
    console.error('');
    console.error('  1. Go to https://dev.twitch.tv/console and create an application');
    console.error('  2. Set the OAuth redirect URL to http://localhost');
    console.error('  3. Copy the Client ID and generate a Client Secret');
    console.error('  4. Add to your backend/.env file:');
    console.error('');
    console.error('     TWITCH_CLIENT_ID=your_client_id_here');
    console.error('     TWITCH_CLIENT_SECRET=your_client_secret_here');
    console.error('');
    console.error('IGDB is a free API (up to 4 requests/second) — no payment required.');
    console.error('Documentation: https://api-docs.igdb.com/\n');
    process.exit(1);
  }

  return { clientId, clientSecret };
}

// ── Twitch OAuth ──────────────────────────────────────────────────────────
async function getAccessToken(clientId, clientSecret) {
  const url = `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`;
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Twitch OAuth failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Twitch OAuth: no access_token in response');
  }
  return data.access_token;
}

// ── IGDB query ────────────────────────────────────────────────────────────
/**
 * Query IGDB for a game by title + platform ID.
 * Returns the first matching result or null.
 */
async function queryIGDB(clientId, token, title, platformId) {
  const body = [
    'fields name,cover.url,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,summary;',
    `search "${title.replace(/"/g, '')}";`,
    `where platforms = (${platformId});`,
    'limit 5;',
  ].join('\n');

  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Client-ID':     clientId,
      'Authorization': `Bearer ${token}`,
      'Accept':        'application/json',
      'Content-Type':  'text/plain',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IGDB query failed: ${res.status} — ${text}`);
  }

  const results = await res.json();
  return results && results.length > 0 ? pickBestMatch(results, title) : null;
}

// ── Title matching ────────────────────────────────────────────────────────
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
  if (na.length > 5 && nb.length > 5) {
    if (na.includes(nb) || nb.includes(na)) return true;
  }
  return false;
}

/**
 * From IGDB results array, pick the best match for a given DB title.
 * Prefers exact/fuzzy title match; falls back to first result.
 */
function pickBestMatch(results, dbTitle) {
  const exact = results.find(r => titlesMatch(r.name || '', dbTitle));
  return exact || results[0];
}

// ── Cover URL transformation ──────────────────────────────────────────────
/**
 * IGDB returns cover URLs like //images.igdb.com/igdb/image/upload/t_thumb/{hash}.jpg
 * We want: https://images.igdb.com/igdb/image/upload/t_cover_big_2x/{hash}.jpg
 */
function transformCoverUrl(igdbUrl) {
  if (!igdbUrl) return null;
  // Extract hash from the path (last segment without extension)
  const match = igdbUrl.match(/\/([^/]+)\.(jpg|png|webp)$/i);
  if (!match) return null;
  const hash = match[1];
  return `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${hash}.jpg`;
}

// ── Extract enrichment fields from IGDB result ────────────────────────────
function extractFields(igdbGame) {
  const result = {
    cover_url:  null,
    developer:  null,
    summary:    null,  // maps to synopsis in our schema
  };

  // Cover
  if (igdbGame.cover && igdbGame.cover.url) {
    result.cover_url = transformCoverUrl(igdbGame.cover.url);
  }

  // Developer (first company flagged as developer)
  if (igdbGame.involved_companies && igdbGame.involved_companies.length > 0) {
    const devEntry = igdbGame.involved_companies.find(ic => ic.developer);
    if (devEntry && devEntry.company && devEntry.company.name) {
      result.developer = devEntry.company.name;
    }
    // Fallback: first company if no developer flag
    if (!result.developer) {
      const first = igdbGame.involved_companies[0];
      if (first && first.company && first.company.name) {
        result.developer = first.company.name;
      }
    }
  }

  // Summary → synopsis
  if (igdbGame.summary) {
    result.summary = igdbGame.summary;
  }

  return result;
}

// ── DB helpers ────────────────────────────────────────────────────────────
async function getGamesMissingCover() {
  if (USE_SUPABASE) {
    let query = supabase
      .from('games')
      .select('id,title,console,developer,synopsis,cover_url')
      .eq('type', 'game')
      .or('cover_url.is.null,cover_url.eq.');

    if (LIMIT) query = query.limit(LIMIT);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return data || [];
  }

  // SQLite
  const limitClause = LIMIT ? `LIMIT ${LIMIT}` : '';
  return db.prepare(`
    SELECT id, title, console, developer, synopsis, cover_url
    FROM games
    WHERE type = 'game'
      AND (cover_url IS NULL OR cover_url = '')
    ORDER BY title
    ${limitClause}
  `).all();
}

async function updateGame(id, fields) {
  if (DRY) {
    const summary = Object.entries(fields).map(([k, v]) => {
      const display = typeof v === 'string' && v.length > 60 ? v.slice(0, 57) + '...' : v;
      return `${k}=${display}`;
    }).join(', ');
    console.log(`  [DRY] ${id} → ${summary}`);
    return;
  }

  if (USE_SUPABASE) {
    const { error } = await supabase.from('games').update(fields).eq('id', id);
    if (error) console.error(`  [ERROR] Supabase update failed for ${id}: ${error.message}`);
  } else {
    const keys = Object.keys(fields);
    const sets = keys.map(k => `${k}=?`).join(', ');
    const vals = keys.map(k => fields[k]);
    db.prepare(`UPDATE games SET ${sets} WHERE id=?`).run(...vals, id);
  }
}

async function insertMediaReference(gameId, coverUrl) {
  if (DRY) {
    console.log(`  [DRY] media_references → game:${gameId} cover ${coverUrl.slice(0, 60)}...`);
    return;
  }

  if (USE_SUPABASE) {
    const { error } = await supabase.from('media_references').upsert({
      entity_type:        'game',
      entity_id:          gameId,
      media_type:         'cover',
      url:                coverUrl,
      provider:           'igdb',
      compliance_status:  'approved_with_review',
      storage_mode:       'external_reference',
    }, {
      onConflict: 'entity_type,entity_id,media_type,url',
      ignoreDuplicates: true,
    });
    if (error) console.error(`  [ERROR] media_references insert failed for ${gameId}: ${error.message}`);
  } else {
    try {
      db.prepare(`
        INSERT OR IGNORE INTO media_references
          (entity_type, entity_id, media_type, url, provider, compliance_status, storage_mode)
        VALUES ('game', ?, 'cover', ?, 'igdb', 'approved_with_review', 'external_reference')
      `).run(gameId, coverUrl);
    } catch (err) {
      console.error(`  [ERROR] media_references insert failed for ${gameId}: ${err.message}`);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('\nRetroDex — IGDB Enrichment');
  if (DRY)   console.log('[DRY RUN — no database writes]');
  if (LIMIT) console.log(`[LIMIT — processing at most ${LIMIT} games]`);
  console.log('');

  // Validate env vars (exits with instructions if missing)
  const { clientId, clientSecret } = checkEnvVars();

  // Get Twitch access token
  console.log('Authenticating with Twitch API...');
  let token;
  try {
    token = await getAccessToken(clientId, clientSecret);
    console.log('  Token obtained.\n');
  } catch (err) {
    console.error(`[FATAL] ${err.message}`);
    process.exit(1);
  }

  // Load games missing a cover_url
  console.log('Loading games missing cover_url from database...');
  let games;
  try {
    games = await getGamesMissingCover();
  } catch (err) {
    console.error(`[FATAL] DB query failed: ${err.message}`);
    process.exit(1);
  }
  console.log(`  Found ${games.length} games to enrich.\n`);

  if (games.length === 0) {
    console.log('Nothing to do — all games already have a cover_url.');
    return;
  }

  let found = 0, updated = 0, fieldsTotal = 0, notFound = 0, errors = 0;

  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    const platformId = PLATFORM_MAP[game.console];

    // Skip platforms not in our IGDB map (no search possible)
    if (!platformId) {
      process.stdout.write(`\r  [${i + 1}/${games.length}] SKIP (unknown platform: ${game.console}) — ${game.title.slice(0, 30)}`);
      notFound++;
      continue;
    }

    let igdbGame;
    try {
      igdbGame = await queryIGDB(clientId, token, game.title, platformId);
    } catch (err) {
      console.log(`\n  [ERROR] IGDB query failed for "${game.title}": ${err.message}`);
      errors++;
      await sleep(1000); // back off on errors
      continue;
    }

    if (!igdbGame) {
      notFound++;
      process.stdout.write(`\r  [${i + 1}/${games.length}] NOT FOUND — ${game.title.slice(0, 40)}`);
      await sleep(250);
      continue;
    }

    found++;
    const extracted = extractFields(igdbGame);
    const gameUpdates = {};

    // cover_url: fill only if empty
    if (extracted.cover_url && (!game.cover_url || game.cover_url === '')) {
      gameUpdates.cover_url = extracted.cover_url;
    }

    // developer: fill only if empty
    if (extracted.developer && (!game.developer || game.developer === '' || game.developer === 'Unknown')) {
      gameUpdates.developer = extracted.developer;
    }

    // synopsis: fill only if empty (IGDB summary → our synopsis column)
    if (extracted.summary && (!game.synopsis || game.synopsis === '')) {
      gameUpdates.synopsis = extracted.summary;
    }

    const fieldCount = Object.keys(gameUpdates).length;

    if (fieldCount > 0) {
      await updateGame(game.id, gameUpdates);
      updated++;
      fieldsTotal += fieldCount;
    }

    // Always insert media_references entry if we have a cover (idempotent via IGNORE)
    if (extracted.cover_url) {
      await insertMediaReference(game.id, extracted.cover_url);
    }

    process.stdout.write(
      `\r  [${i + 1}/${games.length}] found=${found} updated=${updated} fields=${fieldsTotal} notFound=${notFound} — ${game.title.slice(0, 30)}`
    );

    // Rate limit: 250ms between requests (~4 req/s, within IGDB free tier)
    await sleep(250);
  }

  console.log('\n');
  console.log('══════════════════════════════════════════');
  console.log(`  Games processed : ${games.length}`);
  console.log(`  IGDB matches    : ${found}`);
  console.log(`  Games updated   : ${updated}`);
  console.log(`  Fields filled   : ${fieldsTotal}`);
  console.log(`  Not found       : ${notFound}`);
  console.log(`  Errors          : ${errors}`);
  if (DRY) console.log('\n  [DRY RUN — no writes were made]');
  console.log('══════════════════════════════════════════\n');
}

main().catch(e => { console.error('\n[FATAL]', e.message); process.exit(1); });
