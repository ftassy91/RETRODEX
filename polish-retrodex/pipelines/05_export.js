#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const {
  CANONICAL_DIR,
  LOGS_DIR,
  PROCESSED_DIR,
  ensureWorkspace,
  formatOutputPath,
  readJson,
  utcDateStamp,
  utcTimestampStamp,
  writeJson,
} = require('./_shared');

function resolveInputPath() {
  const explicit = process.argv.slice(2).find((arg) => arg.startsWith('--input='));
  if (explicit) {
    return path.resolve(process.cwd(), explicit.slice('--input='.length));
  }

  return path.join(PROCESSED_DIR, `games_enriched_${utcDateStamp()}.json`);
}

function loadBackendEnv() {
  const envPath = path.join(path.resolve(__dirname, '..', '..'), 'backend', '.env');
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const env = {};
  const lines = fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    const idx = trimmed.indexOf('=');
    if (idx < 0) {
      return;
    }
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^"(.*)"$/, '$1');
    env[key] = value;
  });
  return env;
}

function parseProjectReference(env) {
  const raw =
    env.SUPABASE_URL
    || env.SUPABASE_Project_URL
    || env.SUPERDATA_Project_URL
    || '';
  const match = String(raw).match(/doipqgkhfzqvmzrdfvuq|([a-z0-9]{20})/i);
  return match ? String(match[0]) : '';
}

function buildRemotePgConfig() {
  const env = {
    ...loadBackendEnv(),
    ...process.env,
  };
  const projectReference = parseProjectReference(env);
  const rawUrl = env.SUPABASE_Project_URL || env.DATABASE_URL || '';
  const passwordMatch = rawUrl.match(/postgres(?:\.[^:]+)?:\[?([^\]@]+)\]?@/i);
  const password = passwordMatch ? passwordMatch[1] : '';

  if (!projectReference || !password) {
    return null;
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

function toCanonicalItem(row) {
  return {
    id: row.id,
    slug: row.slug,
    itemType: 'game',
    title: row.title,
    console: row.console,
    consoleId: row.consoleId || null,
    year: row.year,
    genre: row.genre,
    developer: row.developer,
    metascore: row.metascore,
    rarity: row.rarity,
    sourceConfidence: row.sourceConfidence,
    coverUrl: row.coverUrl,
    synopsis: row.synopsis,
    summary: row.summary,
    loosePrice: row.loosePrice,
    cibPrice: row.cibPrice,
    mintPrice: row.mintPrice,
    franchiseId: row.franchiseId || null,
    manualUrl: row.manualUrl || null,
    lore: row.lore || null,
    gameplayDescription: row.gameplayDescription || null,
    provenance: {
      sourceId: row.sourceId || null,
      sourceSlug: row.sourceSlug || null,
    },
  };
}

function toMarketAggregate(row, exportedAt) {
  return {
    itemId: row.id,
    itemType: 'game',
    avgLoose: row.market?.aggregates?.loose?.average ?? null,
    avgCib: row.market?.aggregates?.cib?.average ?? null,
    avgMint: row.market?.aggregates?.mint?.average ?? null,
    medianLoose: row.market?.aggregates?.loose?.median ?? null,
    medianCib: row.market?.aggregates?.cib?.median ?? null,
    medianMint: row.market?.aggregates?.mint?.median ?? null,
    trend: null,
    salesVolume: row.market?.history?.count ?? 0,
    observationCount: row.market?.observations?.count ?? 0,
    verifiedObservationCount: row.market?.observations?.verifiedCount ?? 0,
    lastComputedAt: exportedAt,
    lastObservedAt: row.market?.observations?.lastObservedAt ?? null,
    lastSaleDate: row.market?.history?.lastSaleDate ?? null,
  };
}

function toMediaReference(row) {
  const media = [];
  if (row.media?.cover?.url) {
    media.push({
      itemId: row.id,
      itemType: 'game',
      mediaType: 'cover',
      url: row.media.cover.url,
      provider: row.media.cover.provider || null,
      complianceStatus: row.media.cover.complianceStatus || null,
      storageMode: row.media.cover.storageMode || null,
    });
  }
  if (row.media?.manual?.url) {
    media.push({
      itemId: row.id,
      itemType: 'game',
      mediaType: 'manual',
      url: row.media.manual.url,
      provider: row.media.manual.provider || null,
      complianceStatus: row.media.manual.complianceStatus || null,
      storageMode: row.media.manual.storageMode || null,
    });
  }
  return media;
}

async function inspectSupabaseSchema() {
  const config = buildRemotePgConfig();
  if (!config) {
    return {
      connected: false,
      reason: 'Missing Supabase pooler configuration in backend/.env',
      tables: {},
    };
  }

  const { Client } = require(path.join(path.resolve(__dirname, '..', '..'), 'backend', 'node_modules', 'pg'));
  const client = new Client(config);
  const targetTables = [
    'items',
    'market_aggregates',
    'market_sales',
    'game_releases',
    'companies',
    'regions',
    'ost',
    'collector_editions',
  ];

  try {
    await client.connect();
    const { rows } = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    const existing = new Set(rows.map((row) => String(row.table_name)));
    const tables = {};
    targetTables.forEach((tableName) => {
      tables[tableName] = existing.has(tableName);
    });
    return {
      connected: true,
      reason: null,
      tables,
    };
  } catch (error) {
    return {
      connected: false,
      reason: error.message,
      tables: {},
    };
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  ensureWorkspace();

  const inputPath = resolveInputPath();
  const startedAt = new Date();
  const dateStamp = utcDateStamp(startedAt);
  const timestampStamp = utcTimestampStamp(startedAt);
  const exportedAt = startedAt.toISOString();
  const itemsPath = path.join(CANONICAL_DIR, `items_${dateStamp}.json`);
  const marketPath = path.join(CANONICAL_DIR, `market_aggregates_${dateStamp}.json`);
  const mediaPath = path.join(CANONICAL_DIR, `media_references_${dateStamp}.json`);
  const manifestPath = path.join(CANONICAL_DIR, `manifest_${dateStamp}.json`);
  const reportPath = path.join(LOGS_DIR, `export_${dateStamp}_${timestampStamp}.json`);
  const summaryPath = path.join(LOGS_DIR, `run_${timestampStamp}.json`);

  const rows = readJson(inputPath);
  const items = rows.map(toCanonicalItem);
  const marketAggregates = rows.map((row) => toMarketAggregate(row, exportedAt));
  const mediaReferences = rows.flatMap((row) => toMediaReference(row));
  const supabasePlan = await inspectSupabaseSchema();

  writeJson(itemsPath, items);
  writeJson(marketPath, marketAggregates);
  writeJson(mediaPath, mediaReferences);

  const manifest = {
    exportedAt,
    source: formatOutputPath(inputPath),
    outputs: {
      items: formatOutputPath(itemsPath),
      marketAggregates: formatOutputPath(marketPath),
      mediaReferences: formatOutputPath(mediaPath),
    },
    counts: {
      items: items.length,
      marketAggregates: marketAggregates.length,
      mediaReferences: mediaReferences.length,
    },
    supabaseDryRun: {
      connected: supabasePlan.connected,
      reason: supabasePlan.reason,
      tables: supabasePlan.tables,
      writableTargetsReady: Boolean(
        supabasePlan.connected
        && supabasePlan.tables.items
        && supabasePlan.tables.market_aggregates
      ),
    },
  };

  writeJson(manifestPath, manifest);

  const reportPayload = {
    pipeline: '05_export',
    mode: 'dry-run',
    run_at: exportedAt,
    input: formatOutputPath(inputPath),
    outputs: manifest.outputs,
    counts: manifest.counts,
    supabaseDryRun: manifest.supabaseDryRun,
  };

  const summaryPayload = {
    pipeline: '05_export',
    run_at: exportedAt,
    source: formatOutputPath(inputPath),
    total_read: rows.length,
    total_written: items.length,
    errors: 0,
    skipped: 0,
    nulls: {},
    output: formatOutputPath(manifestPath),
  };

  writeJson(reportPath, reportPayload);
  writeJson(summaryPath, summaryPayload);

  console.log(`[EXPORT] ${rows.length} lus, ${items.length} items canoniques, 0 erreurs, rapport: ${formatOutputPath(reportPath)}`);
  console.log(`[EXPORT] items: ${formatOutputPath(itemsPath)}`);
  console.log(`[EXPORT] market_aggregates: ${formatOutputPath(marketPath)}`);
  console.log(`[EXPORT] media_references: ${formatOutputPath(mediaPath)}`);
  if (manifest.supabaseDryRun.connected) {
    console.log(`[EXPORT] Supabase dry-run connected, items table: ${manifest.supabaseDryRun.tables.items ? 'yes' : 'no'}, market_aggregates table: ${manifest.supabaseDryRun.tables.market_aggregates ? 'yes' : 'no'}`);
  } else {
    console.log(`[EXPORT] Supabase dry-run unavailable: ${manifest.supabaseDryRun.reason}`);
  }
}

main();
