'use strict';
// SYNC: A1 - migre uniquement les jeux jouables et canonise les doublons de slug
// Décision source : SYNC.md § A1

const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
module.paths.push(path.join(repoRoot, 'backend', 'node_modules'));

require('dotenv').config({ path: path.join(repoRoot, 'backend', '.env') });

const { Sequelize, QueryTypes } = require('sequelize');
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const TABLE_ONLY = process.argv.includes('--table')
  ? process.argv[process.argv.indexOf('--table') + 1]
  : null;
const BATCH_SIZE = parseInt(
  process.argv.includes('--batch-size')
    ? process.argv[process.argv.indexOf('--batch-size') + 1]
    : '100',
  10
);

function normalizeSupabaseUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(/db\.([a-z0-9]+)\.supabase\.co/i);
  if (match) {
    return `https://${match[1]}.supabase.co`;
  }

  return trimmed;
}

const SUPABASE_URL = normalizeSupabaseUrl(
  process.env.SUPABASE_URL
  || process.env.SUPABASE_Project_URL
  || process.env.SUPERDATA_Project_URL
);
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPERDATA_SERVICE_KEY;
const SQLITE_PATH = process.env.DATABASE_PATH
  || path.join(repoRoot, 'backend', 'storage', 'retrodex.sqlite');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_URL et SUPABASE_SERVICE_KEY requis dans backend/.env');
  process.exit(1);
}

if (!/^https?:\/\//i.test(String(SUPABASE_URL))) {
  console.error('SUPABASE_URL doit etre une URL HTTP(S) Supabase REST, pas un DSN Postgres.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const sqliteDialectModule = require(path.join(repoRoot, 'backend', 'node_modules', 'sqlite3'));
const sqlite = new Sequelize({
  dialect: 'sqlite',
  dialectModule: sqliteDialectModule,
  storage: SQLITE_PATH,
  logging: false,
});

const COLUMN_MAP = {
  loosePrice: 'loose_price',
  cibPrice: 'cib_price',
  mintPrice: 'mint_price',
  sourceConfidence: 'source_confidence',
  devAnecdotes: 'dev_anecdotes',
  devTeam: 'dev_team',
  cheatCodes: 'cheat_codes',
  similarIds: 'similar_ids',
  franchId: 'franch_id',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function camelToSnake(str) {
  return str.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') {
    return value;
  }

  if (!value.startsWith('[') && !value.startsWith('{')) {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeRow(row) {
  const result = {};

  for (const [key, value] of Object.entries(row)) {
    const mappedKey = COLUMN_MAP[key] || camelToSnake(key);
    result[mappedKey] = parseMaybeJson(value === '' ? null : value);
  }

  return result;
}

async function readSqliteRows(sql, replacements = {}) {
  return sqlite.query(sql, {
    replacements,
    type: QueryTypes.SELECT,
  });
}

async function sqliteTableExists(tableName) {
  const rows = await readSqliteRows(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = :tableName LIMIT 1",
    { tableName }
  );

  return rows.length > 0;
}

async function loadFranchiseGameIds() {
  const rows = await readSqliteRows(`
    SELECT franch_id, id
    FROM games
    WHERE type = 'game' AND franch_id IS NOT NULL AND franch_id != ''
    ORDER BY title ASC
  `);

  const gameIdsByFranchise = new Map();

  for (const row of rows) {
    if (!gameIdsByFranchise.has(row.franch_id)) {
      gameIdsByFranchise.set(row.franch_id, []);
    }
    gameIdsByFranchise.get(row.franch_id).push(row.id);
  }

  return gameIdsByFranchise;
}

function transformFranchiseRow(row, gameIdsByFranchise) {
  return {
    slug: row.slug,
    name: row.name,
    synopsis: row.description || null,
    first_game_year: row.first_game ?? null,
    last_game_year: row.last_game ?? null,
    developer: row.developer || null,
    genres: parseMaybeJson(row.genres) || [],
    platforms: parseMaybeJson(row.platforms) || [],
    game_ids: gameIdsByFranchise.get(row.slug) || [],
    heritage: row.legacy || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

function normalizeSlugToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function scoreGameRow(row) {
  let score = 0;

  if (row.id === row.slug) {
    score += 5;
  }

  if (normalizeSlugToken(row.id) === normalizeSlugToken(row.slug)) {
    score += 10;
  }

  if (row.synopsis) {
    score += 4;
  }

  if (row.tagline) {
    score += 3;
  }

  if (row.cover_url) {
    score += 2;
  }

  if (row.summary) {
    score += 1;
  }

  score += Number(row.source_confidence || 0);

  return score;
}

function dedupeRowsByKey(rows, key, scoreFn) {
  const winners = new Map();

  for (const row of rows) {
    const mapKey = row[key];

    if (!mapKey) {
      winners.set(Symbol('row'), row);
      continue;
    }

    const existing = winners.get(mapKey);
    if (!existing || scoreFn(row) > scoreFn(existing)) {
      winners.set(mapKey, row);
    }
  }

  return Array.from(winners.values());
}

function normalizeCollectionCondition(condition) {
  const value = String(condition || '').trim().toLowerCase();

  if (value === 'cib') return 'cib';
  if (value === 'mint') return 'mint';
  if (value === 'loose') return 'loose';

  return 'other';
}

function mergeCollectionNotes(row) {
  const parts = [row.notes, row.personal_note]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  return Array.from(new Set(parts)).join('\n\n');
}

function transformCollectionItemRow(row) {
  return {
    game_id: row.gameId,
    user_session: 'local',
    condition: normalizeCollectionCondition(row.condition),
    price_paid: row.price_paid ?? null,
    date_acquired: row.purchase_date || null,
    notes: mergeCollectionNotes(row),
    wishlist: row.list_type === 'wishlist',
    created_at: row.addedAt || null,
    updated_at: row.addedAt || null,
  };
}

async function migrateTable(table, context = {}) {
  const {
    name,
    query,
    target,
    onConflict = 'id',
    transform,
    prepareRows,
    method = 'upsert',
  } = table;

  console.log(`\n-- Migrating ${name} -> ${target} ----------------`);

  const exists = await sqliteTableExists(name);
  if (!exists) {
    console.log('  [SKIP] table absente dans la SQLite source');
    return { table: target, rows: 0, inserted: 0, errors: 0, status: 'skipped' };
  }

  const sourceRows = await readSqliteRows(query);
  let rows = transform
    ? sourceRows.map((row) => transform(row, context))
    : sourceRows;

  if (prepareRows) {
    rows = prepareRows(rows, context);
  }

  console.log(`  ${rows.length} rows a migrer`);

  if (DRY_RUN) {
    console.log('  [DRY RUN] aucune ecriture');
    return { table: target, rows: rows.length, inserted: 0, errors: 0, status: 'dry-run' };
  }

  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE).map(normalizeRow);

    const tableRef = supabase.from(target);
    const { error } = method === 'insert'
      ? await tableRef.insert(batch)
      : await tableRef.upsert(batch, { onConflict, ignoreDuplicates: false });

    if (error) {
      console.error(`  Batch ${i}-${Math.min(i + BATCH_SIZE, rows.length)} erreur: ${error.message}`);
      errors += batch.length;
    } else {
      inserted += batch.length;
      process.stdout.write(`  ${inserted}/${rows.length} inseres...\r`);
    }

    await sleep(100);
  }

  console.log(`  OK ${inserted} inseres, ${errors} erreurs`);
  return { table: target, rows: rows.length, inserted, errors };
}

async function main() {
  console.log('RetroDex - Migration SQLite -> Supabase');
  console.log('=======================================');
  console.log(`Mode        : ${DRY_RUN ? 'DRY RUN' : 'PRODUCTION'}`);
  console.log(`Batch size  : ${BATCH_SIZE}`);
  console.log(`SQLite      : ${SQLITE_PATH}`);
  console.log(`Supabase    : ${SUPABASE_URL}`);

  const context = {
    gameIdsByFranchise: await loadFranchiseGameIds(),
  };

  const tables = [
    {
      name: 'franchises',
      aliases: ['franchise_entries'],
      query: 'SELECT * FROM franchises',
      target: 'franchise_entries',
      onConflict: 'slug',
      transform: (row, ctx) => transformFranchiseRow(row, ctx.gameIdsByFranchise),
    },
    {
      name: 'games',
      query: "SELECT * FROM games WHERE type = 'game'",
      target: 'games',
      prepareRows: (rows) => dedupeRowsByKey(rows, 'slug', scoreGameRow),
    },
    {
      name: 'collection_items',
      query: 'SELECT * FROM collection_items',
      target: 'collection_items',
      transform: (row) => transformCollectionItemRow(row),
      method: 'insert',
    },
    {
      name: 'price_history',
      query: 'SELECT * FROM price_history',
      target: 'price_history',
    },
  ].filter((table) => {
    if (!TABLE_ONLY) {
      return true;
    }

    return table.name === TABLE_ONLY
      || table.target === TABLE_ONLY
      || (table.aliases || []).includes(TABLE_ONLY);
  });

  const results = [];

  for (const table of tables) {
    try {
      const result = await migrateTable(table, context);
      results.push(result);
    } catch (error) {
      console.error(`Erreur sur ${table.target}: ${error.message}`);
      results.push({ table: table.target, rows: 0, inserted: 0, errors: 0, status: 'error' });
    }
  }

  if (!DRY_RUN && (!TABLE_ONLY || TABLE_ONLY === 'games')) {
    console.log('\n-- Rafraichissement de l index de recherche --');
    const { error } = await supabase.rpc('refresh_search_index');
    if (error) {
      console.warn('  Index non rafraichi');
    } else {
      console.log('  OK index rafraichi');
    }
  }

  console.log('\n=======================================');
  console.log('Resultat :');
  for (const result of results) {
    const status = result.status || (result.errors > 0 ? 'warning' : 'ok');
    console.log(`  ${status} ${result.table} : ${result.inserted || 0}/${result.rows || 0}`);
  }

  await sqlite.close();
}

main().catch(async (error) => {
  console.error(`Erreur fatale : ${error.message}`);
  await sqlite.close().catch(() => {});
  process.exit(1);
});
