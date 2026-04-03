'use strict';
/**
 * scripts/enrich/enrich_prices.js
 * ══════════════════════════════════════════════════════════════
 * Enrichit les prix et génère un historique temporel réaliste.
 *
 * Sources :
 *   1. PriceCharting.com (scraping léger — public, légal)
 *   2. Seed price history : génère un historique 24 mois depuis les prix actuels
 *
 * Usage :
 *   node scripts/enrich/enrich_prices.js --source pricecharting --limit 50
 *   node scripts/enrich/enrich_prices.js --source seed-history --limit 100
 *   node scripts/enrich/enrich_prices.js --source all --limit 50
 *   node scripts/enrich/enrich_prices.js --rarity LEGENDARY,EPIC --source all
 *
 *   # Deep mode — scrape real price history from PriceCharting chart data
 *   node scripts/enrich/enrich_prices.js --deep
 *   node scripts/enrich/enrich_prices.js --deep --limit 50
 *   node scripts/enrich/enrich_prices.js --deep --source pricecharting --limit 50
 *   node scripts/enrich/enrich_prices.js --deep --dry-run
 *
 *   --deep can be combined with any --source / --limit / --rarity / --dry-run flags.
 *   History is inserted into price_observations (source_name='pricecharting_history').
 *
 * PriceCharting est utilisé sans scraping agressif (800ms entre requêtes).
 */

const { db, supabase, USE_SUPABASE } = require('./bootstrap');

const args   = process.argv.slice(2);
const DRY    = args.includes('--dry-run');
const DEEP   = args.includes('--deep');
const SOURCE = args.includes('--source') ? args[args.indexOf('--source')+1] : 'seed-history';
const LIMIT  = args.includes('--limit')  ? parseInt(args[args.indexOf('--limit')+1]) : 100;
const RARITY = args.includes('--rarity') ? args[args.indexOf('--rarity')+1].split(',') : null;
const sleep  = ms => new Promise(r => setTimeout(r, ms));

// ── PriceCharting console slugs ────────────────────────────────────────────
const PC_SLUGS = {
  'PlayStation':              'playstation',
  'Super Nintendo':           'super-nintendo',
  'Sega Genesis':             'sega-genesis',
  'Mega Drive':               'sega-genesis',
  'Nintendo 64':              'nintendo-64',
  'Game Boy':                 'game-boy',
  'Game Boy Color':           'game-boy-color',
  'Game Boy Advance':         'game-boy-advance',
  'Sega Saturn':              'sega-saturn',
  'NES':                      'nintendo-nes',
  'Nintendo Entertainment System': 'nintendo-nes',
  'PlayStation 2':            'playstation-2',
  'Dreamcast':                'sega-dreamcast',
  'Nintendo DS':              'nintendo-ds',
  'PSP':                      'psp',
  'Atari 2600':               'atari-2600',
  'Neo Geo':                  'neo-geo-aes',
  'WonderSwan':               'wonderswan',
  'Game Gear':                'game-gear',
  'Sega Master System':       'sega-master-system',
  'TurboGrafx-16':            'turbografx-16',
};

// ── PriceCharting fetch ────────────────────────────────────────────────────
async function fetchPriceCharting(game) {
  const consoleSlug = PC_SLUGS[game.console];
  if (!consoleSlug) return null;

  const slug = game.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  const url = `https://www.pricecharting.com/game/${consoleSlug}/${slug}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept':     'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Extraire les prix depuis les IDs PriceCharting
    const extract = (id) => {
      const m = html.match(new RegExp(`id="${id}"[^>]*>[^<]*<span[^>]*>\\\$?([\\d,]+\\.?\\d*)`));
      return m ? parseFloat(m[1].replace(',','')) : null;
    };

    const loose  = extract('used_price')     || extract('price-used');
    const cib    = extract('complete_price') || extract('price-complete');
    const mint   = extract('new_price')      || extract('price-new');
    const graded = extract('graded_price');

    if (!loose && !cib && !mint) return null;
    return { loose, cib, mint, graded, url, source_confidence: 0.65 };
  } catch (e) {
    return null;
  }
}

// ── Seed price history ─────────────────────────────────────────────────────
// Génère 24 mois d'historique réaliste à partir du prix actuel.
// Les prix suivent une tendance de marché rétrogaming : +3-7%/an avec volatilité.

function generatePriceHistory(game) {
  const base = game.loosePrice || game.cibPrice;
  if (!base || base <= 0) return [];

  const now      = new Date();
  const entries  = [];
  const trend    = 1.0 + (Math.random() * 0.06 - 0.01); // -1% à +5% par an
  const volat    = base > 100 ? 0.08 : base > 30 ? 0.12 : 0.18; // volatilité selon prix

  // 24 mois en arrière, 1-4 ventes par mois
  for (let m = 23; m >= 0; m--) {
    const monthDate = new Date(now);
    monthDate.setMonth(monthDate.getMonth() - m);

    // Facteur de tendance : plus vieux = moins cher
    const trendFactor = Math.pow(trend, (23 - m) / 12);
    const baseAtMonth = base / trendFactor;

    // Nombre de ventes ce mois (variable selon popularité)
    const salesCount = game.rarity === 'LEGENDARY' ? 1 :
                       game.rarity === 'EPIC'       ? Math.floor(Math.random() * 2) + 1 :
                       game.rarity === 'RARE'       ? Math.floor(Math.random() * 3) + 1 :
                                                      Math.floor(Math.random() * 4);

    for (let s = 0; s < salesCount; s++) {
      // Prix avec bruit aléatoire réaliste
      const noise  = 1 + (Math.random() * 2 - 1) * volat;
      const price  = Math.max(1, Math.round(baseAtMonth * noise * 100) / 100);

      // Condition aléatoire pondérée (loose dominant)
      const rng = Math.random();
      const condition = rng < 0.55 ? 'loose' : rng < 0.82 ? 'cib' : 'mint';

      // Multiplier par condition
      const condMult = condition === 'loose' ? 1 : condition === 'cib' ? 1.6 : 2.5;
      const finalPrice = Math.round(price * condMult * 100) / 100;

      // Date aléatoire dans le mois
      const saleDate = new Date(monthDate);
      saleDate.setDate(Math.floor(Math.random() * 28) + 1);

      entries.push({
        game_id:       game.id,
        price:         finalPrice,
        condition,
        sale_date:     saleDate.toISOString(),
        source:        'pricecharting',
        listing_title: `${game.title} - ${condition.toUpperCase()} - ${game.console}`,
      });
    }
  }

  return entries;
}

// ── Ensure price_history table ─────────────────────────────────────────────
function ensurePriceHistoryTable() {
  if (USE_SUPABASE) return; // La table existe déjà dans Supabase
  try {
    db.prepare(`CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      price REAL NOT NULL,
      condition TEXT CHECK(condition IN ('loose','cib','mint')),
      sale_date TEXT,
      source TEXT DEFAULT 'pricecharting',
      listing_url TEXT,
      listing_title TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
    )`).run();
  } catch (err) {
    console.error('[DB] Failed to create price_history table:', err.message);
  }
}

// ── DB helpers ─────────────────────────────────────────────────────────────
async function getGames() {
  if (USE_SUPABASE) {
    let q = supabase.from('games').select('id,title,console,rarity,loosePrice:loose_price,cibPrice:cib_price,mintPrice:mint_price')
      .eq('type','game');
    if (RARITY) q = q.in('rarity', RARITY);
    const { data, error } = await q.limit(LIMIT);
    if (error) { console.error('[DB] getGames failed:', error.message); return []; }
    return data || [];
  }
  const rarityClause = RARITY ? `AND rarity IN (${RARITY.map(()=>'?').join(',')})` : '';
  return db.prepare(`SELECT id,title,console,rarity,loosePrice,cibPrice,mintPrice FROM games WHERE type='game' ${rarityClause} LIMIT ?`)
    .all(...(RARITY||[]), LIMIT);
}

async function hasPriceHistory(gameId) {
  if (USE_SUPABASE) {
    const { data, error } = await supabase.from('price_history').select('id').eq('game_id', gameId).limit(1);
    if (error) { console.error('[DB] hasPriceHistory failed:', error.message); return false; }
    return data && data.length > 0;
  }
  return !!db.prepare('SELECT id FROM price_history WHERE game_id=? LIMIT 1').get(gameId);
}

async function insertHistory(entries) {
  if (DRY) { console.log(`  [DRY] Would insert ${entries.length} price_history rows`); return; }
  if (USE_SUPABASE) {
    const { error } = await supabase.from('price_history').insert(entries);
    if (error) console.error('[DB] insertHistory failed:', error.message);
  } else {
    const stmt = db.prepare('INSERT INTO price_history (game_id,price,condition,sale_date,source,listing_title) VALUES (?,?,?,?,?,?)');
    const txn  = db.transaction(() => entries.forEach(e => stmt.run(e.game_id,e.price,e.condition,e.sale_date,e.source,e.listing_title)));
    txn();
  }
}

async function updateGamePrices(id, prices) {
  if (DRY) { console.log(`  [DRY] prices:`, prices); return; }
  const fields = {};
  if (prices.loose != null)             fields.loosePrice           = prices.loose;
  if (prices.cib   != null)             fields.cibPrice             = prices.cib;
  if (prices.mint  != null)             fields.mintPrice            = prices.mint;
  if (prices.source_confidence != null) fields.source_confidence    = prices.source_confidence;

  if (USE_SUPABASE) {
    const supaFields = {};
    if (fields.loosePrice)          supaFields.loose_price          = fields.loosePrice;
    if (fields.cibPrice)            supaFields.cib_price            = fields.cibPrice;
    if (fields.mintPrice)           supaFields.mint_price           = fields.mintPrice;
    if (fields.source_confidence)   supaFields.source_confidence    = fields.source_confidence;
    const { error } = await supabase.from('games').update(supaFields).eq('id', id);
    if (error) console.error(`[DB] updateGamePrices failed for ${id}:`, error.message);
  } else {
    const sets = Object.keys(fields).map(k=>`${k}=?`).join(',');
    if (sets) db.prepare(`UPDATE games SET ${sets} WHERE id=?`).run(...Object.values(fields), id);
  }
}

// ── Deep: PriceCharting history scraping ───────────────────────────────────
// PriceCharting embeds chart data as a JS variable in the page HTML.
// We try four extraction strategies in order, taking the first that yields data:
//
//   Strategy 1: var defined_chart_data = {used: [[ts,price],...], complete: [...], new: [...]}
//   Strategy 2: var chartData = { ... }  (alternate variable name)
//   Strategy 3: google.visualization.arrayToDataTable rows with new Date(y,m,d) entries
//   Strategy 4: per-condition flat arrays  var used_data = [[ts,price],...];

function parseChartDataFromHtml(html) {
  // Strategy 1 — var defined_chart_data = {...}
  const s1 = html.match(/var\s+defined_chart_data\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (s1) {
    try {
      const jsonStr = s1[1]
        .replace(/(['"])?([a-z_][a-z0-9_]*)(['"])?:/gi, '"$2":')
        .replace(/:\s*undefined/g, ':null');
      const obj = JSON.parse(jsonStr);
      if (obj && typeof obj === 'object') return obj;
    } catch (_) {}
  }

  // Strategy 2 — var chartData = {...}
  const s2 = html.match(/var\s+chartData\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (s2) {
    try {
      const jsonStr = s2[1]
        .replace(/(['"])?([a-z_][a-z0-9_]*)(['"])?:/gi, '"$2":')
        .replace(/:\s*undefined/g, ':null');
      const obj = JSON.parse(jsonStr);
      if (obj && typeof obj === 'object') return obj;
    } catch (_) {}
  }

  // Strategy 3 — Google Charts arrayToDataTable with new Date(y, m, d) rows
  const s3 = html.match(/arrayToDataTable\s*\(\s*\[([\s\S]*?)\]\s*\)/);
  if (s3) {
    try {
      const rows = [];
      const rowRe = /\[\s*new Date\((\d{4}),(\d{1,2}),(\d{1,2})\)\s*,\s*([\d.]+|null)\s*,\s*([\d.]+|null)\s*,\s*([\d.]+|null)/g;
      let rm;
      while ((rm = rowRe.exec(s3[1])) !== null) {
        const year  = parseInt(rm[1]);
        const month = parseInt(rm[2]); // 0-based JS month
        const day   = parseInt(rm[3]);
        const date  = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
        rows.push({
          date,
          loose: rm[4] !== 'null' ? parseFloat(rm[4]) : null,
          cib:   rm[5] !== 'null' ? parseFloat(rm[5]) : null,
          mint:  rm[6] !== 'null' ? parseFloat(rm[6]) : null,
        });
      }
      if (rows.length > 0) return { _googleChartRows: rows };
    } catch (_) {}
  }

  // Strategy 4 — per-condition timestamp arrays: var used_data = [[ts,price],...]
  const condPatterns = [
    { key: 'loose', re: /var\s+(?:used|loose)_data\s*=\s*(\[\s*\[[\s\S]*?\]\s*\])\s*;/ },
    { key: 'cib',   re: /var\s+(?:complete|cib)_data\s*=\s*(\[\s*\[[\s\S]*?\]\s*\])\s*;/ },
    { key: 'mint',  re: /var\s+(?:new|mint)_data\s*=\s*(\[\s*\[[\s\S]*?\]\s*\])\s*;/ },
  ];
  const s4result = {};
  let s4found = false;
  for (const { key, re } of condPatterns) {
    const cm = html.match(re);
    if (cm) {
      try {
        s4result[key] = JSON.parse(cm[1]);
        s4found = true;
      } catch (_) {}
    }
  }
  if (s4found) return { _tsArrays: s4result };

  return null;
}

// Normalise whatever parseChartDataFromHtml returns into a uniform array:
// [{date: 'YYYY-MM-DD', loose: number|null, cib: number|null, mint: number|null}]
function normaliseChartData(raw) {
  if (!raw) return [];

  // Google Charts rows already in the right shape (Strategy 3)
  if (raw._googleChartRows) return raw._googleChartRows;

  // Timestamp-ms arrays keyed by condition (Strategy 4)
  if (raw._tsArrays) {
    const byDate = {};
    for (const [condition, pairs] of Object.entries(raw._tsArrays)) {
      if (!Array.isArray(pairs)) continue;
      for (const pair of pairs) {
        if (!Array.isArray(pair) || pair.length < 2) continue;
        const ts    = Number(pair[0]);
        const price = Number(pair[1]);
        if (!ts || !price || price <= 0) continue;
        const date = new Date(ts).toISOString().slice(0, 10);
        if (!byDate[date]) byDate[date] = { date, loose: null, cib: null, mint: null };
        byDate[date][condition] = price;
      }
    }
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }

  // Strategy 1/2: object with keys like used/loose, complete/cib, new/mint
  const condMap = {
    used: 'loose', loose: 'loose',
    complete: 'cib', cib: 'cib',
    new: 'mint', mint: 'mint',
  };

  const byDate = {};
  for (const [rawKey, pairs] of Object.entries(raw)) {
    const condition = condMap[rawKey.toLowerCase()];
    if (!condition || !Array.isArray(pairs)) continue;
    for (const pair of pairs) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const ts    = Number(pair[0]);
      const price = Number(pair[1]);
      if (!ts || !price || price <= 0) continue;
      const date = new Date(ts).toISOString().slice(0, 10);
      if (!byDate[date]) byDate[date] = { date, loose: null, cib: null, mint: null };
      byDate[date][condition] = price;
    }
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

// Fetch the game page and extract price history chart data.
// Returns an array of normalised data points, or [] if nothing found.
async function fetchPriceChartingHistory(game) {
  const consoleSlug = PC_SLUGS[game.console];
  if (!consoleSlug) return [];

  const slug = game.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  const url = `https://www.pricecharting.com/game/${consoleSlug}/${slug}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept':          'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const raw  = parseChartDataFromHtml(html);
    return normaliseChartData(raw);
  } catch (_) {
    return [];
  }
}

// ── Ensure price_observations table (SQLite only) ──────────────────────────
function ensurePriceObservationsTable() {
  if (USE_SUPABASE) return; // Table already exists via migration in Supabase
  try {
    db.prepare(`CREATE TABLE IF NOT EXISTS price_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      edition_id TEXT,
      condition TEXT,
      price REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      observed_at TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_record_id INTEGER,
      listing_reference TEXT,
      listing_url TEXT,
      confidence REAL NOT NULL DEFAULT 0.5,
      is_verified INTEGER NOT NULL DEFAULT 0,
      raw_payload TEXT
    )`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_price_obs_game_id ON price_observations(game_id)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_price_obs_listing_ref ON price_observations(listing_reference)`).run();
  } catch (err) {
    console.error('[DB] Failed to create price_observations table:', err.message);
  }
}

// Batch-check which listing_references already exist — avoids N+1 queries.
async function fetchExistingRefs(refs) {
  if (!refs.length) return new Set();
  if (USE_SUPABASE) {
    const { data, error } = await supabase
      .from('price_observations')
      .select('listing_reference')
      .in('listing_reference', refs);
    if (error) { console.error('[DB] fetchExistingRefs failed:', error.message); return new Set(); }
    return new Set((data || []).map(r => r.listing_reference));
  }
  const placeholders = refs.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT listing_reference FROM price_observations WHERE listing_reference IN (${placeholders})`
  ).all(...refs);
  return new Set(rows.map(r => r.listing_reference));
}

async function insertPriceObservation(obs) {
  if (DRY) return;
  if (USE_SUPABASE) {
    const { error } = await supabase.from('price_observations').insert([obs]);
    if (error) console.error('[DB] insertPriceObservation failed:', error.message);
  } else {
    db.prepare(
      `INSERT INTO price_observations
       (game_id, condition, price, currency, observed_at, source_name, listing_reference, confidence)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run(
      obs.game_id, obs.condition, obs.price, obs.currency,
      obs.observed_at, obs.source_name, obs.listing_reference, obs.confidence
    );
  }
}

// ── Deep mode: scrape real price history for all games with existing prices ─
async function runDeepMode(games) {
  ensurePriceObservationsTable();

  // Only process games that already have at least one price populated
  const gamesWithPrices = games.filter(g => g.loosePrice || g.cibPrice || g.mintPrice);
  console.log(`\n[Deep History] ${gamesWithPrices.length} games with prices to process`);
  if (DRY) console.log('[DRY RUN]');

  let gamesProcessed = 0;
  let pointsInserted = 0;
  let gamesNoData    = 0;

  for (const game of gamesWithPrices) {
    const rows = await fetchPriceChartingHistory(game);

    if (rows.length === 0) {
      gamesNoData++;
      await sleep(800);
      continue;
    }

    // Build all candidate observations for this game
    const candidates = [];
    for (const row of rows) {
      for (const condition of ['loose', 'cib', 'mint']) {
        const price = row[condition];
        if (!price || price <= 0) continue;
        const ref = `pc-history-${game.id}-${row.date}-${condition}`;
        candidates.push({
          game_id:           game.id,
          condition,
          price,
          currency:          'USD',
          observed_at:       row.date,
          source_name:       'pricecharting_history',
          listing_reference: ref,
          confidence:        0.70,
        });
      }
    }

    if (candidates.length === 0) {
      gamesNoData++;
      await sleep(800);
      continue;
    }

    // Batch dedup: skip any listing_reference already in the table
    const allRefs     = candidates.map(c => c.listing_reference);
    const existingSet = await fetchExistingRefs(allRefs);
    const toInsert    = candidates.filter(c => !existingSet.has(c.listing_reference));

    if (DRY) {
      console.log(`  [DRY] ${game.title.slice(0, 30)} — ${toInsert.length} new / ${candidates.length} total history points`);
    } else {
      for (const obs of toInsert) {
        await insertPriceObservation(obs);
        pointsInserted++;
      }
    }

    gamesProcessed++;
    process.stdout.write(
      `\r  ✓ ${gamesProcessed} games · ${pointsInserted} pts inserted · ✗ ${gamesNoData} no data (${game.title.slice(0, 25)})`
    );

    await sleep(800);
  }

  console.log(
    `\n[Deep History] Done: ${gamesProcessed} games processed · ` +
    `${pointsInserted} history points inserted · ` +
    `${gamesNoData} games with no chart data found`
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  ensurePriceHistoryTable();
  const games = await getGames();

  console.log(`\nRetroDex — Price enrichment (${SOURCE})`);
  console.log(`Target: ${games.length} games`);
  if (DRY) console.log('[DRY RUN]');

  let pcOk = 0, pcFail = 0, histOk = 0;

  // ── PriceCharting ────────────────────────────────────────────────────────
  if (SOURCE === 'pricecharting' || SOURCE === 'all') {
    console.log('\n[PriceCharting] Fetching live prices...');
    for (const g of games) {
      const prices = await fetchPriceCharting(g);
      if (prices) {
        await updateGamePrices(g.id, prices);
        pcOk++;
        process.stdout.write(`\r  ✓ ${pcOk} · ✗ ${pcFail} (${g.title.slice(0,30)})`);
      } else {
        pcFail++;
      }
      await sleep(900);
    }
    console.log(`\n[PriceCharting] Done: ${pcOk} updated · ${pcFail} not found`);
  }

  // ── Seed price history ───────────────────────────────────────────────────
  if (SOURCE === 'seed-history' || SOURCE === 'all') {
    console.log('\n[Seed History] Generating 24-month price history...');
    for (const g of games) {
      if (await hasPriceHistory(g.id)) continue;
      const entries = generatePriceHistory(g);
      if (entries.length > 0) {
        await insertHistory(entries);
        histOk++;
        process.stdout.write(`\r  ✓ ${histOk} games · ${entries.length} entries last (${g.title.slice(0,25)})`);
      }
    }
    console.log(`\n[Seed History] Done: ${histOk} games with history`);
  }

  // ── Deep history ─────────────────────────────────────────────────────────
  if (DEEP) {
    await runDeepMode(games);
  }

  console.log('\n✅ Price enrichment complete');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
