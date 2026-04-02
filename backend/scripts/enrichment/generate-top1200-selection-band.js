#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const {
  TOP1000_DIR,
  EXTENSION200_DIR,
  TOP1200_DIR,
  timestamp,
  ensureDir,
  latestJsonFile,
  loadSelectionBand,
  parseStringFlag,
  uniqueStrings,
} = require('./_work-catalog-common')

function normalizeBandItems(items = [], bandName) {
  return items.map((entry, index) => ({
    entityId: String(entry.entityId),
    title: entry.title || null,
    platform: entry.platform || null,
    tier: entry.tier || null,
    rank: Number(entry.rank || index + 1),
    band: bandName,
    priorityScore: Number(entry.priorityScore || 0),
    completenessScore: Number(entry.completenessScore || 0),
    confidenceScore: Number(entry.confidenceScore || 0),
    sourceCoverageScore: Number(entry.sourceCoverageScore || 0),
    freshnessScore: Number(entry.freshnessScore || 0),
    missingCriticalFields: Array.isArray(entry.missingCriticalFields) ? entry.missingCriticalFields : [],
    curationStatus: entry.curationStatus || null,
    isPublished: Boolean(entry.isPublished),
  }))
}

function main() {
  ensureDir(TOP1200_DIR)

  const top1000Path = parseStringFlag(process.argv, 'top1000', latestJsonFile(TOP1000_DIR))
  const extension200Path = parseStringFlag(process.argv, 'extension200', latestJsonFile(EXTENSION200_DIR))

  const top1000 = loadSelectionBand(top1000Path)
  const extension200 = loadSelectionBand(extension200Path)

  const coreItems = normalizeBandItems(top1000.items.slice(0, 1000), 'core1000')
  const extensionItems = normalizeBandItems(extension200.items.slice(0, 200), 'extension200')
  const items = [...coreItems, ...extensionItems]
  const ids = uniqueStrings(items.map((entry) => entry.entityId))

  const output = {
    generatedAt: new Date().toISOString(),
    label: 'top1200-core-plus-extension',
    source: {
      core1000: top1000Path,
      extension200: extension200Path,
    },
    counts: {
      core1000: coreItems.length,
      extension200: extensionItems.length,
      total: ids.length,
    },
    ids,
    items,
  }

  const outputPath = path.join(TOP1200_DIR, `${timestamp()}_top1200_selection_band.json`)
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))

  console.log(JSON.stringify({
    mode: 'generate',
    outputPath,
    counts: output.counts,
    sampleCore: coreItems.slice(0, 5).map((entry) => entry.entityId),
    sampleExtension: extensionItems.slice(0, 5).map((entry) => entry.entityId),
  }, null, 2))
}

try {
  main()
} catch (error) {
  console.error('[generate-top1200-selection-band]', error && error.stack ? error.stack : error)
  process.exitCode = 1
}
