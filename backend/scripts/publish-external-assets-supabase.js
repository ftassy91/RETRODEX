#!/usr/bin/env node
'use strict';

const {
  parseArgs,
  createRemoteClient,
  openReadonlySqlite,
  normalizeText,
  normalizeTimestamp,
  normalizeKeyPart,
  parseJsonLike,
  stringifyJson,
  readJsonLines,
  findLatestFile,
  POLISH_OUTPUTS_DIR,
  tableExists,
  getColumnSet,
  buildMediaKey,
  mapBy,
  uniqueBy,
} = require('./_supabase-publish-common');

const APPLY = process.argv.includes('--apply');
const EXTERNAL_ASSETS_PATH = `${POLISH_OUTPUTS_DIR}/external_assets.jsonl`;
const UI_PAYLOADS_PATH = `${POLISH_OUTPUTS_DIR}/ui_payloads.jsonl`;
const ARGS = parseArgs(process.argv.slice(2));
const TARGET_RUN_ID = ARGS['run-id'] || null;
const MANAGED_EXTERNAL_PROVIDERS = new Set(['vgmaps', 'vgmuseum', 'pixel_warehouse']);

const ALLOWED_MEDIA_TYPES = new Set([
  'cover',
  'manual',
  'map',
  'sprite_sheet',
  'scan',
  'screenshot',
  'ending',
]);

function normalizeLicenseStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'reference_only';
  if (normalized === 'blocked') return 'blocked';
  if (normalized === 'needs_review' || normalized === 'approved_with_review') return 'needs_review';
  return 'reference_only';
}

function normalizeUiAllowed(value) {
  if (value === true || value === false) {
    return value;
  }
  const normalized = String(value || '').trim().toLowerCase();
  return ['1', 'true', 'yes'].includes(normalized);
}

function normalizeHealthcheckStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['ok', 'redirected', 'timeout', 'broken', 'unchecked'].includes(normalized)) {
    return normalized;
  }
  return 'unchecked';
}

function normalizeComplianceStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'reference_only';
  return normalized;
}

function detectLatestRunId(filePath) {
  const rows = readJsonLines(filePath);
  const latest = rows
    .filter((row) => row.run_id)
    .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))[0];
  return latest ? String(latest.run_id) : null;
}

function resolveRunId() {
  return TARGET_RUN_ID
    || detectLatestRunId(EXTERNAL_ASSETS_PATH)
    || detectLatestRunId(UI_PAYLOADS_PATH)
    || null;
}

function readUiPayloads(runId) {
  const rows = readJsonLines(UI_PAYLOADS_PATH)
    .filter((row) => !runId || row.run_id === runId);
  const byGameAndUrl = new Map();

  for (const row of rows) {
    const gameId = normalizeText(row.game_id);
    if (!gameId) continue;
    const externalAssets = row.external_assets || {};
    const groups = ['maps', 'manuals', 'sprites', 'assets'];

    for (const group of groups) {
      for (const item of Array.isArray(externalAssets[group]) ? externalAssets[group] : []) {
        const key = `${gameId}::${normalizeKeyPart(item.url)}::${normalizeKeyPart(item.type)}`;
        byGameAndUrl.set(key, {
          group,
          ui_allowed: normalizeUiAllowed(item.ui_allowed),
          preview_url: normalizeText(item.preview_url),
        });
      }
    }
  }

  return byGameAndUrl;
}

function readLocalMediaRows(sqlite) {
  const columns = new Set(sqlite.prepare(`PRAGMA table_info(media_references)`).all().map((row) => String(row.name)));
  const hasExtendedColumns = columns.has('title');
  const selectColumns = [
    'entity_type',
    'entity_id',
    'media_type',
    'url',
    'provider',
    'compliance_status',
    'storage_mode',
    'source_record_id',
    hasExtendedColumns ? 'title' : 'NULL AS title',
    hasExtendedColumns ? 'preview_url' : 'NULL AS preview_url',
    hasExtendedColumns ? 'asset_subtype' : 'NULL AS asset_subtype',
    hasExtendedColumns ? 'license_status' : 'NULL AS license_status',
    hasExtendedColumns ? 'ui_allowed' : 'NULL AS ui_allowed',
    hasExtendedColumns ? 'healthcheck_status' : 'NULL AS healthcheck_status',
    hasExtendedColumns ? 'notes' : 'NULL AS notes',
    hasExtendedColumns ? 'last_checked_at' : 'NULL AS last_checked_at',
    hasExtendedColumns ? 'source_context' : 'NULL AS source_context',
  ];

  return sqlite.prepare(`
    SELECT ${selectColumns.join(',\n           ')}
    FROM media_references
    WHERE entity_type = 'game'
      AND media_type IN ('cover', 'manual')
      AND url IS NOT NULL
      AND TRIM(url) <> ''
    ORDER BY entity_id ASC, media_type ASC, url ASC
  `).all().map((row) => ({
    entity_type: String(row.entity_type),
    entity_id: String(row.entity_id),
    media_type: String(row.media_type),
    url: String(row.url),
    provider: normalizeText(row.provider),
    compliance_status: normalizeComplianceStatus(row.compliance_status),
    storage_mode: normalizeText(row.storage_mode) || 'external_reference',
    source_record_id: row.source_record_id == null ? null : Number(row.source_record_id),
    title: normalizeText(row.title),
    preview_url: normalizeText(row.preview_url),
    asset_subtype: normalizeText(row.asset_subtype),
    license_status: normalizeLicenseStatus(row.license_status || row.compliance_status),
    ui_allowed: row.ui_allowed == null ? true : normalizeUiAllowed(row.ui_allowed),
    healthcheck_status: normalizeHealthcheckStatus(row.healthcheck_status),
    notes: stringifyJson(parseJsonLike(row.notes, null)),
    last_checked_at: normalizeText(row.last_checked_at),
    source_context: stringifyJson(parseJsonLike(row.source_context, null)),
  }));
}

function readExternalAssetRows(uiPayloadByGameAndUrl, runId) {
  const rows = readJsonLines(EXTERNAL_ASSETS_PATH)
    .filter((row) => !runId || row.run_id === runId);
  return rows
    .filter((row) => ALLOWED_MEDIA_TYPES.has(String(row.asset_type || '').trim().toLowerCase()))
    .map((row) => {
      const mediaType = String(row.asset_type).trim().toLowerCase();
      const uiEntry = uiPayloadByGameAndUrl.get(
        `${normalizeKeyPart(row.game_id)}::${normalizeKeyPart(row.external_url)}::${normalizeKeyPart(row.asset_subtype || mediaType)}`
      );

      return {
        entity_type: 'game',
        entity_id: String(row.game_id),
        media_type: mediaType,
        url: String(row.external_url),
        provider: normalizeText(row.source_name),
        compliance_status: row.license_status === 'blocked' ? 'blocked' : 'reference_only',
        storage_mode: 'external_reference',
        source_record_id: null,
        title: normalizeText(row.title),
        preview_url: normalizeText(row.preview_url) || normalizeText(uiEntry?.preview_url),
        asset_subtype: normalizeText(row.asset_subtype),
        license_status: normalizeLicenseStatus(row.license_status),
        ui_allowed: uiEntry ? normalizeUiAllowed(uiEntry.ui_allowed) : normalizeUiAllowed(row.ui_allowed),
        healthcheck_status: normalizeHealthcheckStatus(row.healthcheck_status),
        notes: stringifyJson(Array.isArray(row.notes) && row.notes.length ? row.notes : null),
        last_checked_at: normalizeText(row.published_at || row.created_at),
        source_context: stringifyJson({
          ...(row.source_context || {}),
          run_id: row.run_id || null,
          source_record_id: row.source_record_id || null,
          source_page_url: row.source_page_url || null,
          content_type: row.content_type || null,
          variant_label: row.variant_label || null,
          contributor_raw: row.contributor_raw || null,
          ui_bucket: uiEntry?.group || null,
          schema_version: row.schema_version || null,
        }),
      };
    });
}

async function ensureRemoteSchema(client) {
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

  const columns = await getColumnSet(client, 'media_references');
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
    if (!columns.has(name)) {
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
  await client.query(`GRANT SELECT ON public.media_references TO anon, authenticated, service_role`).catch(() => {});
}

async function fetchRemoteMediaRows(client) {
  if (!await tableExists(client, 'media_references')) {
    return [];
  }

  const columns = await getColumnSet(client, 'media_references');
  const selectColumns = [
    'entity_type',
    'entity_id',
    'media_type',
    'url',
    'provider',
    'compliance_status',
    'storage_mode',
    'source_record_id',
    columns.has('title') ? 'title' : 'NULL::text AS title',
    columns.has('preview_url') ? 'preview_url' : 'NULL::text AS preview_url',
    columns.has('asset_subtype') ? 'asset_subtype' : 'NULL::text AS asset_subtype',
    columns.has('license_status') ? 'license_status' : 'NULL::text AS license_status',
    columns.has('ui_allowed') ? 'ui_allowed' : 'FALSE AS ui_allowed',
    columns.has('healthcheck_status') ? 'healthcheck_status' : `'unchecked'::text AS healthcheck_status`,
    columns.has('notes') ? 'notes' : 'NULL::text AS notes',
    columns.has('last_checked_at') ? 'last_checked_at' : 'NULL::timestamptz AS last_checked_at',
    columns.has('source_context') ? 'source_context' : 'NULL::jsonb AS source_context',
  ];

  return (await client.query(`
    SELECT ${selectColumns.join(',\n           ')}
    FROM public.media_references
    WHERE entity_type = 'game'
  `)).rows;
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
    || stringifyJson(parseJsonLike(remoteRow.notes, null)) !== localRow.notes
    || normalizeTimestamp(remoteRow.last_checked_at) !== normalizeTimestamp(localRow.last_checked_at)
    || stringifyJson(parseJsonLike(remoteRow.source_context, null)) !== localRow.source_context
  );
}

async function upsertMediaRow(client, row) {
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
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,now())
    ON CONFLICT (entity_type, entity_id, media_type, url) DO UPDATE SET
      provider = EXCLUDED.provider,
      compliance_status = EXCLUDED.compliance_status,
      storage_mode = EXCLUDED.storage_mode,
      source_record_id = EXCLUDED.source_record_id,
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
    row.source_record_id,
    row.title,
    row.preview_url,
    row.asset_subtype,
    row.license_status,
    Boolean(row.ui_allowed),
    row.healthcheck_status,
    row.notes,
    row.last_checked_at,
    row.source_context,
  ]);
}

async function deleteManagedMediaRow(client, row) {
  await client.query(`
    DELETE FROM public.media_references
    WHERE entity_type = $1
      AND entity_id = $2
      AND media_type = $3
      AND url = $4
  `, [
    row.entity_type,
    row.entity_id,
    row.media_type,
    row.url,
  ]);
}

async function main() {
  const sqlite = openReadonlySqlite();
  const client = createRemoteClient();
  await client.connect();

  try {
    const runId = resolveRunId();
    const uiPayloadByGameAndUrl = readUiPayloads(runId);
    const localRows = readLocalMediaRows(sqlite);
    const externalRows = readExternalAssetRows(uiPayloadByGameAndUrl, runId);
    const mergedRows = uniqueBy([
      ...localRows,
      ...externalRows,
    ], buildMediaKey);

    if (APPLY) {
      await ensureRemoteSchema(client);
    }

    const tableReady = await tableExists(client, 'media_references');
    const remoteRows = tableReady ? await fetchRemoteMediaRows(client) : [];
    const remoteMap = mapBy(remoteRows, buildMediaKey);
    const pendingRows = mergedRows.filter((row) => {
      const remoteRow = remoteMap.get(buildMediaKey(row));
      return !remoteRow || mediaNeedsUpdate(remoteRow, row);
    });
    const mergedKeys = new Set(mergedRows.map((row) => buildMediaKey(row)));
    const staleManagedRows = remoteRows.filter((row) => {
      const provider = normalizeText(row.provider);
      return provider
        && MANAGED_EXTERNAL_PROVIDERS.has(provider)
        && !mergedKeys.has(buildMediaKey(row));
    });

    if (APPLY && pendingRows.length) {
      for (const row of pendingRows) {
        await upsertMediaRow(client, row);
      }
    }

    if (APPLY && staleManagedRows.length) {
      for (const row of staleManagedRows) {
        await deleteManagedMediaRow(client, row);
      }
    }

    console.log(JSON.stringify({
      mode: APPLY ? 'apply' : 'dry-run',
      runId,
      media: {
        tableExists: tableReady,
        localReferenceRows: localRows.length,
        externalAssetRows: externalRows.length,
        mergedRows: mergedRows.length,
        remoteRows: remoteRows.length,
        pendingRows: pendingRows.length,
        staleManagedRows: staleManagedRows.length,
        byType: mergedRows.reduce((acc, row) => {
          acc[row.media_type] = (acc[row.media_type] || 0) + 1;
          return acc;
        }, {}),
        samplePending: pendingRows.slice(0, 8).map((row) => ({
          entity_id: row.entity_id,
          media_type: row.media_type,
          provider: row.provider,
          url: row.url,
          ui_allowed: row.ui_allowed,
        })),
        sampleStale: staleManagedRows.slice(0, 8).map((row) => ({
          entity_id: row.entity_id,
          media_type: row.media_type,
          provider: row.provider,
          url: row.url,
        })),
      },
    }, null, 2));
  } finally {
    sqlite.close();
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error('[publish-external-assets-supabase] Failed:', error && error.stack ? error.stack : error);
  process.exit(1);
});
