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
  resolveLatestRawFile,
  sha256,
  utcDateStamp,
  utcTimestampStamp,
  writeJson,
} = require('./_shared');

const RARITY_VALUES = new Set(['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY']);
const STRUCTURED_FIELDS = [
  'characters',
  'dev_team',
  'dev_anecdotes',
  'cheat_codes',
  'ost_composers',
  'ost_notable_tracks',
  'versions',
  'speedrun_wr',
];

function resolveInputPath() {
  const explicit = process.argv.slice(2).find((arg) => arg.startsWith('--input='));
  if (explicit) {
    return path.resolve(process.cwd(), explicit.slice('--input='.length));
  }

  return resolveLatestRawFile();
}

function normalizeInlineText(value) {
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

function normalizeNullableInteger(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.trunc(numeric);
}

function normalizeNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return Math.round(numeric * 100) / 100;
}

function normalizeConfidence(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const bounded = Math.max(0, Math.min(1, numeric));
  return Math.round(bounded * 1000) / 1000;
}

function normalizeRarity(value) {
  const text = normalizeInlineText(value);
  if (!text) {
    return null;
  }

  const normalized = text.toUpperCase();
  return RARITY_VALUES.has(normalized) ? normalized : null;
}

function normalizeReleaseDate(value) {
  const text = normalizeInlineText(value);
  if (!text) {
    return null;
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80);
}

function makeUniqueSlug(baseSlug, seenSlugs, stats) {
  const base = (baseSlug || 'item').slice(0, 80) || 'item';

  if (!seenSlugs.has(base)) {
    seenSlugs.add(base);
    return base;
  }

  let index = 2;
  while (true) {
    const suffix = `-${index}`;
    const candidate = `${base.slice(0, Math.max(1, 80 - suffix.length))}${suffix}`;
    if (!seenSlugs.has(candidate)) {
      seenSlugs.add(candidate);
      stats.slug_collisions_resolved += 1;
      return candidate;
    }
    index += 1;
  }
}

function parseStructuredValue(rawValue, fieldName, stats, sourceId) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  if (Array.isArray(rawValue) || (typeof rawValue === 'object' && rawValue !== null)) {
    stats.structured_fields[fieldName].parsed += 1;
    return rawValue;
  }

  const text = String(rawValue).trim();
  if (!text) {
    return null;
  }

  try {
    const parsed = JSON.parse(text);
    stats.structured_fields[fieldName].parsed += 1;
    return parsed;
  } catch (_error) {
    stats.structured_fields[fieldName].failed += 1;
    if (stats.parse_error_samples.length < 10) {
      stats.parse_error_samples.push({ sourceId, field: fieldName, sample: text.slice(0, 180) });
    }
    return null;
  }
}

function createStats() {
  const structured_fields = {};
  STRUCTURED_FIELDS.forEach((field) => {
    structured_fields[field] = { parsed: 0, failed: 0 };
  });

  return {
    slug_changed: 0,
    slug_collisions_resolved: 0,
    cover_url_backfilled_from_cover_image: 0,
    release_date_normalized: 0,
    prices_normalized: 0,
    source_confidence_normalized: 0,
    parse_error_samples: [],
    structured_fields,
  };
}

function normalizeRow(row, seenSlugs, stats) {
  const title = normalizeInlineText(row.title);
  const consoleName = normalizeInlineText(row.console);
  const sourceId = normalizeInlineText(row.id);
  const sourceSlug = normalizeInlineText(row.slug);
  const derivedSlugBase = slugify([title, consoleName].filter(Boolean).join('-')) || slugify(sourceSlug) || slugify(sourceId);
  const slug = makeUniqueSlug(derivedSlugBase, seenSlugs, stats);

  if (slug !== sourceSlug && slug !== sourceId) {
    stats.slug_changed += 1;
  }

  const coverUrl = normalizeInlineText(row.cover_url) || normalizeInlineText(row.coverImage);
  if (!normalizeInlineText(row.cover_url) && normalizeInlineText(row.coverImage)) {
    stats.cover_url_backfilled_from_cover_image += 1;
  }

  const releaseDate = normalizeReleaseDate(row.releaseDate);
  if (releaseDate && releaseDate !== normalizeInlineText(row.releaseDate)) {
    stats.release_date_normalized += 1;
  }

  const loosePrice = normalizeNullableNumber(row.loose_price);
  const cibPrice = normalizeNullableNumber(row.cib_price);
  const mintPrice = normalizeNullableNumber(row.mint_price);
  if (loosePrice !== row.loose_price || cibPrice !== row.cib_price || mintPrice !== row.mint_price) {
    stats.prices_normalized += 1;
  }

  const sourceConfidence = normalizeConfidence(row.source_confidence);
  if (sourceConfidence !== row.source_confidence) {
    stats.source_confidence_normalized += 1;
  }

  return {
    sourceId,
    sourceSlug,
    id: slug,
    slug,
    itemType: normalizeInlineText(row.type) || 'game',
    title,
    console: consoleName,
    consoleId: normalizeInlineText(row.consoleId),
    year: normalizeNullableInteger(row.year),
    releaseDate,
    genre: normalizeInlineText(row.genre),
    developer: normalizeInlineText(row.developer),
    developerId: normalizeInlineText(row.developerId),
    publisherId: normalizeInlineText(row.publisherId),
    franchiseId: normalizeInlineText(row.franch_id),
    metascore: normalizeNullableInteger(row.metascore),
    rarity: normalizeRarity(row.rarity),
    sourceConfidence,
    summary: normalizeRichText(row.summary),
    synopsis: normalizeRichText(row.synopsis),
    tagline: normalizeInlineText(row.tagline),
    coverUrl,
    manualUrl: normalizeInlineText(row.manual_url),
    lore: normalizeRichText(row.lore),
    gameplayDescription: normalizeRichText(row.gameplay_description),
    characters: parseStructuredValue(row.characters, 'characters', stats, sourceId),
    devTeam: parseStructuredValue(row.dev_team, 'dev_team', stats, sourceId),
    devAnecdotes: parseStructuredValue(row.dev_anecdotes, 'dev_anecdotes', stats, sourceId),
    cheatCodes: parseStructuredValue(row.cheat_codes, 'cheat_codes', stats, sourceId),
    ostComposers: parseStructuredValue(row.ost_composers, 'ost_composers', stats, sourceId),
    ostNotableTracks: parseStructuredValue(row.ost_notable_tracks, 'ost_notable_tracks', stats, sourceId),
    avgDurationMain: normalizeNullableNumber(row.avg_duration_main),
    avgDurationComplete: normalizeNullableNumber(row.avg_duration_complete),
    speedrunWr: parseStructuredValue(row.speedrun_wr, 'speedrun_wr', stats, sourceId),
    versions: parseStructuredValue(row.versions, 'versions', stats, sourceId),
    loosePrice,
    cibPrice,
    mintPrice,
  };
}

function main() {
  ensureWorkspace();

  const startedAt = new Date();
  const dateStamp = utcDateStamp(startedAt);
  const timestampStamp = utcTimestampStamp(startedAt);
  const inputPath = resolveInputPath();
  const outputPath = path.join(PROCESSED_DIR, `games_normalized_${dateStamp}.json`);
  const reportPath = path.join(LOGS_DIR, `normalize_${dateStamp}_${timestampStamp}.json`);
  const summaryPath = path.join(LOGS_DIR, `run_${timestampStamp}.json`);
  const rows = readJson(inputPath);
  const stats = createStats();
  const seenSlugs = new Set();
  const normalizedRows = rows.map((row) => normalizeRow(row, seenSlugs, stats));
  const completeness = buildCompleteness(normalizedRows);

  writeJson(outputPath, normalizedRows);

  const reportPayload = {
    pipeline: '03_normalize',
    run_at: startedAt.toISOString(),
    input: formatOutputPath(inputPath),
    output: formatOutputPath(outputPath),
    total_read: rows.length,
    total_written: normalizedRows.length,
    errors: 0,
    skipped: 0,
    input_checksum: sha256(JSON.stringify(rows)),
    output_checksum: sha256(JSON.stringify(normalizedRows)),
    transforms: stats,
    top_incomplete_fields: completeness.slice(0, 10),
  };

  const summaryPayload = {
    pipeline: '03_normalize',
    run_at: startedAt.toISOString(),
    source: formatOutputPath(inputPath),
    total_read: rows.length,
    total_written: normalizedRows.length,
    errors: 0,
    skipped: 0,
    nulls: Object.fromEntries(completeness.map((entry) => [entry.field, entry.missing])),
    output: formatOutputPath(outputPath),
  };

  writeJson(reportPath, reportPayload);
  writeJson(summaryPath, summaryPayload);

  console.log(`[NORMALIZE] ${rows.length} lus, ${normalizedRows.length} ecrits, 0 erreurs, rapport: ${formatOutputPath(reportPath)}`);
  console.log(`[NORMALIZE] output: ${formatOutputPath(outputPath)}`);
  console.log(`[NORMALIZE] slug changes: ${stats.slug_changed}, collisions resolues: ${stats.slug_collisions_resolved}`);
  console.log(`[NORMALIZE] structured parse failures: ${stats.parse_error_samples.length}`);
}

main();
