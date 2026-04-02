#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const {
  ensureWorkspace,
} = require('./_shared');
const {
  PROJECT_ROOT,
  buildPipelinePaths,
  formatOutputPath,
  indexMediaReferences,
  loadEnrichedRows,
  matchAssetsForRow,
  openSourceDb,
  resolveLatestEnrichedFile,
  scanAssetDirectory,
  writePipelineArtifacts,
} = require('./_domain_shared');

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const DOC_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];

const ASSET_SOURCES = [
  {
    variantType: 'generated_gb',
    dir: path.join(PROJECT_ROOT, 'assets', 'generated_gb'),
    extensions: IMAGE_EXTENSIONS,
  },
  {
    variantType: 'hub_pixel_art',
    dir: path.join(PROJECT_ROOT, 'backend', 'public', 'assets', 'hub_pixel_art'),
    extensions: IMAGE_EXTENSIONS,
  },
  {
    variantType: 'legacy_cover',
    dir: path.join(PROJECT_ROOT, 'RETRODEXseedV0', 'prototype_v0', 'assets', 'covers'),
    extensions: IMAGE_EXTENSIONS,
  },
  {
    variantType: 'legacy_generated_gb',
    dir: path.join(PROJECT_ROOT, 'RETRODEXseedV0', 'prototype_v0', 'assets', 'generated_gb'),
    extensions: IMAGE_EXTENSIONS,
  },
  {
    variantType: 'legacy_hub_pixel_art',
    dir: path.join(PROJECT_ROOT, 'RETRODEXseedV0', 'prototype_v0', 'assets', 'hub_pixel_art'),
    extensions: IMAGE_EXTENSIONS,
  },
  {
    variantType: 'notices_local',
    dir: path.join(PROJECT_ROOT, 'assets', 'notices'),
    extensions: DOC_EXTENSIONS,
  },
];

function resolveInputPath() {
  const explicit = process.argv.slice(2).find((arg) => arg.startsWith('--input='));
  if (explicit) {
    return path.resolve(process.cwd(), explicit.slice('--input='.length));
  }
  return resolveLatestEnrichedFile();
}

function mapRemoteMedia(row) {
  return {
    manualUrl: row.url,
    mediaType: row.mediaType,
    location: 'remote',
    provider: row.provider || null,
    complianceStatus: row.complianceStatus || null,
    storageMode: row.storageMode || null,
    url: row.url,
  };
}

function mapLocalAsset(asset, variantType) {
  const complianceStatus =
    asset.sidecar?.reviewStatus === 'approved' ? 'approved'
      : asset.sidecar?.reviewStatus === 'retry' ? 'needs_review'
        : asset.sidecar?.reviewStatus === 'reject' ? 'rejected'
          : null;
  return {
    mediaType: variantType.includes('notice') ? 'manual' : 'asset_variant',
    variantType,
    location: 'local',
    complianceStatus,
    storageMode: variantType.includes('generated') || variantType.includes('hub_pixel_art') || variantType.includes('legacy_cover') ? 'local_generated' : 'local_file',
    url: null,
    relativePath: asset.relativePath,
    fileName: asset.fileName,
    provider: asset.sidecar?.provider || null,
    batchId: asset.sidecar?.batchId || null,
    metadata: asset.sidecar || null,
  };
}

function summarizeCompliance(references) {
  const statuses = Array.from(new Set(references.map((entry) => entry.complianceStatus).filter(Boolean))).sort();
  const hasUnknown = references.some((entry) => !entry.complianceStatus);

  if (!references.length) {
    return {
      overallStatus: 'missing',
      statuses,
      reviewRequired: true,
    };
  }

  if (hasUnknown && !statuses.length) {
    return {
      overallStatus: 'needs_review',
      statuses,
      reviewRequired: true,
    };
  }

  if (!hasUnknown && statuses.length === 1 && statuses[0] === 'reference_only') {
    return {
      overallStatus: 'reference_only',
      statuses,
      reviewRequired: false,
    };
  }

  if (!hasUnknown && statuses.every((status) => ['approved', 'approved_with_review'].includes(status))) {
    return {
      overallStatus: 'approved',
      statuses,
      reviewRequired: statuses.includes('approved_with_review'),
    };
  }

  return {
    overallStatus: hasUnknown ? 'mixed' : 'needs_review',
    statuses,
    reviewRequired: true,
  };
}

function buildAssetIndexes() {
  return ASSET_SOURCES.map((source) => ({
    ...source,
    index: scanAssetDirectory(source.dir, source.extensions),
    manifest: source.variantType === 'hub_pixel_art' ? loadHubManifestMap(source.dir) : new Map(),
    sidecars: source.variantType === 'legacy_cover' ? loadLegacyCoverSidecars(source.dir) : new Map(),
  }));
}

function loadHubManifestMap(rootDir) {
  const manifestPath = path.join(rootDir, '_manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return new Map();
  }

  const rows = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const index = new Map();
  rows.forEach((row) => {
    const keys = [row.game_id, row.slug, row.file]
      .map((value) => String(value || '').toLowerCase().replace(/\.[^.]+$/, ''))
      .filter(Boolean);
    keys.forEach((key) => {
      if (!index.has(key)) {
        index.set(key, []);
      }
      index.get(key).push({
        key,
        fileName: row.file,
        fullPath: path.join(rootDir, row.file),
        relativePath: path.relative(PROJECT_ROOT, path.join(rootDir, row.file)).replace(/\\/g, '/'),
        extension: path.extname(row.file).toLowerCase(),
        manifest: row,
      });
    });
  });
  return index;
}

function loadLegacyCoverSidecars(rootDir) {
  const index = new Map();
  if (!fs.existsSync(rootDir)) {
    return index;
  }

  const walk = (currentPath) => {
    fs.readdirSync(currentPath, { withFileTypes: true }).forEach((entry) => {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        return;
      }
      if (path.extname(entry.name).toLowerCase() !== '.json') {
        return;
      }

      try {
        const payload = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        const gameId = String(payload.game_id || '').trim();
        if (!gameId) {
          return;
        }
        if (!index.has(gameId)) {
          index.set(gameId, []);
        }
        index.get(gameId).push({
          provider: String(payload.batch_id || '').startsWith('dalle3_') ? 'dalle3' : 'local_generation',
          reviewStatus: entry.name.startsWith('APPROVED__')
            ? 'approved'
            : entry.name.startsWith('RETRY__')
              ? 'retry'
              : entry.name.startsWith('REJECT__')
                ? 'reject'
                : payload.status || null,
          sourcePack: payload.source_pack || null,
          prompt: payload.prompt || null,
          revisedPrompt: payload.revised_prompt || null,
          batchId: payload.batch_id || null,
          generatedAt: payload.generated_at || null,
          status: payload.status || null,
        });
      } catch (error) {
        return;
      }
    });
  };

  walk(rootDir);
  return index;
}

function resolveLocalMatches(row, source) {
  const directManifestMatches = source.manifest.get(String(row.id || '').toLowerCase()) || source.manifest.get(String(row.slug || '').toLowerCase()) || [];
  const heuristicMatches = matchAssetsForRow(row, source.index);
  const combined = [...directManifestMatches, ...heuristicMatches];
  return combined.map((asset) => ({
    ...asset,
    sidecar: (source.sidecars.get(row.id) || [])[0] || null,
  }));
}

function main() {
  ensureWorkspace();

  const inputPath = resolveInputPath();
  const { rows } = loadEnrichedRows(inputPath);
  const startedAt = new Date();
  const { outputPath, logPath } = buildPipelinePaths('media_docs', startedAt);
  const db = openSourceDb();

  try {
    const mediaIndex = indexMediaReferences(db);
    const assetIndexes = buildAssetIndexes();

    const payload = rows.map((row) => {
      const itemKey = row.sourceId || row.id;
      const itemMedia = mediaIndex.get(itemKey) || {};
      const remoteManuals = (itemMedia.manual || []).map(mapRemoteMedia);
      const remoteCovers = (itemMedia.cover || []).map(mapRemoteMedia);

      if (row.media?.manual?.url && !remoteManuals.some((entry) => entry.url === row.media.manual.url)) {
        remoteManuals.unshift({
          manualUrl: row.media.manual.url,
          mediaType: 'manual',
          location: 'remote',
          provider: row.media.manual.provider || null,
          complianceStatus: row.media.manual.complianceStatus || null,
          storageMode: row.media.manual.storageMode || null,
          url: row.media.manual.url,
        });
      }

      if (row.media?.cover?.url && !remoteCovers.some((entry) => entry.url === row.media.cover.url)) {
        remoteCovers.unshift({
          manualUrl: null,
          mediaType: 'cover',
          location: 'remote',
          provider: row.media.cover.provider || null,
          complianceStatus: row.media.cover.complianceStatus || null,
          storageMode: row.media.cover.storageMode || null,
          url: row.media.cover.url,
        });
      }

      const localVariants = assetIndexes.flatMap((source) => {
        const matches = resolveLocalMatches(row, source);
        return matches.map((asset) => mapLocalAsset(asset, source.variantType));
      });

      const notices = [
        ...remoteManuals,
        ...localVariants.filter((entry) => entry.mediaType === 'manual'),
      ];
      const assetVariants = [
        ...remoteCovers.map((entry) => ({
          ...entry,
          variantType: 'cover_reference',
        })),
        ...localVariants.filter((entry) => entry.mediaType !== 'manual'),
      ];
      const compliance = summarizeCompliance([...notices, ...assetVariants]);

      return {
        itemId: row.id,
        sourceId: itemKey,
        slug: row.slug,
        title: row.title,
        console: row.console,
        mediaDocs: {
          manualUrl: row.manualUrl || notices.find((entry) => entry.url)?.url || null,
          notices,
          assetVariants,
          compliance,
        },
      };
    });

    const counts = {
      items: payload.length,
      itemsWithManuals: payload.filter((entry) => entry.mediaDocs.notices.length > 0).length,
      itemsWithManualUrl: payload.filter((entry) => entry.mediaDocs.manualUrl).length,
      itemsWithAssetVariants: payload.filter((entry) => entry.mediaDocs.assetVariants.length > 0).length,
      itemsApproved: payload.filter((entry) => entry.mediaDocs.compliance.overallStatus === 'approved').length,
      itemsReferenceOnly: payload.filter((entry) => entry.mediaDocs.compliance.overallStatus === 'reference_only').length,
      itemsNeedsReview: payload.filter((entry) => ['needs_review', 'mixed'].includes(entry.mediaDocs.compliance.overallStatus)).length,
    };

    writePipelineArtifacts(outputPath, payload, logPath, {
      pipeline: '08_media_docs',
      run_at: startedAt.toISOString(),
      input: formatOutputPath(inputPath),
      output: formatOutputPath(outputPath),
      assetSources: ASSET_SOURCES.map((source) => path.relative(PROJECT_ROOT, source.dir).replace(/\\/g, '/')),
      counts,
      nulls: {
        manuals: payload.length - counts.itemsWithManuals,
        assetVariants: payload.length - counts.itemsWithAssetVariants,
      },
      errors: 0,
      skipped: 0,
    });

    console.log(`[MEDIA_DOCS] ${payload.length} items traités, manuals ${counts.itemsWithManuals}, variants ${counts.itemsWithAssetVariants}, 0 erreur, rapport: ${formatOutputPath(logPath)}`);
    console.log(`[MEDIA_DOCS] output: ${formatOutputPath(outputPath)}`);
  } finally {
    db.close();
  }
}

main();
