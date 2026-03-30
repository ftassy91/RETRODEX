#!/usr/bin/env node
'use strict';

const path = require('path');
const dotenv = require('dotenv');
const Database = require('better-sqlite3');
const { Client } = require('pg');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const APPLY = process.argv.includes('--apply');
const SQLITE_PATH = path.join(__dirname, '..', 'storage', 'retrodex.sqlite');

const DISC_CONSOLES = new Set(['dc', 'ps1', 'ps2', 'sat', 'scd']);
const FLOPPY_CONSOLES = new Set(['amiga', 'atarist', 'c64', 'msx']);

function parseProjectReference() {
  const raw =
    process.env.SUPABASE_URL
    || process.env.SUPABASE_Project_URL
    || process.env.SUPERDATA_Project_URL
    || '';
  const match = String(raw).match(/doipqgkhfzqvmzrdfvuq|([a-z0-9]{20})/i);
  return match ? String(match[0]) : '';
}

function buildRemotePgConfig() {
  const projectReference = parseProjectReference();
  const rawUrl = process.env.SUPABASE_Project_URL || process.env.DATABASE_URL || '';
  const passwordMatch = rawUrl.match(/postgres(?:\.[^:]+)?:\[?([^\]@]+)\]?@/i);
  const password = passwordMatch ? passwordMatch[1] : '';

  if (!projectReference || !password) {
    throw new Error('Missing Supabase pooler configuration. Expected project ref and password in backend/.env.');
  }

  return {
    host: 'aws-1-eu-west-1.pooler.supabase.com',
    port: 6543,
    user: `postgres.${projectReference}`,
    password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  };
}

function inferMediaType(consoleId) {
  const key = String(consoleId || '').trim().toLowerCase();
  if (DISC_CONSOLES.has(key)) {
    return 'disc';
  }
  if (FLOPPY_CONSOLES.has(key)) {
    return 'floppy';
  }
  return 'cartridge';
}

function normalizeText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function getLocalConsoles(sqlite) {
  return sqlite.prepare(`
    SELECT id, name, manufacturer, releaseYear
    FROM consoles
    ORDER BY name ASC
  `).all().map((row) => ({
    id: String(row.id),
    title: String(row.name),
    platform: String(row.name),
    year: row.releaseYear == null ? null : Number(row.releaseYear),
    manufacturer: normalizeText(row.manufacturer),
    media_type: inferMediaType(row.id),
  }));
}

function buildConsoleKey(row) {
  return String(row.id || '').trim();
}

function consoleNeedsUpdate(remoteRow, localRow) {
  return (
    normalizeText(remoteRow.title) !== normalizeText(localRow.title)
    || normalizeText(remoteRow.platform) !== normalizeText(localRow.platform)
    || Number(remoteRow.year || 0) !== Number(localRow.year || 0)
    || normalizeText(remoteRow.manufacturer) !== normalizeText(localRow.manufacturer)
    || normalizeText(remoteRow.media_type) !== normalizeText(localRow.media_type)
  );
}

async function ensureConsolesTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.consoles (
      id text PRIMARY KEY,
      title text NOT NULL,
      platform text UNIQUE NOT NULL,
      year integer,
      manufacturer text,
      media_type text,
      created_at timestamptz DEFAULT now()
    )
  `);

  await client.query(`
    GRANT SELECT ON public.consoles TO anon, authenticated, service_role
  `).catch(() => {});
}

async function getRemoteConsoles(client) {
  const { rows } = await client.query(`
    SELECT id, title, platform, year, manufacturer, media_type
    FROM public.consoles
  `);

  return new Map(rows.map((row) => [buildConsoleKey(row), row]));
}

async function syncConsoles(client, localRows) {
  const remoteMap = await getRemoteConsoles(client);
  const pending = [];

  for (const localRow of localRows) {
    const remoteRow = remoteMap.get(buildConsoleKey(localRow));
    if (!remoteRow || consoleNeedsUpdate(remoteRow, localRow)) {
      pending.push(localRow);
    }
  }

  if (APPLY && pending.length) {
    for (const row of pending) {
      await client.query(`
        INSERT INTO public.consoles (
          id, title, platform, year, manufacturer, media_type
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          platform = EXCLUDED.platform,
          year = EXCLUDED.year,
          manufacturer = EXCLUDED.manufacturer,
          media_type = EXCLUDED.media_type
      `, [
        row.id,
        row.title,
        row.platform,
        row.year,
        row.manufacturer,
        row.media_type,
      ]);
    }
  }

  const { rows: countRows } = await client.query(`SELECT COUNT(*)::int AS count FROM public.consoles`);

  return {
    localRows: localRows.length,
    remoteRows: Number(countRows[0]?.count || 0),
    pendingRows: pending.length,
    samplePending: pending.slice(0, 5),
  };
}

async function ensureSearchIndex(client) {
  if (APPLY) {
    await client.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS public.retrodex_search_index AS
      SELECT
        id,
        title AS name,
        console,
        year,
        rarity,
        loose_price AS "loosePrice",
        slug,
        franch_id,
        source_confidence,
        'game'::text AS "_type",
        to_tsvector('french', coalesce(title, '') || ' ' || coalesce(console, '') || ' ' || coalesce(developer, '')) AS search_vector
      FROM public.games
      WHERE type = 'game'
      UNION ALL
      SELECT
        slug AS id,
        name,
        null::text AS console,
        first_game_year AS year,
        null::text AS rarity,
        null::numeric AS "loosePrice",
        slug,
        null::text AS franch_id,
        0.8::numeric AS source_confidence,
        'franchise'::text AS "_type",
        to_tsvector('french', coalesce(name, '') || ' ' || coalesce(developer, '')) AS search_vector
      FROM public.franchise_entries
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_search_id
      ON public.retrodex_search_index (id, "_type")
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_search_vector
      ON public.retrodex_search_index USING gin (search_vector)
    `);

    await client.query(`
      GRANT SELECT ON public.retrodex_search_index TO anon, authenticated, service_role
    `).catch(() => {});

    await client.query(`REFRESH MATERIALIZED VIEW public.retrodex_search_index`);
  }

  const existsResult = await client.query(`SELECT to_regclass('public.retrodex_search_index') AS relation_name`);
  const exists = Boolean(existsResult.rows[0]?.relation_name);
  const count = exists
    ? Number((await client.query(`SELECT COUNT(*)::int AS count FROM public.retrodex_search_index`)).rows[0]?.count || 0)
    : 0;

  return {
    exists,
    rowCount: count,
  };
}

async function main() {
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const client = new Client(buildRemotePgConfig());
  await client.connect();

  try {
    const localConsoles = getLocalConsoles(sqlite);
    await ensureConsolesTable(client);
    const consoles = await syncConsoles(client, localConsoles);
    const searchIndex = await ensureSearchIndex(client);

    console.log(JSON.stringify({
      mode: APPLY ? 'apply' : 'dry-run',
      consoles,
      searchIndex,
    }, null, 2));
  } finally {
    await client.end().catch(() => {});
    sqlite.close();
  }
}

main().catch((error) => {
  console.error('[publish-structural-supabase] Failed:', error.message);
  process.exit(1);
});
