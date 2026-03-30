#!/usr/bin/env node
'use strict';

const path = require('path');
const dotenv = require('dotenv');
const Database = require('better-sqlite3');
const { Client } = require('pg');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const APPLY = process.argv.includes('--apply');
const SQLITE_PATH = path.join(__dirname, '..', 'storage', 'retrodex.sqlite');

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

function normalizeText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function buildMediaKey(row) {
  return [
    normalizeText(row.entity_type),
    normalizeText(row.entity_id),
    normalizeText(row.media_type),
    normalizeText(row.url),
  ].join('::');
}

function mediaNeedsUpdate(remoteRow, localRow) {
  return (
    normalizeText(remoteRow.provider) !== normalizeText(localRow.provider)
    || normalizeText(remoteRow.compliance_status) !== normalizeText(localRow.compliance_status)
    || normalizeText(remoteRow.storage_mode) !== normalizeText(localRow.storage_mode)
  );
}

function getLocalMediaRows(sqlite) {
  return sqlite.prepare(`
    SELECT
      entity_type,
      entity_id,
      media_type,
      url,
      provider,
      compliance_status,
      storage_mode
    FROM media_references
    WHERE entity_type = 'game'
      AND media_type IN ('cover', 'manual')
      AND url IS NOT NULL
      AND TRIM(url) <> ''
    ORDER BY entity_id ASC, media_type ASC
  `).all().map((row) => ({
    entity_type: String(row.entity_type),
    entity_id: String(row.entity_id),
    media_type: String(row.media_type),
    url: String(row.url),
    provider: normalizeText(row.provider),
    compliance_status: normalizeText(row.compliance_status),
    storage_mode: normalizeText(row.storage_mode),
  }));
}

async function ensureMediaTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.media_references (
      id bigserial PRIMARY KEY,
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      media_type text NOT NULL,
      url text NOT NULL,
      provider text,
      compliance_status text,
      storage_mode text,
      source_record_id bigint,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_media_references_unique
    ON public.media_references (entity_type, entity_id, media_type, url)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_media_references_entity
    ON public.media_references (entity_type, entity_id)
  `);

  await client.query(`
    GRANT SELECT ON public.media_references TO anon, authenticated, service_role
  `).catch(() => {});
}

async function getRemoteMediaRows(client) {
  const { rows } = await client.query(`
    SELECT entity_type, entity_id, media_type, url, provider, compliance_status, storage_mode
    FROM public.media_references
    WHERE entity_type = 'game'
      AND media_type IN ('cover', 'manual')
  `);

  return new Map(rows.map((row) => [buildMediaKey(row), row]));
}

async function syncMedia(client, localRows) {
  const remoteMap = await getRemoteMediaRows(client);
  const pending = [];

  for (const localRow of localRows) {
    const remoteRow = remoteMap.get(buildMediaKey(localRow));
    if (!remoteRow || mediaNeedsUpdate(remoteRow, localRow)) {
      pending.push(localRow);
    }
  }

  if (APPLY && pending.length) {
    for (const row of pending) {
      await client.query(`
        INSERT INTO public.media_references (
          entity_type,
          entity_id,
          media_type,
          url,
          provider,
          compliance_status,
          storage_mode,
          source_record_id,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, now())
        ON CONFLICT (entity_type, entity_id, media_type, url) DO UPDATE SET
          provider = EXCLUDED.provider,
          compliance_status = EXCLUDED.compliance_status,
          storage_mode = EXCLUDED.storage_mode,
          updated_at = now()
      `, [
        row.entity_type,
        row.entity_id,
        row.media_type,
        row.url,
        row.provider,
        row.compliance_status,
        row.storage_mode,
      ]);
    }
  }

  const countRow = await client.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE media_type = 'cover')::int AS covers,
      COUNT(*) FILTER (WHERE media_type = 'manual')::int AS manuals
    FROM public.media_references
    WHERE entity_type = 'game'
      AND media_type IN ('cover', 'manual')
  `);

  return {
    localRows: localRows.length,
    remoteRows: Number(countRow.rows[0]?.total || 0),
    coverRows: Number(countRow.rows[0]?.covers || 0),
    manualRows: Number(countRow.rows[0]?.manuals || 0),
    pendingRows: pending.length,
    samplePending: pending.slice(0, 5),
  };
}

async function main() {
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const client = new Client(buildRemotePgConfig());
  await client.connect();

  try {
    const localRows = getLocalMediaRows(sqlite);
    await ensureMediaTable(client);
    const media = await syncMedia(client, localRows);

    console.log(JSON.stringify({
      mode: APPLY ? 'apply' : 'dry-run',
      media,
    }, null, 2));
  } finally {
    await client.end().catch(() => {});
    sqlite.close();
  }
}

main().catch((error) => {
  console.error('[publish-media-references-supabase] Failed:', error.message);
  process.exit(1);
});
