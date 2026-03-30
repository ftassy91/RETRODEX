#!/usr/bin/env node
'use strict';

const path = require('path');

const {
  CANONICAL_DIR,
  ensureWorkspace,
  writeJson,
} = require('./_shared');
const {
  buildConfidenceMeta,
  buildPipelinePaths,
  formatOutputPath,
  loadEnrichedRows,
  openSourceDb,
  resolveLatestEnrichedFile,
  slugifyValue,
  toStringList,
  uniqueStrings,
  writePipelineArtifacts,
} = require('./_domain_shared');
const {
  extractComposerNamesFromText,
  loadEncyclopediaSeedMap,
  loadWikipediaCacheMap,
} = require('./_source_enrichment');

function resolveInputPath() {
  const explicit = process.argv.slice(2).find((arg) => arg.startsWith('--input='));
  if (explicit) {
    return path.resolve(process.cwd(), explicit.slice('--input='.length));
  }
  return resolveLatestEnrichedFile();
}

function loadComposerRows(db) {
  return db.prepare(`
    SELECT
      gp.game_id AS gameId,
      gp.person_id AS personId,
      gp.confidence,
      gp.is_inferred AS isInferred,
      p.name,
      p.normalized_name AS normalizedName,
      sr.source_name AS sourceName,
      sr.source_type AS sourceType,
      sr.source_url AS sourceUrl,
      sr.compliance_status AS complianceStatus,
      sr.confidence_level AS sourceConfidence
    FROM game_people gp
    LEFT JOIN people p ON p.id = gp.person_id
    LEFT JOIN source_records sr ON sr.id = gp.source_record_id
    WHERE gp.role = 'composer'
  `).all();
}

function mapComposerEntry(entry, fallbackScore, rule, sourceName) {
  return {
    personId: entry?.personId || entry?.id || null,
    name: entry?.name || null,
    normalizedName: entry?.normalizedName || entry?.name || null,
    confidence: Number.isFinite(Number(entry?.confidence)) ? Number(entry.confidence) : fallbackScore,
    isInferred: Boolean(entry?.isInferred),
    source: buildConfidenceMeta(
      sourceName
        ? {
            confidenceLevel: fallbackScore,
            isInferred: entry?.isInferred ? 1 : 0,
            sourceName,
            sourceType: sourceName === 'wikipedia' ? 'external_reference' : 'local_seed',
            sourceUrl: entry?.sourceUrl || null,
            complianceStatus: sourceName === 'wikipedia' ? 'reference_only' : 'approved_with_review',
          }
        : null,
      fallbackScore,
      rule
    ),
  };
}

function addComposer(composers, candidate) {
  if (!candidate?.name) {
    return;
  }
  if (composers.some((entry) => entry.name === candidate.name || (entry.personId && candidate.personId && entry.personId === candidate.personId))) {
    return;
  }
  composers.push(candidate);
}

function parseDevTeamComposers(devTeam, fallbackScore, sourceName) {
  return (Array.isArray(devTeam) ? devTeam : [])
    .filter((entry) => /composer/i.test(String(entry?.role || '')))
    .map((entry) => mapComposerEntry({ name: entry.name }, fallbackScore, sourceName === 'encyclopedia_seed' ? 'seed_dev_team' : 'processed_dev_team', sourceName))
    .filter((entry) => entry.name);
}

function parseSynopsisComposers(text, fallbackScore, sourceName, sourceUrl) {
  return extractComposerNamesFromText(text)
    .map((name) => ({
      personId: null,
      name,
      normalizedName: name,
      confidence: fallbackScore,
      isInferred: true,
      source: buildConfidenceMeta({
        confidenceLevel: fallbackScore,
        isInferred: 1,
        sourceName,
        sourceType: 'derived',
        sourceUrl: sourceUrl || null,
        complianceStatus: sourceName === 'wikipedia' ? 'reference_only' : null,
      }, fallbackScore, 'extracted_from_synopsis'),
    }));
}

function main() {
  ensureWorkspace();

  const inputPath = resolveInputPath();
  const { rows } = loadEnrichedRows(inputPath);
  const startedAt = new Date();
  const { dateStamp, outputPath, logPath } = buildPipelinePaths('music', startedAt);
  const composersPath = path.join(CANONICAL_DIR, `composers_${dateStamp}.json`);
  const db = openSourceDb();

  try {
    const composerRows = loadComposerRows(db);
    const composersByGame = new Map();
    const composerRegistry = new Map();
    const encyclopediaSeed = loadEncyclopediaSeedMap();
    const wikipediaCache = loadWikipediaCacheMap();

    composerRows.forEach((row) => {
      if (!composersByGame.has(row.gameId)) {
        composersByGame.set(row.gameId, []);
      }

      addComposer(composersByGame.get(row.gameId), {
        personId: row.personId,
        name: row.name || row.normalizedName || null,
        normalizedName: row.normalizedName || null,
        confidence: Number.isFinite(Number(row.confidence)) ? Number(row.confidence) : null,
        isInferred: Boolean(row.isInferred),
        source: buildConfidenceMeta({
          confidenceLevel: row.sourceConfidence ?? row.confidence,
          isInferred: row.isInferred,
          sourceName: row.sourceName,
          sourceType: row.sourceType,
          sourceUrl: row.sourceUrl,
          complianceStatus: row.complianceStatus,
        }, row.confidence, 'legacy_backfill_credit'),
      });
    });

    const payload = rows.map((row) => {
      const itemKey = row.sourceId || row.id;
      const composers = [...(composersByGame.get(itemKey) || [])];
      const seedRow = encyclopediaSeed.get(itemKey) || null;
      const wikiRow = wikipediaCache.get(itemKey) || null;

      (Array.isArray(row.ostComposers) ? row.ostComposers : [])
        .map((entry) => mapComposerEntry(entry, row.sourceConfidence || 0.6, 'fallback_item_confidence', null))
        .forEach((entry) => addComposer(composers, entry));

      parseDevTeamComposers(row.devTeam, row.sourceConfidence || 0.7, 'processed_dev_team')
        .forEach((entry) => addComposer(composers, entry));

      parseDevTeamComposers(seedRow?.dev_team, 0.88, 'encyclopedia_seed')
        .forEach((entry) => addComposer(composers, entry));

      parseSynopsisComposers(row.synopsis, Math.max(0.55, (row.sourceConfidence || 0.6) - 0.05), 'processed_synopsis', null)
        .forEach((entry) => addComposer(composers, entry));

      if (wikiRow?.synopsis) {
        parseSynopsisComposers(wikiRow.synopsis, 0.67, 'wikipedia', wikiRow.wikiUrl)
          .forEach((entry) => addComposer(composers, entry));
      }

      composers.forEach((composer) => {
        const key = composer.personId || composer.name;
        if (!composerRegistry.has(key)) {
          composerRegistry.set(key, {
            id: composer.personId || `composer:${slugifyValue(composer.name)}`,
            name: composer.name,
            normalizedName: composer.normalizedName,
            sourceRules: new Set(),
            games: [],
          });
        }
        composerRegistry.get(key).sourceRules.add(composer.source.rule);
        composerRegistry.get(key).games.push({
          itemId: row.id,
          title: row.title,
        });
      });

      const tracks = uniqueStrings(toStringList(row.ostNotableTracks));

      return {
        itemId: row.id,
        sourceId: itemKey,
        slug: row.slug,
        title: row.title,
        console: row.console,
        music: {
          composers,
          tracks,
          ost: {
            hasMusicMetadata: composers.length > 0 || tracks.length > 0,
            releaseCount: 0,
            releases: [],
            needsReleaseEnrichment: composers.length > 0 || tracks.length > 0,
          },
        },
      };
    });

    const composersPayload = Array.from(composerRegistry.values())
      .map((entry) => ({
        id: entry.id,
        slug: slugifyValue(entry.name || entry.id),
        name: entry.name,
        normalizedName: entry.normalizedName,
        sourceRules: Array.from(entry.sourceRules).sort(),
        gamesCount: entry.games.length,
        games: entry.games.sort((left, right) => left.itemId.localeCompare(right.itemId)),
      }))
      .sort((left, right) => (left.name || '').localeCompare(right.name || ''));

    writePipelineArtifacts(outputPath, payload, logPath, {
      pipeline: '09_music',
      run_at: startedAt.toISOString(),
      input: formatOutputPath(inputPath),
      outputs: {
        music: formatOutputPath(outputPath),
        composers: formatOutputPath(composersPath),
      },
      counts: {
        items: payload.length,
        itemsWithComposers: payload.filter((entry) => entry.music.composers.length > 0).length,
        itemsWithTracks: payload.filter((entry) => entry.music.tracks.length > 0).length,
        itemsNeedingReleaseEnrichment: payload.filter((entry) => entry.music.ost.needsReleaseEnrichment).length,
        totalUniqueComposers: composersPayload.length,
        composersFromWikipediaExtraction: payload.filter((entry) => entry.music.composers.some((composer) => composer.source.sourceName === 'wikipedia')).length,
        composersFromSeedDevTeam: payload.filter((entry) => entry.music.composers.some((composer) => composer.source.sourceName === 'encyclopedia_seed')).length,
      },
      errors: 0,
      skipped: 0,
    });
    writeJson(composersPath, composersPayload);

    console.log(`[MUSIC] ${payload.length} items traités, ${composersPayload.length} compositeurs uniques, 0 erreur, rapport: ${formatOutputPath(logPath)}`);
    console.log(`[MUSIC] music: ${formatOutputPath(outputPath)}`);
    console.log(`[MUSIC] composers: ${formatOutputPath(composersPath)}`);
  } finally {
    db.close();
  }
}

main();
