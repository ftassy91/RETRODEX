'use strict';
// SYNC: A5 - migre le 2026-03-23 - helpers Supabase avec comptage exact
// Decision source : SYNC.md § A5

/**
 * Couche d'acces donnees pour Supabase.
 * En absence de config Supabase, fallback SQLite pour le developpement local.
 */

const path = require('path');
const { QueryTypes } = require('sequelize');

const {
  applyResolvedSupabaseEnv,
} = require('./src/config/env');

const {
  url: SUPABASE_URL,
  serviceKey: RESOLVED_SUPABASE_SERVICE_KEY,
  anonKey: RESOLVED_SUPABASE_ANON_KEY,
  databaseUrl: RESOLVED_DATABASE_URL,
} = applyResolvedSupabaseEnv();
const SUPABASE_KEY = RESOLVED_SUPABASE_SERVICE_KEY || RESOLVED_SUPABASE_ANON_KEY;
const HAS_VALID_SUPABASE_URL = /^https?:\/\//i.test(String(SUPABASE_URL || ''));
const ALLOW_SUPABASE_RUNTIME = Boolean(
  process.env.VERCEL
  || process.env.NODE_ENV === 'production'
  || String(process.env.DATABASE_TARGET || '').trim().toLowerCase() === 'supabase'
);
const USE_SUPABASE = Boolean(ALLOW_SUPABASE_RUNTIME && HAS_VALID_SUPABASE_URL && SUPABASE_KEY);
const ALLOW_DATABASE_URL_ALIAS = Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');
const DATABASE_URL = process.env.DATABASE_URL || (ALLOW_DATABASE_URL_ALIAS ? RESOLVED_DATABASE_URL : null);
const HAS_DATABASE_URL = Boolean(DATABASE_URL);

let _sequelizeOverride = null;
function setSequelize(seq) { _sequelizeOverride = seq; }
function getOverrideSequelize() { return _sequelizeOverride; }
module.exports.setSequelize = setSequelize;
module.exports.getOverrideSequelize = getOverrideSequelize;

let db = null;
let mode = 'none';

if (USE_SUPABASE) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    db = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
      db: { schema: 'public' },
    });
    mode = 'supabase';
    console.log('[DB] Supabase connected ->', SUPABASE_URL.split('.')[0].replace('https://', ''));
  } catch (error) {
    console.error('[DB] Supabase connection failed:', error.message);
  }
}

function quoteIdentifier(identifier) {
  return String(identifier || '')
    .split('.')
    .map((part) => `"${String(part).replace(/"/g, '""')}"`)
    .join('.');
}

function buildSelectClause(select) {
  const raw = String(select || '*').trim();
  if (!raw || raw === '*') {
    return '*';
  }

  return raw
    .split(',')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => (chunk === '*' ? '*' : quoteIdentifier(chunk)))
    .join(', ');
}

function buildSqlAdapter(runQuery, dialect = 'sqlite') {
  const useIndexedPlaceholders = dialect === 'postgres';
  const placeholderFor = (index) => (useIndexedPlaceholders ? `$${index}` : '?');

  function normalizeQueryValue(value) {
    if (typeof value === 'boolean') {
      return value;
    }
    return value;
  }

  class QueryBuilder {
    constructor(table) {
      this._table = table;
      this._select = '*';
      this._wheres = [];
      this._orders = [];
      this._limit = null;
      this._offset = null;
      this._count = false;
      this._head = false;
      this._single = false;
      this._operation = 'select';
      this._insertRows = null;
      this._updatePatch = null;
    }

    select(cols = '*', opts = {}) {
      this._select = cols;
      if (opts.count === 'exact') {
        this._count = true;
      }
      if (opts.head === true) {
        this._head = true;
      }
      return this;
    }

    insert(rows = []) {
      this._operation = 'insert';
      this._insertRows = Array.isArray(rows) ? rows : [rows];
      return this;
    }

    update(patch = {}) {
      this._operation = 'update';
      this._updatePatch = patch;
      return this;
    }

    delete() {
      this._operation = 'delete';
      return this;
    }

    eq(col, val) { this._wheres.push({ col, op: '=', val }); return this; }
    neq(col, val) { this._wheres.push({ col, op: '!=', val }); return this; }
    gt(col, val) { this._wheres.push({ col, op: '>', val }); return this; }
    gte(col, val) { this._wheres.push({ col, op: '>=', val }); return this; }
    lt(col, val) { this._wheres.push({ col, op: '<', val }); return this; }
    lte(col, val) { this._wheres.push({ col, op: '<=', val }); return this; }
    like(col, val) { this._wheres.push({ col, op: 'LIKE', val }); return this; }
    ilike(col, val) { this._wheres.push({ col, op: dialect === 'postgres' ? 'ILIKE' : 'LIKE', val }); return this; }

    is(col, val) {
      this._wheres.push({ col, op: val === null ? 'IS NULL' : 'IS NOT NULL', val });
      return this;
    }

    in(col, vals) {
      this._wheres.push({ col, op: 'IN', val: Array.isArray(vals) ? vals : [] });
      return this;
    }

    order(col, { ascending = true, nullsFirst = null } = {}) {
      this._orders.push({ col, ascending, nullsFirst });
      return this;
    }

    limit(n) {
      this._limit = n;
      return this;
    }

    range(from, to) {
      this._offset = from;
      this._limit = to - from + 1;
      return this;
    }

    single() {
      this._single = true;
      this._limit = 1;
      return this;
    }

    _buildWhere(startIndex = 1) {
      const replacements = [];
      let nextIndex = startIndex;
      const clauses = this._wheres.map((where) => {
        const column = quoteIdentifier(where.col);
        if (where.op === 'IS NULL') return `${column} IS NULL`;
        if (where.op === 'IS NOT NULL') return `${column} IS NOT NULL`;
        if (where.op === 'IN') {
          if (!Array.isArray(where.val) || !where.val.length) {
            return '1 = 0';
          }

          const placeholders = where.val.map(() => placeholderFor(nextIndex++));
          replacements.push(...where.val.map(normalizeQueryValue));
          return `${column} IN (${placeholders.join(', ')})`;
        }

        replacements.push(normalizeQueryValue(where.val));
        return `${column} ${where.op} ${placeholderFor(nextIndex++)}`;
      });

      return {
        clause: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '',
        replacements,
        nextIndex,
      };
    }

    _buildOrder() {
      if (!this._orders.length) {
        return '';
      }

      return ` ORDER BY ${this._orders.map((order) => {
        let chunk = `${quoteIdentifier(order.col)} ${order.ascending ? 'ASC' : 'DESC'}`;
        if (order.nullsFirst === true) chunk += ' NULLS FIRST';
        if (order.nullsFirst === false) chunk += ' NULLS LAST';
        return chunk;
      }).join(', ')}`;
    }

    async _executeSelect() {
      const { clause, replacements, nextIndex } = this._buildWhere(1);
      const limitClause = this._limit != null ? ` LIMIT ${placeholderFor(nextIndex)}` : '';
      const offsetClause = this._offset != null ? ` OFFSET ${placeholderFor(nextIndex + (this._limit != null ? 1 : 0))}` : '';
      const selectSql = `SELECT ${buildSelectClause(this._select)} FROM ${quoteIdentifier(this._table)}${clause}${this._buildOrder()}${limitClause}${offsetClause}`;
      const selectReplacements = [...replacements];

      if (this._limit != null) selectReplacements.push(this._limit);
      if (this._offset != null) selectReplacements.push(this._offset);

      const rows = this._head
        ? []
        : await runQuery(selectSql, selectReplacements, QueryTypes.SELECT);

      let count;
      if (this._count) {
        const countExpression = dialect === 'postgres' ? 'COUNT(*)::int' : 'COUNT(*)';
        const countSql = `SELECT ${countExpression} AS count FROM ${quoteIdentifier(this._table)}${clause}`;
        const countRows = await runQuery(countSql, replacements, QueryTypes.SELECT);
        count = Number(countRows?.[0]?.count || 0);
      }

      return {
        data: this._single ? (rows[0] || null) : rows,
        error: null,
        count,
      };
    }

    async _executeInsert() {
      const rows = Array.isArray(this._insertRows) ? this._insertRows.filter(Boolean) : [];
      if (!rows.length) {
        return { data: [], error: null };
      }

      const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row || {}))));
      if (!columns.length) {
        return { data: [], error: null };
      }

      const replacements = [];
      let nextIndex = 1;
      const valuesSql = rows.map((row) => {
        const placeholders = columns.map((column) => {
          replacements.push(normalizeQueryValue(row?.[column] ?? null));
          return placeholderFor(nextIndex++);
        });
        return `(${placeholders.join(', ')})`;
      }).join(', ');

      const sql = `INSERT INTO ${quoteIdentifier(this._table)} (${columns.map(quoteIdentifier).join(', ')}) VALUES ${valuesSql}`;
      await runQuery(sql, replacements, QueryTypes.INSERT);
      return { data: rows, error: null };
    }

    async _executeUpdate() {
      const patch = this._updatePatch || {};
      const columns = Object.keys(patch);
      if (!columns.length) {
        return { data: [], error: null };
      }

      const replacements = [];
      let nextIndex = 1;
      const setClause = columns.map((column) => {
        replacements.push(normalizeQueryValue(patch[column]));
        return `${quoteIdentifier(column)} = $${nextIndex++}`;
      }).join(', ');

      const where = this._buildWhere(nextIndex);
      const sql = `UPDATE ${quoteIdentifier(this._table)} SET ${setClause}${where.clause}`;
      await runQuery(sql, [...replacements, ...where.replacements], QueryTypes.UPDATE);
      return { data: [], error: null };
    }

    async _executeDelete() {
      const where = this._buildWhere(1);
      const sql = `DELETE FROM ${quoteIdentifier(this._table)}${where.clause}`;
      await runQuery(sql, where.replacements, QueryTypes.DELETE);
      return { data: [], error: null };
    }

    async _execute() {
      try {
        if (this._operation === 'insert') return await this._executeInsert();
        if (this._operation === 'update') return await this._executeUpdate();
        if (this._operation === 'delete') return await this._executeDelete();
        return await this._executeSelect();
      } catch (error) {
        return {
          data: this._single ? null : [],
          error: { message: error.message },
          count: undefined,
        };
      }
    }

    then(resolve, reject) {
      return this._execute().then(resolve, reject);
    }
  }

  return {
    from: (table) => new QueryBuilder(table),
    rpc: (name) => ({
      then: async (resolve) => {
        try {
          const rows = await runQuery(`SELECT * FROM ${quoteIdentifier(name)}()`, [], QueryTypes.SELECT);
          resolve({ data: rows?.[0] ?? null, error: null });
        } catch (error) {
          resolve({ data: null, error: { message: error.message } });
        }
        return { catch: () => {} };
      },
    }),
    _mode: dialect,
  };
}

if (!USE_SUPABASE && HAS_DATABASE_URL) {
  try {
    const sequelizeModule = require('./config/database');
    const sequelize = sequelizeModule?.sequelize || sequelizeModule;
    db = buildSqlAdapter(
      (sql, replacements, type) => sequelize.query(sql, { bind: replacements, type }),
      'postgres',
    );
    mode = 'supabase';
    console.log('[DB] Postgres adapter via DATABASE_URL');
  } catch (error) {
    console.error('[DB] Postgres adapter error:', error.message);
  }
}

if (!USE_SUPABASE && !db && process.env.VERCEL) {
  try {
    const sequelizeModule = require('./config/database');
    const sequelize = sequelizeModule?.sequelize || sequelizeModule;
    db = buildSqlAdapter(
      (sql, replacements, type) => sequelize.query(
        sql,
        HAS_DATABASE_URL ? { bind: replacements, type } : { replacements, type },
      ),
      HAS_DATABASE_URL ? 'postgres' : 'sqlite',
    );
    mode = 'supabase';
    console.log(`[DB] Vercel SQL adapter fallback -> ${HAS_DATABASE_URL ? 'postgres' : 'sqlite'}`);
  } catch (error) {
    console.error('[DB] Vercel SQL adapter fallback error:', error.message);
  }
}

if (!USE_SUPABASE && !db) {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'storage', 'retrodex.sqlite');
  try {
    const Database = require('better-sqlite3');
    const sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    db = buildSQLiteAdapter(sqlite);
    mode = 'sqlite';
    console.log('[DB] SQLite local ->', dbPath);
  } catch (error) {
    console.error('[DB] SQLite error:', error.message);
    console.error('[DB] Set SUPABASE_URL + SUPABASE_ANON_KEY in backend/.env');
  }
}

function buildSQLiteAdapter(sqlite) {
  function normalizeSqliteValue(value) {
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    return value;
  }

  class QueryBuilder {
    constructor(table) {
      this._table = table;
      this._select = '*';
      this._wheres = [];
      this._order = null;
      this._limit = null;
      this._offset = null;
      this._count = false;
      this._single = false;
    }

    select(cols = '*', opts = {}) {
      this._select = cols;
      if (opts.count === 'exact') {
        this._count = true;
      }
      return this;
    }

    eq(col, val) { this._wheres.push({ col, op: '=', val }); return this; }
    neq(col, val) { this._wheres.push({ col, op: '!=', val }); return this; }
    gt(col, val) { this._wheres.push({ col, op: '>', val }); return this; }
    gte(col, val) { this._wheres.push({ col, op: '>=', val }); return this; }
    lt(col, val) { this._wheres.push({ col, op: '<', val }); return this; }
    lte(col, val) { this._wheres.push({ col, op: '<=', val }); return this; }
    like(col, val) { this._wheres.push({ col, op: 'LIKE', val }); return this; }
    ilike(col, val) { this._wheres.push({ col, op: 'LIKE', val }); return this; }

    is(col, val) {
      this._wheres.push({ col, op: val === null ? 'IS NULL' : 'IS NOT NULL', val });
      return this;
    }

    in(col, vals) {
      this._wheres.push({ col, op: 'IN', val: vals });
      return this;
    }

    order(col, { ascending = true } = {}) {
      this._order = `${col} ${ascending ? 'ASC' : 'DESC'}`;
      return this;
    }

    limit(n) {
      this._limit = n;
      return this;
    }

    range(from, to) {
      this._offset = from;
      this._limit = to - from + 1;
      return this;
    }

    single() {
      this._single = true;
      this._limit = 1;
      return this;
    }

    _build() {
      const params = [];
      let sql = `SELECT ${this._select} FROM ${this._table}`;

      const conditions = this._wheres.map((where) => {
        if (where.op === 'IS NULL') return `${where.col} IS NULL`;
        if (where.op === 'IS NOT NULL') return `${where.col} IS NOT NULL`;
        if (where.op === 'IN') {
          const placeholders = where.val.map(() => '?').join(', ');
          params.push(...where.val.map(normalizeSqliteValue));
          return `${where.col} IN (${placeholders})`;
        }
        params.push(normalizeSqliteValue(where.val));
        return `${where.col} ${where.op} ?`;
      });

      const filteredConditions = conditions.filter(Boolean);
      if (filteredConditions.length) sql += ` WHERE ${filteredConditions.join(' AND ')}`;
      if (this._order) sql += ` ORDER BY ${this._order}`;
      if (this._limit != null) sql += ` LIMIT ${this._limit}`;
      if (this._offset != null) sql += ` OFFSET ${this._offset}`;

      return { sql, params };
    }

    then(resolve) {
      try {
        const { sql, params } = this._build();
        const rows = sqlite.prepare(sql).all(...params);
        resolve({
          data: this._single ? (rows[0] || null) : rows,
          error: null,
          count: this._count ? rows.length : undefined,
        });
      } catch (error) {
        resolve({ data: null, error: { message: error.message }, count: undefined });
      }
      return this;
    }
  }

  return {
    from: (table) => new QueryBuilder(table),
    rpc: () => ({
      then: (resolve) => {
        resolve({ data: null, error: { message: 'RPC not supported in SQLite mode' } });
        return { catch: () => {} };
      },
    }),
    raw: (sql, params = []) => {
      try {
        return { data: sqlite.prepare(sql).all(...params), error: null };
      } catch (error) {
        return { data: null, error: { message: error.message } };
      }
    },
    _sqlite: sqlite,
    _mode: 'sqlite',
  };
}

function applyGameFilters(query, { console: consoleName, rarity, search, ids }) {
  let nextQuery = query.eq('type', 'game');

  if (consoleName) nextQuery = nextQuery.eq('console', consoleName);
  if (rarity) nextQuery = nextQuery.eq('rarity', rarity);
  if (search) nextQuery = nextQuery.ilike('title', `%${search}%`);
  if (Array.isArray(ids)) {
    if (!ids.length) {
      nextQuery = nextQuery.in('id', ['__retrodex_no_match__']);
    } else {
      nextQuery = nextQuery.in('id', ids.map((value) => String(value)));
    }
  }

  return nextQuery;
}

function normalizeCoverFields(row) {
  if (!row || typeof row !== 'object') {
    return row;
  }

  const coverUrl =
    row.cover_url
    || row.coverImage
    || row.coverimage
    || row.boxart_url
    || row.image
    || null;

  return {
    ...row,
    cover_url: coverUrl,
    coverImage: coverUrl,
  };
}

async function fetchSupabaseRowsInBatches(table, columns, configure, { orderBy, batchSize = 1000 } = {}) {
  const rows = [];
  let from = 0;

  while (true) {
    let query = db.from(table).select(columns);
    query = configure(query);

    if (orderBy) {
      query = query.order(orderBy.column, orderBy.options);
    }

    query = query.range(from, from + batchSize - 1);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!Array.isArray(data) || data.length === 0) break;

    rows.push(...data.map(normalizeCoverFields));

    if (data.length < batchSize) break;
    from += batchSize;
  }

  return rows;
}

async function fetchSupabaseGameWindow(filters, column, options, offset, limit) {
  const rows = [];
  const end = offset + Math.max(limit, 0);
  let from = offset;

  while (from < end) {
    const to = Math.min(from + 999, end - 1);
    const { data, error } = await applyGameFilters(
      db.from('games').select('*'),
      filters
    )
      .order(column, options)
      .range(from, to);

    if (error) throw new Error(error.message);
    if (!Array.isArray(data) || data.length === 0) break;

    rows.push(...data.map(normalizeCoverFields));

    if (data.length < (to - from + 1)) break;
    from = to + 1;
  }

  return rows;
}

async function queryGamesViaSequelize(sequelize, filters) {
  const { search, console: consoleName, rarity, ids } = filters;

  let whereClause = 'WHERE type = \'game\'';
  const replacements = {};

  if (consoleName) {
    whereClause += ' AND "console" = :console';
    replacements.console = consoleName;
  }
  if (rarity) {
    whereClause += ' AND rarity = :rarity';
    replacements.rarity = rarity;
  }
  if (search) {
    whereClause += ` AND (
      title ILIKE :search OR
      COALESCE(developer, '') ILIKE :search OR
      COALESCE("console", '') ILIKE :search OR
      COALESCE(genre, '') ILIKE :search
    )`;
    replacements.search = `%${search}%`;
  }
  if (Array.isArray(ids)) {
    if (!ids.length) {
      return { items: [], total: 0 };
    }
    whereClause += ' AND id IN (:ids)';
    replacements.ids = ids.map((value) => String(value));
  }

  const [rows] = await sequelize.query(
    `SELECT *,
      cover_url as "coverImage",
      cover_url,
      loose_price as "loosePrice",
      cib_price as "cibPrice",
      mint_price as "mintPrice"
     FROM games ${whereClause}
     ORDER BY title ASC
     LIMIT 5000`,
    { replacements }
  );

  const debugRow = rows.find(r => r.id === 'panzer-dragoon-saga-sega-saturn');
  if (debugRow) {
    console.log('[queryGamesViaSequelize DEBUG]', JSON.stringify({
      id: debugRow.id,
      coverImage: debugRow.coverImage,
      cover_url: debugRow.cover_url,
      coverimage: debugRow.coverimage,
    }));
  }

  return { items: rows, total: rows.length };
}

async function queryGames({ sort, console: consoleName, rarity, limit = 20, offset = 0, search, ids }) {
  const filters = { console: consoleName, rarity, search, ids };

  if (_sequelizeOverride && process.env.RETRODEX_FORCE_SEQUELIZE_READS === '1') {
    return queryGamesViaSequelize(_sequelizeOverride, filters);
  }

  const sortMap = {
    title_asc: ['title', { ascending: true }],
    title_desc: ['title', { ascending: false }],
    price_asc: ['loose_price', { ascending: true }],
    price_desc: ['loose_price', { ascending: false }],
    year_asc: ['year', { ascending: true }],
    year_desc: ['year', { ascending: false }],
    meta_asc: ['metascore', { ascending: true, nullsFirst: false }],
    meta_desc: ['metascore', { ascending: false, nullsFirst: false }],
    metascore_asc: ['metascore', { ascending: true, nullsFirst: false }],
    metascore_desc: ['metascore', { ascending: false, nullsFirst: false }],
    rarity_desc: ['loose_price', { ascending: false }],
  };

  const [column, options] = sortMap[sort] || ['title', { ascending: true }];

  if (mode === 'supabase') {
    const { count, error: countError } = await applyGameFilters(
      db.from('games').select('id', { count: 'exact', head: true }),
      filters
    );
    if (countError) throw new Error(countError.message);

    return {
      items: await fetchSupabaseGameWindow(filters, column, options, offset, limit),
      total: Number.isFinite(Number(count)) ? Number(count) : 0,
    };
  }

  const { data, error } = await applyGameFilters(
    db.from('games').select('*'),
    filters
  )
    .order(column, options)
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);

  const { data: countRows, error: countError } = await applyGameFilters(
    db.from('games').select('id'),
    filters
  );
  if (countError) throw new Error(countError.message);

  return {
    items: data || [],
    total: Array.isArray(countRows) ? countRows.length : 0,
  };
}

async function getGameById(id) {
  if (_sequelizeOverride && process.env.RETRODEX_FORCE_SEQUELIZE_READS === '1') {
    const [rows] = await _sequelizeOverride.query(
      `SELECT *, cover_url as "coverImage",
        loose_price as "loosePrice", cib_price as "cibPrice",
        mint_price as "mintPrice"
       FROM games WHERE id = :id LIMIT 1`,
      { replacements: { id } }
    );
    return rows[0] || null;
  }
  const { data, error } = await db.from('games').select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  if (!data) return data;
  return normalizeCoverFields(data);
}

async function getCollection(session = 'local') {
  if (mode === 'supabase') {
    const { data, error } = await db
      .from('collection_items')
      .select('*, games(title, console, rarity, loose_price, cib_price, mint_price)')
      .eq('user_session', session)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  }

  const { data, error } = db.raw(`
    SELECT ci.*, g.title, g.console, g.rarity, g.loose_price, g.cib_price, g.mint_price
    FROM collection_items ci
    LEFT JOIN games g ON g.id = ci.game_id
    WHERE ci.user_session = ?
    ORDER BY ci.created_at DESC
  `, [session]);
  if (error) throw new Error(error.message);
  return data || [];
}

async function getStats() {
  if (mode === 'supabase') {
    const { data, error } = await db.rpc('get_global_stats');
    if (!error && data) return data;

    const games = await fetchSupabaseRowsInBatches(
      'games',
      'id,rarity,console,loose_price,title',
      (query) => query.eq('type', 'game'),
      { orderBy: { column: 'title', options: { ascending: true } } }
    );

    const byRarity = {};
    games.forEach((game) => {
      if (game.rarity) {
        byRarity[game.rarity] = (byRarity[game.rarity] || 0) + 1;
      }
    });

    return {
      total_games: games.length,
      total_platforms: new Set(games.map((game) => game.console).filter(Boolean)).size,
      priced_games: games.filter((game) => game.loose_price != null && Number(game.loose_price) > 0).length,
      by_rarity: byRarity,
    };
  }

  const { data: games } = await db.from('games').select('rarity, console, loose_price').eq('type', 'game');
  if (!games) return {};

  const byRarity = {};
  games.forEach((game) => {
    if (game.rarity) {
      byRarity[game.rarity] = (byRarity[game.rarity] || 0) + 1;
    }
  });

  return {
    total_games: games.length,
    total_platforms: new Set(games.map((game) => game.console).filter(Boolean)).size,
    priced_games: games.filter((game) => game.loose_price != null).length,
    by_rarity: byRarity,
  };
}

module.exports = {
  db,
  mode,
  isSupabase: mode === 'supabase',
  isSQLite: mode === 'sqlite',
  setSequelize,
  getOverrideSequelize,
  queryGames,
  getGameById,
  getCollection,
  getStats,
};
