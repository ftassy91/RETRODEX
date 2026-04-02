#!/usr/bin/env node
'use strict'

const path = require('path')

const { parseStringFlag, readJson, latestJsonFile } = require('./_work-catalog-common')
const { writeGeneratedManifest } = require('./_manifest-output-common')

const SNAPSHOT_DIR = path.join(__dirname, '..', '..', 'data', 'enrichment', 'wikidata')

function timestamp() {
  return new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
}

function pickBestCandidates(candidates = [], limit = 4) {
  return [...candidates]
    .sort((left, right) => Number(right.confidenceLevel || 0) - Number(left.confidenceLevel || 0))
    .slice(0, limit)
}

function buildDevTeamPayload(entry) {
  const candidates = pickBestCandidates(entry.developerCandidates, 4)
  return {
    gameId: entry.gameId,
    title: entry.title,
    devTeam: candidates.map((candidate) => ({
      role: 'developer',
      name: candidate.name,
      confidence: candidate.confidenceLevel,
      isInferred: false,
    })),
    sourceName: candidates[0].sourceName,
    sourceType: candidates[0].sourceType,
    sourceUrl: candidates[0].sourceUrl,
    confidenceLevel: candidates[0].confidenceLevel,
    notes: candidates[0].notes,
    isInferred: false,
    candidateContext: {
      wikidataQid: entry.wikidataQid || null,
      wikidataUrl: entry.wikidataUrl || null,
    },
  }
}

function buildComposerPayload(entry) {
  const candidates = pickBestCandidates(entry.composerCandidates, 6)
  return {
    gameId: entry.gameId,
    title: entry.title,
    ostComposers: candidates.map((candidate, index) => ({
      name: candidate.name,
      role: 'composer',
      confidence: candidate.confidenceLevel,
      billingOrder: index + 1,
    })),
    sourceName: candidates[0].sourceName,
    sourceType: candidates[0].sourceType,
    sourceUrl: candidates[0].sourceUrl,
    confidenceLevel: candidates[0].confidenceLevel,
    notes: candidates[0].notes,
    candidateContext: {
      wikidataQid: entry.wikidataQid || null,
      wikidataUrl: entry.wikidataUrl || null,
    },
  }
}

function main() {
  const snapshotPath = parseStringFlag(process.argv, 'snapshot', latestJsonFile(SNAPSHOT_DIR, '_wikidata_credit_snapshot.json'))
  const snapshot = readJson(snapshotPath)
  if (!Array.isArray(snapshot?.entries)) {
    throw new Error(`Snapshot file does not contain an entries array: ${snapshotPath}`)
  }
  const ready = process.argv.includes('--ready')

  const devEntries = snapshot.entries
    .filter((entry) => entry.debtType === 'dev_team' && entry.status === 'resolved' && entry.developerCandidates?.length)
  const composerEntries = snapshot.entries
    .filter((entry) => entry.debtType === 'composers' && entry.status === 'resolved' && entry.composerCandidates?.length)

  const outputs = []

  if (devEntries.length) {
    const batchKey = `generated_dev_team_wikidata_${timestamp()}`
    const manifestPath = writeGeneratedManifest(batchKey, {
      batchKey,
      batchType: 'dev_team',
      reviewStatus: ready ? 'ready' : 'review_required',
      notes: `Generated dev team manifest from Wikidata/Wikipedia snapshot (${devEntries.length} targets)`,
      generatedFrom: {
        source: 'wikidata_credit_snapshot',
        snapshotPath,
      },
      sources: ['wikidata', 'wikipedia'],
      writeTargets: ['games', 'game_people', 'people', 'source_records', 'field_provenance'],
      publishDomains: ['records', 'credits_music', 'ui'],
      postChecks: ['records', 'credits_music', 'ui'],
      ids: devEntries.map((entry) => entry.gameId),
      payload: devEntries.map(buildDevTeamPayload),
    })
    outputs.push({ batchType: 'dev_team', manifestPath, targetCount: devEntries.length })
  }

  if (composerEntries.length) {
    const batchKey = `generated_composers_wikidata_${timestamp()}`
    const manifestPath = writeGeneratedManifest(batchKey, {
      batchKey,
      batchType: 'composers',
      reviewStatus: ready ? 'ready' : 'review_required',
      notes: `Generated composer manifest from Wikidata/Wikipedia snapshot (${composerEntries.length} targets)`,
      generatedFrom: {
        source: 'wikidata_credit_snapshot',
        snapshotPath,
      },
      sources: ['wikidata', 'wikipedia'],
      writeTargets: ['games', 'game_people', 'people', 'source_records', 'field_provenance'],
      publishDomains: ['records', 'credits_music', 'ui'],
      postChecks: ['records', 'credits_music', 'ui'],
      ids: composerEntries.map((entry) => entry.gameId),
      payload: composerEntries.map(buildComposerPayload),
    })
    outputs.push({ batchType: 'composers', manifestPath, targetCount: composerEntries.length })
  }

  console.log(JSON.stringify({
    mode: 'generate',
    snapshotPath,
    outputs,
  }, null, 2))
}

try {
  main()
} catch (error) {
  console.error('[generate-wikidata-credit-manifests]', error && error.stack ? error.stack : error)
  process.exit(1)
}
