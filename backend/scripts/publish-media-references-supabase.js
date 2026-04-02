#!/usr/bin/env node
'use strict';

const path = require('path');
const dotenv = require('dotenv');
const Database = require('better-sqlite3');
const { Client } = require('pg');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const APPLY = process.argv.includes('--apply');
const IDS_ARG = process.argv.find((value) => value.startsWith('--ids='));
const FILTER_IDS = IDS_ARG
  ? new Set(IDS_ARG.slice('--ids='.length).split(',').map((value) => value.trim()).filter(Boolean))
  : null;
const PUBLISHED_MEDIA_TYPES = ['cover', 'manual', 'map', 'sprite_sheet', 'screenshot', 'ending', 'scan'];
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

function normalizeTimestamp(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString();
}

function normalizeJsonText(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  try {
    return JSON.stringify(sortJsonValue(JSON.parse(normalized)));
  } catch {
    return normalized;
  }
}

function sortJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = sortJsonValue(value[key]);
    return acc;
  }, {});
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
    || normalizeText(remoteRow.title) !== normalizeText(localRow.title)
    || normalizeText(remoteRow.preview_url) !== normalizeText(localRow.preview_url)
    || normalizeText(remoteRow.asset_subtype) !== normalizeText(localRow.asset_subtype)
    || normalizeText(remoteRow.license_status) !== normalizeText(localRow.license_status)
    || Boolean(remoteRow.ui_allowed) !== Boolean(localRow.ui_allowed)
    || normalizeText(remoteRow.healthcheck_status) !== normalizeText(localRow.healthcheck_status)
    || normalizeJsonText(remoteRow.notes) !== normalizeJsonText(localRow.notes)
    || normalizeTimestamp(remoteRow.last_checked_at) !== normalizeTimestamp(localRow.last_checked_at)
    || normalizeJsonText(remoteRow.source_context) !== normalizeJsonText(localRow.source_context)
  );
}

function getLocalMediaRows(sqlite) {
  const columns = new Set(sqlite.prepare(`PRAGMA table_info(media_references)`).all().map((row) => String(row.name)));
  const hasExtendedColumns = columns.has('title');

  return sqlite.prepare(`
    SELECT
      entity_type,
      entity_id,
      media_type,
      url,
      provider,
      compliance_status,
      storage_mode,
      ${hasExtendedColumns ? 'title' : 'NULL AS title'},
      ${hasExtendedColumns ? 'preview_url' : 'NULL AS preview_url'},
      ${hasExtendedColumns ? 'asset_subtype' : 'NULL AS asset_subtype'},
      ${hasExtendedColumns ? 'license_status' : 'NULL AS license_status'},
      ${hasExtendedColumns ? 'ui_allowed' : '0 AS ui_allowed'},
      ${hasExtendedColumns ? 'healthcheck_status' : `'unchecked' AS healthcheck_status`},
      ${hasExtendedColumns ? 'notes' : 'NULL AS notes'},
      ${hasExtendedColumns ? 'last_checked_at' : 'NULL AS last_checked_at'},
      ${hasExtendedColumns ? 'source_context' : 'NULL AS source_context'}
    FROM media_references
    WHERE entity_type = 'game'
      AND media_type IN (${PUBLISHED_MEDIA_TYPES.map(() => '?').join(', ')})
      AND url IS NOT NULL
      AND TRIM(url) <> ''
    ORDER BY entity_id ASC, media_type ASC
  `).all(...PUBLISHED_MEDIA_TYPES).map((row) => ({
    entity_type: String(row.entity_type),
    entity_id: String(row.entity_id),
    media_type: String(row.media_type),
    url: String(row.url),
    provider: normalizeText(row.provider),
    compliance_status: normalizeText(row.compliance_status),
    storage_mode: normalizeText(row.storage_mode),
    title: normalizeText(row.title),
    preview_url: normalizeText(row.preview_url),
    asset_subtype: normalizeText(row.asset_subtype),
    license_status: normalizeText(row.license_status),
    ui_allowed: Number(row.ui_allowed || 0) === 1,
    healthcheck_status: normalizeText(row.healthcheck_status),
    notes: normalizeText(row.notes),
    last_checked_at: normalizeText(row.last_checked_at),
    source_context: normalizeText(row.source_context),
  })).filter((row) => !FILTER_IDS || FILTER_IDS.has(String(row.entity_id)));
}

async function getRemoteColumnSet(client) {
  const { rows } = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'media_references'
  `);
  return new Set(rows.map((row) => String(row.column_name)));
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

  const columnSet = await getRemoteColumnSet(client);
  const additions = [
    ['title', 'text'],
    ['preview_url', 'text'],
    ['asset_subtype', 'text'],
    ['license_status', `text NOT NULL DEFAULT 'reference_only'`],
    ['ui_allowed', 'boolean NOT NULL DEFAULT false'],
    ['healthcheck_status', `text NOT NULL DEFAULT 'unchecked'`],
    ['notes', 'text'],
    ['last_checked_at', 'timestamptz'],
    ['source_context', 'jsonb'],
  ];

  for (const [name, definition] of additions) {
    if (!columnSet.has(name)) {
      await client.query(`ALTER TABLE public.media_references ADD COLUMN ${name} ${definition}`);
    }
  }

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
  const columnSet = await getRemoteColumnSet(client);
  const selectColumns = [
    'entity_type',
    'entity_id',
    'media_type',
    'url',
    'provider',
    'compliance_status',
    'storage_mode',
    columnSet.has('title') ? 'title' : 'NULL::text AS title',
    columnSet.has('preview_url') ? 'preview_url' : 'NULL::text AS preview_url',
    columnSet.has('asset_subtype') ? 'asset_subtype' : 'NULL::text AS asset_subtype',
    columnSet.has('license_status') ? 'license_status' : 'NULL::text AS license_status',
    columnSet.has('ui_allowed') ? 'ui_allowed' : 'FALSE AS ui_allowed',
    columnSet.has('healthcheck_status') ? 'healthcheck_status' : `'unchecked'::text AS healthcheck_status`,
    columnSet.has('notes') ? 'notes' : 'NULL::text AS notes',
    columnSet.has('last_checked_at') ? 'last_checked_at::text AS last_checked_at' : 'NULL::text AS last_checked_at',
    columnSet.has('source_context') ? 'source_context::text AS source_context' : 'NULL::text AS source_context',
  ];

  const { rows } = await client.query(`
    SELECT ${selectColumns.join(', ')}
    FROM public.media_references
    WHERE entity_type = 'game'
      AND media_type = ANY($1::text[])
  `, [PUBLISHED_MEDIA_TYPES]);

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
          title,
          preview_url,
          asset_subtype,
          license_status,
          ui_allowed,
          healthcheck_status,
          notes,
          last_checked_at,
          source_context,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, now())
        ON CONFLICT (entity_type, entity_id, media_type, url) DO UPDATE SET
          provider = EXCLUDED.provider,
          compliance_status = EXCLUDED.compliance_status,
          storage_mode = EXCLUDED.storage_mode,
          title = EXCLUDED.title,
          preview_url = EXCLUDED.preview_url,
          asset_subtype = EXCLUDED.asset_subtype,
          license_status = EXCLUDED.license_status,
          ui_allowed = EXCLUDED.ui_allowed,
          healthcheck_status = EXCLUDED.healthcheck_status,
          notes = EXCLUDED.notes,
          last_checked_at = EXCLUDED.last_checked_at,
          source_context = EXCLUDED.source_context,
          updated_at = now()
      `, [
        row.entity_type,
        row.entity_id,
        row.media_type,
        row.url,
        row.provider,
        row.compliance_status,
        row.storage_mode,
        row.title,
        row.preview_url,
        row.asset_subtype,
        row.license_status || 'reference_only',
        Boolean(row.ui_allowed),
        row.healthcheck_status || 'unchecked',
        row.notes,
        row.last_checked_at,
        row.source_context,
      ]);
    }
  }

  const countRow = await client.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE media_type = 'cover')::int AS covers,
      COUNT(*) FILTER (WHERE media_type = 'manual')::int AS manuals,
      COUNT(*) FILTER (WHERE media_type = 'map')::int AS maps,
      COUNT(*) FILTER (WHERE media_type = 'sprite_sheet')::int AS sprite_sheets,
      COUNT(*) FILTER (WHERE media_type = 'screenshot')::int AS screenshots,
      COUNT(*) FILTER (WHERE media_type = 'ending')::int AS endings,
      COUNT(*) FILTER (WHERE media_type = 'scan')::int AS scans
    FROM public.media_references
    WHERE entity_type = 'game'
      AND media_type = ANY($1::text[])
  `, [PUBLISHED_MEDIA_TYPES]);

  return {
    localRows: localRows.length,
    remoteRows: Number(countRow.rows[0]?.total || 0),
    coverRows: Number(countRow.rows[0]?.covers || 0),
    manualRows: Number(countRow.rows[0]?.manuals || 0),
    mapRows: Number(countRow.rows[0]?.maps || 0),
    spriteSheetRows: Number(countRow.rows[0]?.sprite_sheets || 0),
    screenshotRows: Number(countRow.rows[0]?.screenshots || 0),
    endingRows: Number(countRow.rows[0]?.endings || 0),
    scanRows: Number(countRow.rows[0]?.scans || 0),
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
      filterIds: FILTER_IDS ? [...FILTER_IDS] : null,
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
