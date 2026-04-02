#!/usr/bin/env node
'use strict';

const path = require('path');

const {
  ensureWorkspace,
} = require('./_shared');
const {
  buildConfidenceMeta,
  buildPipelinePaths,
  formatOutputPath,
  indexFieldProvenance,
  loadEnrichedRows,
  normalizeWhitespace,
  openSourceDb,
  pickBestProvenance,
  resolveLatestEnrichedFile,
  toStringList,
  uniqueStrings,
  writePipelineArtifacts,
} = require('./_domain_shared');
const {
  deriveSummaryFromText,
  loadEncyclopediaSeedMap,
  loadWikipediaCacheMap,
  parseIntegerArg,
  refreshWikipediaCache,
} = require('./_source_enrichment');

const EDITORIAL_FIELDS = ['summary', 'synopsis', 'lore', 'characters'];

function resolveInputPath() {
  const explicit = process.argv.slice(2).find((arg) => arg.startsWith('--input='));
  if (explicit) {
    return path.resolve(process.cwd(), explicit.slice('--input='.length));
  }
  return resolveLatestEnrichedFile();
}

function loadEditorialIndex(db) {
  const rows = db.prepare(`
    SELECT
      game_id AS gameId,
      summary,
      synopsis,
      lore,
      characters
    FROM game_editorial
  `).all();

  const index = new Map();
  rows.forEach((row) => {
    index.set(row.gameId, row);
  });
  return index;
}

function buildSeedRecord() {
  return {
    confidenceLevel: 0.88,
    isInferred: 0,
    sourceName: 'encyclopedia_seed',
    sourceType: 'local_seed',
    sourceUrl: null,
    complianceStatus: 'approved_with_review',
    verifiedAt: null,
  };
}

function buildWikipediaRecord(entry) {
  return {
    confidenceLevel: 0.72,
    isInferred: 0,
    sourceName: 'wikipedia',
    sourceType: 'external_reference',
    sourceUrl: entry?.wikiUrl || null,
    complianceStatus: 'reference_only',
    verifiedAt: entry?.fetchedAt || null,
  };
}

function buildDerivedRecord(baseConfidence) {
  const baseScore = Number.isFinite(Number(baseConfidence?.score)) ? Number(baseConfidence.score) : 0.6;
  return {
    confidenceLevel: Math.max(0.5, baseScore - 0.05),
    isInferred: 0,
    sourceName: 'derived',
    sourceType: 'derived',
    sourceUrl: null,
    complianceStatus: null,
    verifiedAt: null,
  };
}

function resolveTextValue(row, editorialRow, seedRow, wikiRow, fieldName) {
  const direct = row?.[fieldName];
  const editorial = editorialRow?.[fieldName];
  const seedValue = seedRow?.[fieldName];
  const wikiValue = wikiRow?.[fieldName];

  if (fieldName === 'characters') {
    return uniqueStrings([
      ...toStringList(direct),
      ...toStringList(editorial),
      ...toStringList(seedValue),
      ...toStringList(wikiValue),
    ]);
  }

  return normalizeWhitespace(direct || editorial || seedValue || wikiValue || null) || null;
}

function buildFieldPayload(fieldName, row, editorialRow, seedRow, wikiRow, provenanceRows) {
  const bestProvenance = pickBestProvenance(provenanceRows || []);
  const seedRecord = seedRow?.[fieldName] ? buildSeedRecord() : null;
  const wikiRecord = wikiRow?.[fieldName] ? buildWikipediaRecord(wikiRow) : null;
  const value = resolveTextValue(row, editorialRow, seedRow, wikiRow, fieldName);
  const sourceRecord = bestProvenance || seedRecord || wikiRecord;

  if (fieldName === 'characters') {
    return {
      values: value,
      count: value.length,
      confidence: buildConfidenceMeta(sourceRecord, row.sourceConfidence, 'fallback_item_confidence'),
    };
  }

  return {
    value,
    confidence: buildConfidenceMeta(sourceRecord, row.sourceConfidence, 'fallback_item_confidence'),
  };
}

function buildDerivedSummary(row, synopsisPayload, lorePayload) {
  if (row.summary) {
    return null;
  }

  const sourceText = synopsisPayload?.value || lorePayload?.value || null;
  const derivedValue = deriveSummaryFromText(sourceText);
  if (!derivedValue) {
    return null;
  }

  const confidence = buildConfidenceMeta(buildDerivedRecord(synopsisPayload?.confidence || lorePayload?.confidence), row.sourceConfidence, 'derived_from_synopsis');
  return {
    value: derivedValue,
    confidence,
  };
}

async function main() {
  ensureWorkspace();

  const argv = process.argv.slice(2);
  const inputPath = resolveInputPath();
  const wikiLimit = parseIntegerArg(argv, '--wiki-limit', 0);
  const { rows } = loadEnrichedRows(inputPath);
  const startedAt = new Date();
  const { outputPath, logPath } = buildPipelinePaths('editorial', startedAt);
  const db = openSourceDb();

  try {
    const editorialIndex = loadEditorialIndex(db);
    const provenanceIndex = indexFieldProvenance(db, EDITORIAL_FIELDS);
    const encyclopediaSeed = loadEncyclopediaSeedMap();
    let wikipediaCache = loadWikipediaCacheMap();
    let wikipediaRefresh = null;

    if (wikiLimit > 0) {
      wikipediaRefresh = await refreshWikipediaCache(
        rows.filter((row) => !row.summary || !row.synopsis),
        {
          limit: wikiLimit,
          existing: wikipediaCache,
        }
      );
      wikipediaCache = wikipediaRefresh.cache;
    }

    const payload = rows.map((row) => {
      const itemKey = row.sourceId || row.id;
      const editorialRow = editorialIndex.get(itemKey) || null;
      const itemProvenance = provenanceIndex.get(itemKey) || {};
      const seedRow = encyclopediaSeed.get(itemKey) || null;
      const wikiRow = wikipediaCache.get(itemKey) || null;

      const summary = buildFieldPayload('summary', row, editorialRow, seedRow, wikiRow, itemProvenance.summary);
      const synopsis = buildFieldPayload('synopsis', row, editorialRow, seedRow, wikiRow, itemProvenance.synopsis);
      const lore = buildFieldPayload('lore', row, editorialRow, seedRow, wikiRow, itemProvenance.lore);
      const characters = buildFieldPayload('characters', row, editorialRow, seedRow, wikiRow, itemProvenance.characters);
      const derivedSummary = !summary.value ? buildDerivedSummary(row, synopsis, lore) : null;

      return {
        itemId: row.id,
        sourceId: itemKey,
        slug: row.slug,
        title: row.title,
        console: row.console,
        editorial: {
          summary: derivedSummary || summary,
          synopsis,
          lore,
          characters,
        },
      };
    });

    const counts = {
      items: payload.length,
      summary: payload.filter((entry) => entry.editorial.summary.value).length,
      synopsis: payload.filter((entry) => entry.editorial.synopsis.value).length,
      lore: payload.filter((entry) => entry.editorial.lore.value).length,
      characters: payload.filter((entry) => entry.editorial.characters.count > 0).length,
      summariesFromWikipedia: payload.filter((entry) => entry.editorial.summary.confidence.sourceName === 'wikipedia').length,
      synopsesFromWikipedia: payload.filter((entry) => entry.editorial.synopsis.confidence.sourceName === 'wikipedia').length,
      summariesFromSeed: payload.filter((entry) => entry.editorial.summary.confidence.sourceName === 'encyclopedia_seed').length,
      summariesDerived: payload.filter((entry) => entry.editorial.summary.confidence.sourceName === 'derived').length,
      trustedOrReviewedSummaries: payload.filter((entry) => ['trusted', 'reviewed'].includes(entry.editorial.summary.confidence.tier)).length,
      trustedOrReviewedLore: payload.filter((entry) => ['trusted', 'reviewed'].includes(entry.editorial.lore.confidence.tier)).length,
    };

    writePipelineArtifacts(outputPath, payload, logPath, {
      pipeline: '07_editorial',
      run_at: startedAt.toISOString(),
      input: formatOutputPath(inputPath),
      output: formatOutputPath(outputPath),
      counts,
      sources: {
        fieldProvenance: true,
        encyclopediaSeedRows: encyclopediaSeed.size,
        wikipediaCacheRows: wikipediaCache.size,
        wikipediaRefresh: wikipediaRefresh
          ? {
              attempted: wikipediaRefresh.attempted,
              updated: wikipediaRefresh.updated,
              misses: wikipediaRefresh.misses,
              file: formatOutputPath(wikipediaRefresh.filePath),
            }
          : null,
      },
      nulls: {
        summary: payload.length - counts.summary,
        synopsis: payload.length - counts.synopsis,
        lore: payload.length - counts.lore,
        characters: payload.length - counts.characters,
      },
      confidenceRules: [
        'approved_high_confidence',
        'approved_reviewed',
        'reference_only',
        'inferred',
        'derived_from_synopsis',
        'fallback_item_confidence',
      ],
      errors: 0,
      skipped: 0,
    });

    console.log(`[EDITORIAL] ${payload.length} items traités, summary ${counts.summary}, synopsis ${counts.synopsis}, lore ${counts.lore}, characters ${counts.characters}, 0 erreur, rapport: ${formatOutputPath(logPath)}`);
    if (wikipediaRefresh) {
      console.log(`[EDITORIAL] Wikipedia cache refresh: attempted ${wikipediaRefresh.attempted}, updated ${wikipediaRefresh.updated}, missed ${wikipediaRefresh.misses}`);
    }
    console.log(`[EDITORIAL] output: ${formatOutputPath(outputPath)}`);
  } finally {
    db.close();
  }
}

main();
