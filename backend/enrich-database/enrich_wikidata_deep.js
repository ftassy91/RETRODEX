'use strict';
/**
 * scripts/enrich/enrich_wikidata_deep.js
 * ══════════════════════════════════════════════════════════════
 * Queries Wikidata SPARQL to fill missing metadata for existing games:
 *   - developer, composer, publisher, release date (year), genre, metascore
 *
 * Only updates NULL / empty fields — never overwrites existing data.
 * Provenance: source_name='wikidata', confidence=0.80
 *
 * Usage:
 *   node enrich-database/enrich_wikidata_deep.js
 *   node enrich-database/enrich_wikidata_deep.js --dry-run
 *   node enrich-database/enrich_wikidata_deep.js --console "Super Nintendo"
 *   node enrich-database/enrich_wikidata_deep.js --console "PlayStation" --dry-run
 */

const { db, supabase, USE_SUPABASE } = require('./bootstrap');

const args    = process.argv.slice(2);
const DRY     = args.includes('--dry-run');
const CONSOLE = args.includes('--console') ? args[args.indexOf('--console') + 1] : null;
const sleep   = ms => new Promise(r => setTimeout(r, ms));

// ── Platform Wikidata QIDs ───────────────────────────────────────────────
const PLATFORM_QID = {
  'Super Nintendo':  'Q183259',
  'PlayStation':     'Q170323',
  'Game Boy':        'Q10680',
  'Nintendo 64':     'Q184839',
  'Sega Genesis':    'Q182172',
  'Sega Saturn':     'Q200912',
  'Dreamcast':       'Q184198',
  'Game Boy Advance':'Q186437',
  'NES':             'Q172742',
  'Game Gear':       'Q1057',
  'Neo Geo':         'Q188642',
  'TurboGrafx-16':   'Q1198507',
  'WonderSwan':      'Q203992',
  'Atari Lynx':      'Q189685',
};

// ── SPARQL query builder ─────────────────────────────────────────────────
function buildQuery(platformQid) {
  return `SELECT ?game ?gameLabel ?developerLabel ?composerLabel ?publisherLabel ?date ?genreLabel ?metascore
WHERE {
  ?game wdt:P31 wd:Q7889 .
  ?game wdt:P400 wd:${platformQid} .
  OPTIONAL { ?game wdt:P178 ?developer }
  OPTIONAL { ?game wdt:P86 ?composer }
  OPTIONAL { ?game wdt:P123 ?publisher }
  OPTIONAL { ?game wdt:P577 ?date }
  OPTIONAL { ?game wdt:P136 ?genre }
  OPTIONAL { ?game p:P444 ?reviewStatement . ?reviewStatement ps:P444 ?metascore . ?reviewStatement pq:P447 wd:Q150248 }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
}`;
}

// ── Fetch from Wikidata SPARQL endpoint ──────────────────────────────────
async function fetchWikidataGames(consoleName) {
  const qid = PLATFORM_QID[consoleName];
  if (!qid) return [];

  const query = buildQuery(qid);
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'RetroDex/1.0 (retrodex enrichment script)',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      console.log(`  [WARN] Wikidata returned ${res.status} for ${consoleName}`);
      return [];
    }
    const data = await res.json();
    const bindings = data.results?.bindings || [];

    // Group by game entity to deduplicate multi-value rows
    const grouped = new Map();
    for (const b of bindings) {
      const label = b.gameLabel?.value || '';
      if (!label || label.startsWith('Q')) continue; // skip unresolved entities

      const uri = b.game?.value || label;
      if (!grouped.has(uri)) {
        grouped.set(uri, {
          title:      label,
          developers: new Set(),
          composers:  new Set(),
          publishers: new Set(),
          genres:     new Set(),
          year:       null,
          metascore:  null,
        });
      }
      const entry = grouped.get(uri);

      const dev = b.developerLabel?.value;
      if (dev && !dev.startsWith('Q')) entry.developers.add(dev);

      const comp = b.composerLabel?.value;
      if (comp && !comp.startsWith('Q')) entry.composers.add(comp);

      const pub = b.publisherLabel?.value;
      if (pub && !pub.startsWith('Q')) entry.publishers.add(pub);

      const genre = b.genreLabel?.value;
      if (genre && !genre.startsWith('Q')) entry.genres.add(genre);

      if (b.date?.value && !entry.year) {
        const y = parseInt(b.date.value.substring(0, 4));
        if (y > 1970 && y < 2020) entry.year = y;
      }

      if (b.metascore?.value && !entry.metascore) {
        const ms = parseInt(b.metascore.value);
        if (ms > 0 && ms <= 100) entry.metascore = ms;
      }
    }

    // Flatten sets to comma-separated strings
    return Array.from(grouped.values()).map(g => ({
      title:     g.title,
      developer: g.developers.size ? Array.from(g.developers).join(', ') : null,
      composer:  g.composers.size  ? Array.from(g.composers).join(', ')  : null,
      publisher: g.publishers.size ? Array.from(g.publishers).join(', ') : null,
      genre:     g.genres.size     ? Array.from(g.genres)[0]             : null,
      year:      g.year,
      metascore: g.metascore,
    }));
  } catch (err) {
    console.log(`  [ERROR] Wikidata fetch failed for ${consoleName}: ${err.message}`);
    return [];
  }
}

// ── Fuzzy title matching ─────────────────────────────────────────────────
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
  // Also check containment for subtitle variations
  if (na.length > 5 && nb.length > 5) {
    if (na.includes(nb) || nb.includes(na)) return true;
  }
  return false;
}

// ── DB helpers ───────────────────────────────────────────────────────────
async function getGamesByConsole(consoleName) {
  if (USE_SUPABASE) {
    const { data } = await supabase
      .from('games')
      .select('id,title,console,year,developer,genre,metascore,publisher,composer,source_name')
      .eq('console', consoleName)
      .eq('type', 'game');
    return data || [];
  }
  // SQLite — composer/publisher may not exist as columns; handle gracefully
  try {
    return db.prepare(
      "SELECT id,title,console,year,developer,genre,metascore,publisher,composer,source_name FROM games WHERE console=? AND type='game'"
    ).all(consoleName);
  } catch {
    // Fallback without composer/publisher columns
    return db.prepare(
      "SELECT id,title,console,year,developer,genre,metascore,source_name FROM games WHERE console=? AND type='game'"
    ).all(consoleName);
  }
}

async function updateGame(id, fields) {
  if (DRY) {
    const summary = Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(', ');
    console.log(`  [DRY] ${id} → ${summary}`);
    return;
  }
  if (USE_SUPABASE) {
    await supabase.from('games').update(fields).eq('id', id);
  } else {
    const keys = Object.keys(fields);
    const sets = keys.map(k => {
      // Map camelCase field names to snake_case column names for SQLite
      const col = k === 'sourceName' ? 'source_name'
                : k === 'sourceConfidence' ? 'source_confidence'
                : k;
      return `${col}=?`;
    }).join(', ');
    const vals = keys.map(k => fields[k]);
    db.prepare(`UPDATE games SET ${sets} WHERE id=?`).run(...vals, id);
  }
}

// ── Enrichment logic ─────────────────────────────────────────────────────
function computeUpdates(dbGame, wdGame) {
  const updates = {};

  // developer: fill if empty
  if ((!dbGame.developer || dbGame.developer === 'Unknown') && wdGame.developer) {
    updates.developer = wdGame.developer;
  }

  // composer: fill if empty
  if (!dbGame.composer && wdGame.composer) {
    updates.composer = wdGame.composer;
  }

  // publisher: fill if empty
  if (!dbGame.publisher && wdGame.publisher) {
    updates.publisher = wdGame.publisher;
  }

  // year: fill if empty
  if (!dbGame.year && wdGame.year) {
    updates.year = wdGame.year;
  }

  // genre: fill if empty or generic
  if ((!dbGame.genre || dbGame.genre === 'Other' || dbGame.genre === 'Action') && wdGame.genre) {
    updates.genre = wdGame.genre;
  }

  // metascore: fill if empty
  if (!dbGame.metascore && wdGame.metascore) {
    updates.metascore = wdGame.metascore;
  }

  return updates;
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('\nRetroDex — Wikidata Deep Enrichment');
  if (DRY) console.log('[DRY RUN — no database writes]\n');

  const consoles = CONSOLE ? [CONSOLE] : Object.keys(PLATFORM_QID);
  let totalMatched = 0;
  let totalFields  = 0;
  let totalSkipped = 0;

  for (const consoleName of consoles) {
    console.log(`\n[${consoleName}] Fetching from Wikidata...`);
    const wdGames = await fetchWikidataGames(consoleName);
    console.log(`  Wikidata returned ${wdGames.length} games`);

    if (!wdGames.length) {
      console.log(`  Skipping — no Wikidata results`);
      await sleep(2000);
      continue;
    }

    const dbGames = await getGamesByConsole(consoleName);
    console.log(`  Database has ${dbGames.length} games for ${consoleName}`);

    let matched = 0, fields = 0, skipped = 0;

    for (const dbGame of dbGames) {
      // Find best Wikidata match by fuzzy title
      const wdMatch = wdGames.find(wd => titlesMatch(dbGame.title, wd.title));
      if (!wdMatch) {
        skipped++;
        continue;
      }

      const updates = computeUpdates(dbGame, wdMatch);
      if (Object.keys(updates).length === 0) {
        skipped++;
        continue;
      }

      // Add provenance
      if (!dbGame.source_name || dbGame.source_name !== 'wikidata') {
        updates.source_name = 'wikidata';
        updates.source_confidence = 0.80;
      }

      await updateGame(dbGame.id, updates);
      matched++;
      fields += Object.keys(updates).filter(k => k !== 'source_name' && k !== 'source_confidence').length;

      process.stdout.write(`\r  ${matched} matched · ${fields} fields filled · ${skipped} skipped (${dbGame.title.slice(0, 30)})`);
    }

    console.log(`\n  [${consoleName}] Done: ${matched} matched, ${fields} fields, ${skipped} skipped`);
    totalMatched += matched;
    totalFields  += fields;
    totalSkipped += skipped;

    // Rate limit: 2s between platform queries
    if (consoles.indexOf(consoleName) < consoles.length - 1) {
      await sleep(2000);
    }
  }

  console.log(`\n\nDone: ${totalMatched} games matched, ${totalFields} fields filled, ${totalSkipped} skipped`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
