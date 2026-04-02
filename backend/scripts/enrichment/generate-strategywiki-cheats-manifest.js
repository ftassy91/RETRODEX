#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { writeGeneratedManifest } = require('./_manifest-output-common')
const {
  TOP1200_DIR,
  latestJsonFile,
  loadSelectionBand,
  parseNumberFlag,
  parseStringFlag,
} = require('./_work-catalog-common')

const SNAPSHOT_DIR = path.join(__dirname, '..', '..', 'data', 'strategywiki')

function buildBatchKey(prefix) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${prefix}_${stamp}`
}

function latestSnapshotFile() {
  const files = fs.readdirSync(SNAPSHOT_DIR)
    .filter((entry) => entry.endsWith('_cheats_snapshot.json'))
    .map((entry) => ({
      path: path.join(SNAPSHOT_DIR, entry),
      stat: fs.statSync(path.join(SNAPSHOT_DIR, entry)),
    }))
    .sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs)

  if (!files.length) {
    throw new Error(`No StrategyWiki cheats snapshot found in ${SNAPSHOT_DIR}`)
  }

  return files[0].path
}

function parseIds(argv) {
  const token = argv.find((value) => String(value).startsWith('--ids='))
  if (!token) return []
  return Array.from(new Set(String(token).slice('--ids='.length).split(',').map((value) => value.trim()).filter(Boolean)))
}

function normalizeCheatCodes(values) {
  return (Array.isArray(values) ? values : [])
    .map((entry) => ({
      name: String(entry.name || entry.label || '').trim(),
      code: String(entry.code || entry.input || '').trim(),
      effect: String(entry.effect || entry.description || '').trim(),
      notes: String(entry.notes || '').trim() || null,
    }))
    .filter((entry) => entry.name && entry.code && entry.effect)
}

function main() {
  const top1200Path = parseStringFlag(process.argv, 'top1200', latestJsonFile(TOP1200_DIR))
  const snapshotPath = parseStringFlag(process.argv, 'snapshot', latestSnapshotFile())
  const limit = parseNumberFlag(process.argv, 'limit', 100)
  const explicitIds = parseIds(process.argv)
  const batchKey = parseStringFlag(
    process.argv,
    'batch-key',
    buildBatchKey('generated_strategywiki_cheats')
  )

  const band = loadSelectionBand(top1200Path)
  const metaById = new Map(band.items.map((item) => [String(item.entityId), item]))
  const allowedIds = new Set((band.ids || []).slice(0, 1200))
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'))

  let entries = (Array.isArray(snapshot.entries) ? snapshot.entries : [])
    .filter((entry) => String(entry.field || '') === 'cheat_codes')
    .filter((entry) => allowedIds.has(String(entry.gameId)))
    .filter((entry) => !explicitIds.length || explicitIds.includes(String(entry.gameId)))
    .map((entry) => {
      const meta = metaById.get(String(entry.gameId)) || {}
      return {
        gameId: String(entry.gameId),
        title: String(entry.title || meta.title || '').trim(),
        cheatCodes: normalizeCheatCodes(entry.cheatCodes),
        sourceName: 'strategywiki',
        sourceType: 'strategywiki_snapshot',
        sourceUrl: String(entry.pageUrl || '').trim() || null,
        confidenceLevel: 0.88,
        notes: `Curated from reviewed StrategyWiki cheats snapshot (${path.basename(snapshotPath)}).`,
        candidateContext: {
          band: meta.band || null,
          tier: meta.tier || null,
          rank: Number(meta.rank || 0) || null,
          curationStatus: meta.curationStatus || null,
          priorityScore: Number(meta.priorityScore || 0),
          completenessScore: Number(meta.completenessScore || 0),
          confidenceScore: Number(meta.confidenceScore || 0),
          strategywikiPage: String(entry.pageUrl || '').trim() || null,
        },
      }
    })
    .filter((entry) => entry.cheatCodes.length)
    .sort((left, right) => {
      const leftRank = Number(left.candidateContext.rank || 999999)
      const rightRank = Number(right.candidateContext.rank || 999999)
      if (leftRank !== rightRank) return leftRank - rightRank
      return left.title.localeCompare(right.title)
    })
    .slice(0, limit)

  if (!entries.length) {
    throw new Error('No StrategyWiki cheat candidates matched the requested filters')
  }

  const manifest = {
    batchKey,
    batchType: 'richness',
    reviewStatus: 'ready',
    notes: `Generated StrategyWiki cheat-code batch (${entries.length} targets)`,
    generatedFrom: {
      source: 'strategywiki_snapshot',
      generatedAt: new Date().toISOString(),
      filters: {
        top1200Path,
        snapshotPath,
        explicitIds,
        limit,
      },
    },
    sources: ['strategywiki'],
    writeTargets: ['games', 'game_editorial', 'source_records', 'field_provenance'],
    publishDomains: ['records', 'editorial', 'ui'],
    postChecks: ['records', 'editorial', 'ui'],
    ids: entries.map((entry) => entry.gameId),
    payload: entries,
  }

  const manifestPath = writeGeneratedManifest(batchKey, manifest)
  console.log(JSON.stringify({
    mode: 'generate',
    batchType: 'richness',
    reviewStatus: manifest.reviewStatus,
    snapshotPath,
    manifestPath,
    targetCount: manifest.ids.length,
    cheatCodeEntries: manifest.payload.reduce((sum, entry) => sum + entry.cheatCodes.length, 0),
    ids: manifest.ids,
  }, null, 2))
}

try {
  main()
} catch (error) {
  console.error('[generate-strategywiki-cheats-manifest]', error && error.stack ? error.stack : error)
  process.exitCode = 1
}
