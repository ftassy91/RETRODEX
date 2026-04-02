#!/usr/bin/env node
'use strict';

const path = require('path');

const {
  LOGS_DIR,
  PROCESSED_DIR,
  buildCompleteness,
  ensureWorkspace,
  formatOutputPath,
  readJson,
  resolveBetterSqlite3,
  utcDateStamp,
  utcTimestampStamp,
  writeJson,
} = require('./_shared');

const MIN_CONFIDENCE = 0.6;
const OUTLIER_SIGMA = 3;

function resolveInputPath() {
  const explicit = process.argv.slice(2).find((arg) => arg.startsWith('--input='));
  if (explicit) {
    return path.resolve(process.cwd(), explicit.slice('--input='.length));
  }

  return path.join(PROCESSED_DIR, `games_normalized_${utcDateStamp()}.json`);
}

function normalizeText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).replace(/\s+/g, ' ').trim();
  return text || null;
}

function normalizeRichText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  return text || null;
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return Math.round(numeric * 100) / 100;
}

function parseJsonLike(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(String(value));
  } catch (_error) {
    return null;
  }
}

function average(values) {
  if (!values.length) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 100) / 100;
}

function median(values) {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 100) / 100;
  }
  return Math.round(sorted[middle] * 100) / 100;
}

function stddev(values) {
  if (values.length < 2) {
    return 0;
  }

  const mean = average(values);
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function filterOutliers(values) {
  if (values.length < 3) {
    return { kept: values, dropped: 0 };
  }

  const mean = average(values);
  const sigma = stddev(values);
  if (!sigma) {
    return { kept: values, dropped: 0 };
  }

  const kept = values.filter((value) => Math.abs(value - mean) <= OUTLIER_SIGMA * sigma);
  return {
    kept: kept.length ? kept : values,
    dropped: Math.max(0, values.length - kept.length),
  };
}

function normalizeCondition(value) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  const normalized = text.toLowerCase();
  if (normalized === 'cib') return 'cib';
  if (normalized === 'mint') return 'mint';
  if (normalized === 'loose') return 'loose';
  return null;
}

function loadEditorialMap(sqlite) {
  const rows = sqlite.prepare(`
    SELECT game_id, summary, synopsis, lore, dev_notes, cheat_codes, characters, gameplay_description
    FROM game_editorial
  `).all();

  return new Map(rows.map((row) => [String(row.game_id), row]));
}

function loadMediaMap(sqlite) {
  const rows = sqlite.prepare(`
    SELECT entity_id, media_type, url, provider, compliance_status, storage_mode
    FROM media_references
    WHERE entity_type = 'game'
  `).all();

  const map = new Map();
  rows.forEach((row) => {
    const key = String(row.entity_id);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(row);
  });
  return map;
}

function loadConsoleMap(sqlite) {
  const rows = sqlite.prepare(`
    SELECT id, slug, name, manufacturer, generation, releaseYear
    FROM consoles
  `).all();

  return new Map(rows.map((row) => [String(row.id), {
    id: String(row.id),
    slug: normalizeText(row.slug),
    name: normalizeText(row.name),
    manufacturer: normalizeText(row.manufacturer),
    generation: row.generation == null ? null : Number(row.generation),
    releaseYear: row.releaseYear == null ? null : Number(row.releaseYear),
  }]));
}

function loadFranchiseMap(sqlite) {
  const rows = sqlite.prepare(`
    SELECT id, slug, name, description, first_game, last_game, developer, publisher, genres, platforms
    FROM franchises
  `).all();

  return new Map(rows.map((row) => [String(row.id), {
    id: String(row.id),
    slug: normalizeText(row.slug),
    name: normalizeText(row.name),
    description: normalizeRichText(row.description),
    firstGame: row.first_game == null ? null : Number(row.first_game),
    lastGame: row.last_game == null ? null : Number(row.last_game),
    developer: normalizeText(row.developer),
    publisher: normalizeText(row.publisher),
    genres: parseJsonLike(row.genres),
    platforms: parseJsonLike(row.platforms),
  }]));
}

function loadPriceSignals(sqlite) {
  const observationRows = sqlite.prepare(`
    SELECT game_id, condition, price, observed_at, source_name, confidence
    FROM price_observations
    WHERE price IS NOT NULL
  `).all();

  const historyRows = sqlite.prepare(`
    SELECT game_id, condition, price, sale_date, source
    FROM price_history
    WHERE price IS NOT NULL
  `).all();

  const observationMap = new Map();
  observationRows.forEach((row) => {
    const gameId = String(row.game_id);
    if (!observationMap.has(gameId)) {
      observationMap.set(gameId, []);
    }
    observationMap.get(gameId).push({
      condition: normalizeCondition(row.condition),
      price: normalizeNumber(row.price),
      observedAt: normalizeText(row.observed_at),
      sourceName: normalizeText(row.source_name),
      confidence: row.confidence == null ? null : Number(row.confidence),
    });
  });

  const historyMap = new Map();
  historyRows.forEach((row) => {
    const gameId = String(row.game_id);
    if (!historyMap.has(gameId)) {
      historyMap.set(gameId, []);
    }
    historyMap.get(gameId).push({
      condition: normalizeCondition(row.condition),
      price: normalizeNumber(row.price),
      saleDate: normalizeText(row.sale_date),
      source: normalizeText(row.source),
    });
  });

  return { observationMap, historyMap };
}

function buildMarketSnapshot(observations = [], history = [], stats) {
  const byCondition = {
    loose: [],
    cib: [],
    mint: [],
  };

  const observationSources = new Set();
  let lastObservedAt = null;
  let lastSaleDate = null;

  observations
    .filter((entry) => entry.condition && entry.price != null && (entry.confidence == null || entry.confidence >= MIN_CONFIDENCE))
    .forEach((entry) => {
      byCondition[entry.condition].push(entry.price);
      if (entry.sourceName) observationSources.add(entry.sourceName);
      if (entry.observedAt && (!lastObservedAt || entry.observedAt > lastObservedAt)) {
        lastObservedAt = entry.observedAt;
      }
    });

  history
    .filter((entry) => entry.condition && entry.price != null)
    .forEach((entry) => {
      if (entry.saleDate && (!lastSaleDate || entry.saleDate > lastSaleDate)) {
        lastSaleDate = entry.saleDate;
      }
    });

  const conditions = {};
  let droppedOutliers = 0;
  for (const condition of Object.keys(byCondition)) {
    const values = byCondition[condition];
    const filtered = filterOutliers(values);
    droppedOutliers += filtered.dropped;
    conditions[condition] = {
      observationCount: values.length,
      filteredCount: filtered.kept.length,
      average: average(filtered.kept),
      median: median(filtered.kept),
      min: filtered.kept.length ? Math.min(...filtered.kept) : null,
      max: filtered.kept.length ? Math.max(...filtered.kept) : null,
    };
  }

  stats.market_outliers_filtered += droppedOutliers;

  return {
    observationCount: observations.length,
    historyCount: history.length,
    verifiedObservationCount: observations.filter((entry) => entry.confidence == null || entry.confidence >= MIN_CONFIDENCE).length,
    sourceNames: Array.from(observationSources).sort(),
    lastObservedAt,
    lastSaleDate,
    conditions,
  };
}

function pickPrice(currentValue, conditionStats, stats, fieldName) {
  if (currentValue != null) {
    return currentValue;
  }

  const candidate = conditionStats?.median ?? conditionStats?.average ?? null;
  if (candidate != null) {
    stats.price_backfilled[fieldName] += 1;
  }
  return candidate;
}

function createStats() {
  return {
    editorial_summary_backfilled: 0,
    editorial_synopsis_backfilled: 0,
    lore_backfilled: 0,
    gameplay_backfilled: 0,
    cheat_codes_backfilled: 0,
    characters_backfilled: 0,
    cover_backfilled: 0,
    manual_backfilled: 0,
    franchise_linked: 0,
    console_linked: 0,
    market_outliers_filtered: 0,
    price_backfilled: {
      loosePrice: 0,
      cibPrice: 0,
      mintPrice: 0,
    },
  };
}

function enrichRow(row, context, stats) {
  const sourceId = row.sourceId || row.id;
  const editorial = context.editorialMap.get(sourceId) || null;
  const media = context.mediaMap.get(sourceId) || [];
  const franchise = row.franchiseId ? (context.franchiseMap.get(row.franchiseId) || null) : null;
  const consoleRecord = row.consoleId ? (context.consoleMap.get(row.consoleId) || null) : null;
  const observations = context.observationMap.get(sourceId) || [];
  const history = context.historyMap.get(sourceId) || [];
  const market = buildMarketSnapshot(observations, history, stats);
  const mediaByType = new Map(media.map((entry) => [String(entry.media_type), entry]));

  const summary = row.summary || normalizeRichText(editorial?.summary);
  if (!row.summary && summary) stats.editorial_summary_backfilled += 1;

  const synopsis = row.synopsis || normalizeRichText(editorial?.synopsis);
  if (!row.synopsis && synopsis) stats.editorial_synopsis_backfilled += 1;

  const lore = row.lore || normalizeRichText(editorial?.lore);
  if (!row.lore && lore) stats.lore_backfilled += 1;

  const gameplayDescription = row.gameplayDescription || normalizeRichText(editorial?.gameplay_description);
  if (!row.gameplayDescription && gameplayDescription) stats.gameplay_backfilled += 1;

  const cheatCodes = row.cheatCodes || parseJsonLike(editorial?.cheat_codes);
  if (!row.cheatCodes && cheatCodes) stats.cheat_codes_backfilled += 1;

  const characters = row.characters || parseJsonLike(editorial?.characters);
  if (!row.characters && characters) stats.characters_backfilled += 1;

  const coverMedia = mediaByType.get('cover') || null;
  const manualMedia = mediaByType.get('manual') || null;
  const coverUrl = row.coverUrl || normalizeText(coverMedia?.url);
  const manualUrl = row.manualUrl || normalizeText(manualMedia?.url);
  if (!row.coverUrl && coverUrl) stats.cover_backfilled += 1;
  if (!row.manualUrl && manualUrl) stats.manual_backfilled += 1;

  const loosePrice = pickPrice(row.loosePrice, market.conditions.loose, stats, 'loosePrice');
  const cibPrice = pickPrice(row.cibPrice, market.conditions.cib, stats, 'cibPrice');
  const mintPrice = pickPrice(row.mintPrice, market.conditions.mint, stats, 'mintPrice');

  if (franchise) stats.franchise_linked += 1;
  if (consoleRecord) stats.console_linked += 1;

  return {
    ...row,
    summary,
    synopsis,
    lore,
    gameplayDescription,
    cheatCodes,
    characters,
    coverUrl,
    manualUrl,
    loosePrice,
    cibPrice,
    mintPrice,
    franchise: franchise ? {
      id: franchise.id,
      slug: franchise.slug,
      name: franchise.name,
      description: franchise.description,
      firstGame: franchise.firstGame,
      lastGame: franchise.lastGame,
      developer: franchise.developer,
      publisher: franchise.publisher,
      genres: franchise.genres,
      platforms: franchise.platforms,
    } : null,
    consoleMeta: consoleRecord ? {
      id: consoleRecord.id,
      slug: consoleRecord.slug,
      name: consoleRecord.name,
      manufacturer: consoleRecord.manufacturer,
      generation: consoleRecord.generation,
      releaseYear: consoleRecord.releaseYear,
    } : null,
    media: {
      cover: coverMedia ? {
        url: normalizeText(coverMedia.url),
        provider: normalizeText(coverMedia.provider),
        complianceStatus: normalizeText(coverMedia.compliance_status),
        storageMode: normalizeText(coverMedia.storage_mode),
      } : null,
      manual: manualMedia ? {
        url: normalizeText(manualMedia.url),
        provider: normalizeText(manualMedia.provider),
        complianceStatus: normalizeText(manualMedia.compliance_status),
        storageMode: normalizeText(manualMedia.storage_mode),
      } : null,
    },
    market: {
      current: {
        loosePrice,
        cibPrice,
        mintPrice,
      },
      observations: {
        count: market.observationCount,
        verifiedCount: market.verifiedObservationCount,
        lastObservedAt: market.lastObservedAt,
        sourceNames: market.sourceNames,
      },
      history: {
        count: market.historyCount,
        lastSaleDate: market.lastSaleDate,
      },
      aggregates: market.conditions,
    },
  };
}

function main() {
  ensureWorkspace();

  const inputPath = resolveInputPath();
  const startedAt = new Date();
  const dateStamp = utcDateStamp(startedAt);
  const timestampStamp = utcTimestampStamp(startedAt);
  const outputPath = path.join(PROCESSED_DIR, `games_enriched_${dateStamp}.json`);
  const reportPath = path.join(LOGS_DIR, `enrich_${dateStamp}_${timestampStamp}.json`);
  const summaryPath = path.join(LOGS_DIR, `run_${timestampStamp}.json`);

  const Database = resolveBetterSqlite3();
  const sqlite = new Database(path.join(path.resolve(__dirname, '..', '..'), 'backend', 'storage', 'retrodex.sqlite'), { readonly: true });

  try {
    const rows = readJson(inputPath);
    const context = {
      editorialMap: loadEditorialMap(sqlite),
      mediaMap: loadMediaMap(sqlite),
      consoleMap: loadConsoleMap(sqlite),
      franchiseMap: loadFranchiseMap(sqlite),
      ...loadPriceSignals(sqlite),
    };
    const stats = createStats();
    const enrichedRows = rows.map((row) => enrichRow(row, context, stats));
    const completeness = buildCompleteness(enrichedRows);

    writeJson(outputPath, enrichedRows);

    const reportPayload = {
      pipeline: '04_enrich',
      run_at: startedAt.toISOString(),
      input: formatOutputPath(inputPath),
      output: formatOutputPath(outputPath),
      total_read: rows.length,
      total_written: enrichedRows.length,
      errors: 0,
      skipped: 0,
      transforms: stats,
      top_incomplete_fields: completeness.slice(0, 10),
    };

    const summaryPayload = {
      pipeline: '04_enrich',
      run_at: startedAt.toISOString(),
      source: formatOutputPath(inputPath),
      total_read: rows.length,
      total_written: enrichedRows.length,
      errors: 0,
      skipped: 0,
      nulls: Object.fromEntries(completeness.map((entry) => [entry.field, entry.missing])),
      output: formatOutputPath(outputPath),
    };

    writeJson(reportPath, reportPayload);
    writeJson(summaryPath, summaryPayload);

    console.log(`[ENRICH] ${rows.length} lus, ${enrichedRows.length} ecrits, 0 erreurs, rapport: ${formatOutputPath(reportPath)}`);
    console.log(`[ENRICH] output: ${formatOutputPath(outputPath)}`);
    console.log(`[ENRICH] summary backfilled: ${stats.editorial_summary_backfilled}, synopsis: ${stats.editorial_synopsis_backfilled}`);
    console.log(`[ENRICH] cover backfilled: ${stats.cover_backfilled}, manual: ${stats.manual_backfilled}`);
    console.log(`[ENRICH] prices backfilled -> loose: ${stats.price_backfilled.loosePrice}, cib: ${stats.price_backfilled.cibPrice}, mint: ${stats.price_backfilled.mintPrice}`);
  } finally {
    sqlite.close();
  }
}

main();
