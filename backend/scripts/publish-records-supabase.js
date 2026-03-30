#!/usr/bin/env node
'use strict';

const {
  parseArgs,
  createRemoteClient,
  openReadonlySqlite,
  normalizeText,
  normalizeTimestamp,
  parseJsonLike,
  stringifyJson,
  buildSourceRecordKey,
  buildFieldProvenanceKey,
  buildQualityRecordKey,
  mapBy,
  tableExists,
  fetchRemoteSourceRecords,
} = require('./_supabase-publish-common');

const APPLY = process.argv.includes('--apply');

function normalizeSourceRecordRow(row) {
  return {
    id: Number(row.id),
    entity_type: String(row.entity_type),
    entity_id: String(row.entity_id),
    field_name: normalizeText(row.field_name),
    source_name: String(row.source_name),
    source_type: String(row.source_type),
    source_url: normalizeText(row.source_url),
    source_license: normalizeText(row.source_license),
    compliance_status: String(row.compliance_status),
    ingested_at: normalizeText(row.ingested_at),
    last_verified_at: normalizeText(row.last_verified_at),
    confidence_level: Number(row.confidence_level ?? 0.5),
    notes: normalizeText(row.notes),
  };
}

function normalizeFieldProvenanceRow(row, remoteSourceRecordId = null) {
  return {
    id: Number(row.id),
    entity_type: String(row.entity_type),
    entity_id: String(row.entity_id),
    field_name: String(row.field_name),
    source_record_id: remoteSourceRecordId,
    value_hash: normalizeText(row.value_hash),
    is_inferred: Number(row.is_inferred || 0),
    confidence_level: Number(row.confidence_level ?? 0.5),
    verified_at: normalizeText(row.verified_at),
  };
}

function normalizeQualityRecordRow(row) {
  return {
    id: Number(row.id),
    entity_type: String(row.entity_type),
    entity_id: String(row.entity_id),
    completeness_score: Number(row.completeness_score || 0),
    confidence_score: Number(row.confidence_score || 0),
    source_coverage_score: Number(row.source_coverage_score || 0),
    freshness_score: row.freshness_score == null ? null : Number(row.freshness_score),
    overall_score: Number(row.overall_score || 0),
    tier: String(row.tier),
    missing_critical_fields: stringifyJson(parseJsonLike(row.missing_critical_fields, null)),
    breakdown_json: stringifyJson(parseJsonLike(row.breakdown_json, null)),
    priority_score: row.priority_score == null ? null : Number(row.priority_score),
    updated_at: normalizeText(row.updated_at),
  };
}

function fetchLocalRows(sqlite) {
  const sourceRecords = sqlite.prepare(`
    SELECT *
    FROM source_records
    ORDER BY id ASC
  `).all().map(normalizeSourceRecordRow);

  const localSourceById = new Map(sourceRecords.map((row) => [Number(row.id), row]));

  const fieldProvenance = sqlite.prepare(`
    SELECT *
    FROM field_provenance
    ORDER BY id ASC
  `).all().map((row) => normalizeFieldProvenanceRow(row, localSourceById.get(Number(row.source_record_id)) || null));

  const qualityRecords = sqlite.prepare(`
    SELECT *
    FROM quality_records
    ORDER BY id ASC
  `).all().map(normalizeQualityRecordRow);

  return {
    sourceRecords,
    fieldProvenance,
    qualityRecords,
    localSourceById,
  };
}

function sourceRecordNeedsUpdate(remoteRow, localRow) {
  return (
    normalizeText(remoteRow.source_url) !== normalizeText(localRow.source_url)
    || normalizeText(remoteRow.source_license) !== normalizeText(localRow.source_license)
    || String(remoteRow.compliance_status || '') !== String(localRow.compliance_status || '')
    || normalizeTimestamp(remoteRow.ingested_at) !== normalizeTimestamp(localRow.ingested_at)
    || normalizeTimestamp(remoteRow.last_verified_at) !== normalizeTimestamp(localRow.last_verified_at)
    || Number(remoteRow.confidence_level || 0) !== Number(localRow.confidence_level || 0)
    || normalizeText(remoteRow.notes) !== normalizeText(localRow.notes)
  );
}

function fieldProvenanceNeedsUpdate(remoteRow, localRow) {
  return (
    Number(remoteRow.source_record_id || 0) !== Number(localRow.source_record_id || 0)
    || normalizeText(remoteRow.value_hash) !== normalizeText(localRow.value_hash)
    || Number(remoteRow.is_inferred || 0) !== Number(localRow.is_inferred || 0)
    || Number(remoteRow.confidence_level || 0) !== Number(localRow.confidence_level || 0)
    || normalizeTimestamp(remoteRow.verified_at) !== normalizeTimestamp(localRow.verified_at)
  );
}

function qualityRecordNeedsUpdate(remoteRow, localRow) {
  return (
    Number(remoteRow.completeness_score || 0) !== Number(localRow.completeness_score || 0)
    || Number(remoteRow.confidence_score || 0) !== Number(localRow.confidence_score || 0)
    || Number(remoteRow.source_coverage_score || 0) !== Number(localRow.source_coverage_score || 0)
    || Number(remoteRow.freshness_score || 0) !== Number(localRow.freshness_score || 0)
    || Number(remoteRow.overall_score || 0) !== Number(localRow.overall_score || 0)
    || String(remoteRow.tier || '') !== String(localRow.tier || '')
    || stringifyJson(parseJsonLike(remoteRow.missing_critical_fields, null)) !== localRow.missing_critical_fields
    || stringifyJson(parseJsonLike(remoteRow.breakdown_json, null)) !== localRow.breakdown_json
    || Number(remoteRow.priority_score || 0) !== Number(localRow.priority_score || 0)
    || normalizeTimestamp(remoteRow.updated_at) !== normalizeTimestamp(localRow.updated_at)
  );
}

async function ensureRemoteSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.source_records (
      id bigserial PRIMARY KEY,
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      field_name text,
      source_name text NOT NULL,
      source_type text NOT NULL,
      source_url text,
      source_license text,
      compliance_status text NOT NULL,
      ingested_at timestamptz NOT NULL,
      last_verified_at timestamptz,
      confidence_level numeric NOT NULL DEFAULT 0.5,
      notes text,
      UNIQUE(entity_type, entity_id, field_name, source_name, source_type)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.field_provenance (
      id bigserial PRIMARY KEY,
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      field_name text NOT NULL,
      source_record_id bigint REFERENCES public.source_records(id),
      value_hash text,
      is_inferred boolean NOT NULL DEFAULT false,
      confidence_level numeric NOT NULL DEFAULT 0.5,
      verified_at timestamptz,
      UNIQUE(entity_type, entity_id, field_name)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.quality_records (
      id bigserial PRIMARY KEY,
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      completeness_score integer NOT NULL,
      confidence_score integer NOT NULL,
      source_coverage_score integer NOT NULL,
      freshness_score integer,
      overall_score integer NOT NULL,
      tier text NOT NULL,
      missing_critical_fields jsonb,
      breakdown_json jsonb,
      priority_score numeric,
      updated_at timestamptz NOT NULL,
      UNIQUE(entity_type, entity_id)
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_source_records_entity ON public.source_records(entity_type, entity_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_quality_records_entity ON public.quality_records(entity_type, entity_id)`);
  await client.query(`GRANT SELECT ON public.source_records TO anon, authenticated, service_role`).catch(() => {});
  await client.query(`GRANT SELECT ON public.field_provenance TO anon, authenticated, service_role`).catch(() => {});
  await client.query(`GRANT SELECT ON public.quality_records TO anon, authenticated, service_role`).catch(() => {});
}

async function fetchRemoteFieldProvenance(client) {
  if (!await tableExists(client, 'field_provenance')) {
    return [];
  }
  return (await client.query(`
    SELECT id, entity_type, entity_id, field_name, source_record_id, value_hash,
           is_inferred, confidence_level, verified_at
    FROM public.field_provenance
  `)).rows;
}

async function fetchRemoteQualityRecords(client) {
  if (!await tableExists(client, 'quality_records')) {
    return [];
  }
  return (await client.query(`
    SELECT id, entity_type, entity_id, completeness_score, confidence_score,
           source_coverage_score, freshness_score, overall_score, tier,
           missing_critical_fields, breakdown_json, priority_score, updated_at
    FROM public.quality_records
  `)).rows;
}

async function upsertSourceRecord(client, row) {
  const { rows } = await client.query(`
    INSERT INTO public.source_records (
      entity_type,
      entity_id,
      field_name,
      source_name,
      source_type,
      source_url,
      source_license,
      compliance_status,
      ingested_at,
      last_verified_at,
      confidence_level,
      notes
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT (entity_type, entity_id, field_name, source_name, source_type) DO UPDATE SET
      source_url = EXCLUDED.source_url,
      source_license = EXCLUDED.source_license,
      compliance_status = EXCLUDED.compliance_status,
      ingested_at = EXCLUDED.ingested_at,
      last_verified_at = EXCLUDED.last_verified_at,
      confidence_level = EXCLUDED.confidence_level,
      notes = EXCLUDED.notes
    RETURNING id
  `, [
    row.entity_type,
    row.entity_id,
    row.field_name,
    row.source_name,
    row.source_type,
    row.source_url,
    row.source_license,
    row.compliance_status,
    row.ingested_at,
    row.last_verified_at,
    row.confidence_level,
    row.notes,
  ]);

  return Number(rows[0]?.id || 0) || null;
}

async function upsertFieldProvenance(client, row) {
  await client.query(`
    INSERT INTO public.field_provenance (
      entity_type,
      entity_id,
      field_name,
      source_record_id,
      value_hash,
      is_inferred,
      confidence_level,
      verified_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (entity_type, entity_id, field_name) DO UPDATE SET
      source_record_id = EXCLUDED.source_record_id,
      value_hash = EXCLUDED.value_hash,
      is_inferred = EXCLUDED.is_inferred,
      confidence_level = EXCLUDED.confidence_level,
      verified_at = EXCLUDED.verified_at
  `, [
    row.entity_type,
    row.entity_id,
    row.field_name,
    row.source_record_id,
    row.value_hash,
    Boolean(row.is_inferred),
    row.confidence_level,
    row.verified_at,
  ]);
}

async function upsertQualityRecord(client, row) {
  await client.query(`
    INSERT INTO public.quality_records (
      entity_type,
      entity_id,
      completeness_score,
      confidence_score,
      source_coverage_score,
      freshness_score,
      overall_score,
      tier,
      missing_critical_fields,
      breakdown_json,
      priority_score,
      updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12)
    ON CONFLICT (entity_type, entity_id) DO UPDATE SET
      completeness_score = EXCLUDED.completeness_score,
      confidence_score = EXCLUDED.confidence_score,
      source_coverage_score = EXCLUDED.source_coverage_score,
      freshness_score = EXCLUDED.freshness_score,
      overall_score = EXCLUDED.overall_score,
      tier = EXCLUDED.tier,
      missing_critical_fields = EXCLUDED.missing_critical_fields,
      breakdown_json = EXCLUDED.breakdown_json,
      priority_score = EXCLUDED.priority_score,
      updated_at = EXCLUDED.updated_at
  `, [
    row.entity_type,
    row.entity_id,
    row.completeness_score,
    row.confidence_score,
    row.source_coverage_score,
    row.freshness_score,
    row.overall_score,
    row.tier,
    row.missing_critical_fields,
    row.breakdown_json,
    row.priority_score,
    row.updated_at,
  ]);
}

async function main() {
  const _args = parseArgs(process.argv.slice(2));
  const sqlite = openReadonlySqlite();
  const client = createRemoteClient();
  await client.connect();

  try {
    const local = fetchLocalRows(sqlite);

    if (APPLY) {
      await ensureRemoteSchema(client);
    }

    const sourceTableExists = await tableExists(client, 'source_records');
    const provenanceTableExists = await tableExists(client, 'field_provenance');
    const qualityTableExists = await tableExists(client, 'quality_records');

    const remoteSourceRows = sourceTableExists ? await fetchRemoteSourceRecords(client) : [];
    const remoteSourceMap = mapBy(remoteSourceRows, buildSourceRecordKey);

    const pendingSourceRows = local.sourceRecords.filter((row) => {
      const remoteRow = remoteSourceMap.get(buildSourceRecordKey(row));
      return !remoteRow || sourceRecordNeedsUpdate(remoteRow, row);
    });

    const sourceIdByLocalId = new Map();

    if (sourceTableExists) {
      for (const row of local.sourceRecords) {
        const remoteRow = remoteSourceMap.get(buildSourceRecordKey(row));
        if (remoteRow?.id != null) {
          sourceIdByLocalId.set(Number(row.id), Number(remoteRow.id));
        }
      }
    }

    if (APPLY && pendingSourceRows.length) {
      for (const row of pendingSourceRows) {
        const remoteId = await upsertSourceRecord(client, row);
        if (remoteId != null) {
          sourceIdByLocalId.set(Number(row.id), remoteId);
        }
      }
    }

    const refreshedSourceMap = sourceTableExists
      ? mapBy(await fetchRemoteSourceRecords(client), buildSourceRecordKey)
      : new Map();

    if (sourceTableExists) {
      for (const row of local.sourceRecords) {
        const remoteRow = refreshedSourceMap.get(buildSourceRecordKey(row));
        if (remoteRow?.id != null) {
          sourceIdByLocalId.set(Number(row.id), Number(remoteRow.id));
        }
      }
    }

    const localProvenanceRows = local.fieldProvenance.map((row) => {
      const localSource = row.source_record_id && typeof row.source_record_id === 'object'
        ? row.source_record_id
        : null;

      const remoteSourceId = localSource ? sourceIdByLocalId.get(Number(localSource.id)) || null : null;
      return {
        ...row,
        source_record_id: remoteSourceId,
      };
    });

    const remoteProvenanceRows = provenanceTableExists ? await fetchRemoteFieldProvenance(client) : [];
    const remoteProvenanceMap = mapBy(remoteProvenanceRows, buildFieldProvenanceKey);
    const pendingProvenanceRows = localProvenanceRows.filter((row) => {
      const remoteRow = remoteProvenanceMap.get(buildFieldProvenanceKey(row));
      return !remoteRow || fieldProvenanceNeedsUpdate(remoteRow, row);
    });

    if (APPLY && pendingProvenanceRows.length) {
      for (const row of pendingProvenanceRows) {
        await upsertFieldProvenance(client, row);
      }
    }

    const remoteQualityRows = qualityTableExists ? await fetchRemoteQualityRecords(client) : [];
    const remoteQualityMap = mapBy(remoteQualityRows, buildQualityRecordKey);
    const pendingQualityRows = local.qualityRecords.filter((row) => {
      const remoteRow = remoteQualityMap.get(buildQualityRecordKey(row));
      return !remoteRow || qualityRecordNeedsUpdate(remoteRow, row);
    });

    if (APPLY && pendingQualityRows.length) {
      for (const row of pendingQualityRows) {
        await upsertQualityRecord(client, row);
      }
    }

    console.log(JSON.stringify({
      mode: APPLY ? 'apply' : 'dry-run',
      tables: {
        source_records: sourceTableExists,
        field_provenance: provenanceTableExists,
        quality_records: qualityTableExists,
      },
      records: {
        localRows: local.sourceRecords.length,
        remoteRows: remoteSourceRows.length,
        pendingRows: pendingSourceRows.length,
      },
      fieldProvenance: {
        localRows: localProvenanceRows.length,
        remoteRows: remoteProvenanceRows.length,
        pendingRows: pendingProvenanceRows.length,
      },
      quality: {
        localRows: local.qualityRecords.length,
        remoteRows: remoteQualityRows.length,
        pendingRows: pendingQualityRows.length,
      },
      sample: {
        source_records: pendingSourceRows.slice(0, 5).map((row) => ({
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          field_name: row.field_name,
          source_name: row.source_name,
        })),
        field_provenance: pendingProvenanceRows.slice(0, 5).map((row) => ({
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          field_name: row.field_name,
          source_record_id: row.source_record_id,
        })),
        quality_records: pendingQualityRows.slice(0, 5).map((row) => ({
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          tier: row.tier,
          overall_score: row.overall_score,
        })),
      },
    }, null, 2));
  } finally {
    sqlite.close();
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error('[publish-records-supabase] Failed:', error && error.stack ? error.stack : error);
  process.exit(1);
});
