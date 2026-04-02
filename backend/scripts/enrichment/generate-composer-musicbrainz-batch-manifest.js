#!/usr/bin/env node
'use strict'

const path = require('path')
const { sequelize } = require('../../src/database')
const { runMigrations } = require('../../src/services/migration-runner')
const { getGameAuditEntries } = require('../../src/services/admin/audit')
const { writeGeneratedManifest } = require('./_manifest-output-common')
const { loadSelectionBand, parseNumberFlag, parseStringFlag, uniqueStrings } = require('./_work-catalog-common')
const { loadMusicbrainzDataset } = require('./_musicbrainz-dataset-common')

function parseIds(argv) {
  const token = argv.find((value) => String(value).startsWith('--ids='))
  if (!token) return []
  return uniqueStrings(String(token).slice('--ids='.length).split(','))
}

function buildBatchKey(prefix) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${prefix}_${stamp}`
}

async function main() {
  const datasetPath = parseStringFlag(process.argv, 'dataset', null)
  if (!datasetPath) {
    throw new Error('Missing required --dataset=<json|jsonl> flag')
  }

  const limit = parseNumberFlag(process.argv, 'limit', 15)
  const explicitIds = parseIds(process.argv)
  const tier = parseStringFlag(process.argv, 'tier', 'Tier A')
  const batchKey = parseStringFlag(process.argv, 'batch-key', buildBatchKey('generated_composers_musicbrainz'))
  const selectionBandPath = parseStringFlag(process.argv, 'selection-band', null)
  const readyIfComplete = process.argv.includes('--ready-if-complete')
  const allowExplicitIds = process.argv.includes('--allow-explicit-ids')
  const publishedOnly = process.argv.includes('--published-only')

  await runMigrations(sequelize)

  const selectionBand = selectionBandPath ? loadSelectionBand(selectionBandPath) : null
  const selectionIds = selectionBand ? selectionBand.ids : []
  const musicbrainzMap = loadMusicbrainzDataset(path.resolve(datasetPath))

  const entries = await getGameAuditEntries({
    limit: 5000,
    persist: false,
    gameIds: uniqueStrings([...explicitIds, ...selectionIds]),
  })

  const selected = entries
    .filter((entry) => !selectionIds.length || selectionIds.includes(entry.entityId))
    .filter((entry) => entry.missingCriticalFields.includes('ost_composers') || (allowExplicitIds && explicitIds.includes(entry.entityId)))
    .filter((entry) => !tier || String(entry.tier || '') === tier || explicitIds.includes(entry.entityId))
    .filter((entry) => !publishedOnly || String(entry.curationStatus || '') === 'published')
    .filter((entry) => musicbrainzMap.has(String(entry.entityId)))
    .slice(0, limit)

  if (!selected.length) {
    throw new Error('No MusicBrainz composer candidates matched the requested filters')
  }

  const payload = selected.map((entry) => {
    const datasetEntry = musicbrainzMap.get(String(entry.entityId))
    return {
      gameId: entry.entityId,
      title: entry.title,
      ostComposers: datasetEntry.composers.map((composer) => ({
        name: composer.name,
        role: 'composer',
      })),
      sourceName: 'musicbrainz',
      sourceType: 'musicbrainz_core_dataset',
      sourceUrl: datasetEntry.sourceUrl || '',
      confidenceLevel: 0.84,
      notes: datasetEntry.releaseTitle
        ? `MusicBrainz core dataset match from soundtrack release "${datasetEntry.releaseTitle}"`
        : `MusicBrainz core dataset match for ${entry.title}`,
      candidateContext: {
        tier: entry.tier,
        curationStatus: entry.curationStatus || null,
        platform: entry.platform || null,
        priorityScore: entry.priorityScore,
        missingCriticalFields: entry.missingCriticalFields,
        musicbrainzReleaseId: datasetEntry.musicbrainzReleaseId,
        musicbrainzReleaseGroupId: datasetEntry.musicbrainzReleaseGroupId,
        releaseTitle: datasetEntry.releaseTitle,
        releaseDate: datasetEntry.releaseDate,
        trackCount: datasetEntry.tracks.length,
        label: datasetEntry.label,
        selectionBand: selectionBand?.label || null,
      },
    }
  })

  const completeCount = payload.filter((entry) => entry.ostComposers.length && entry.sourceName && entry.sourceType).length
  const manifest = {
    batchKey,
    batchType: 'composers',
    reviewStatus: readyIfComplete && completeCount === payload.length ? 'ready' : 'review_required',
    notes: `Generated composer candidate batch from MusicBrainz core dataset (${payload.length} targets)`,
    generatedFrom: {
      source: 'musicbrainz_core_dataset',
      datasetPath: path.resolve(datasetPath),
      filters: {
        limit,
        tier,
        publishedOnly,
        explicitIds,
        allowExplicitIds,
        selectionBandPath,
        readyIfComplete,
      },
      generatedAt: new Date().toISOString(),
    },
    sources: ['musicbrainz'],
    writeTargets: ['games', 'game_people', 'people', 'source_records', 'field_provenance'],
    publishDomains: ['records', 'credits_music', 'ui'],
    postChecks: ['records', 'credits_music', 'ui'],
    ids: payload.map((entry) => entry.gameId),
    payload,
  }

  const manifestPath = writeGeneratedManifest(batchKey, manifest)
  console.log(JSON.stringify({
    mode: 'generate',
    batchType: 'composers',
    reviewStatus: manifest.reviewStatus,
    manifestPath,
    targetCount: payload.length,
    ids: manifest.ids,
    completeCount,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error('[generate-composer-musicbrainz-batch-manifest]', error && error.stack ? error.stack : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await sequelize.close()
  })
