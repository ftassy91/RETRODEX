#!/usr/bin/env node
'use strict'

const {
  parseArgs,
  parseIdFilter,
  createRemoteClient,
  openReadonlySqlite,
} = require('../_supabase-publish-common')

const {
  getMarketConnector,
  normalizeRawSoldRecord,
  buildCatalogIndex,
  matchNormalizedSoldRecord,
  buildBucketSnapshots,
  scoreMatchedRecord,
  buildMarketPublishPayload,
  publishMarketSnapshot,
} = require('../../src/services/market')

function buildQualityReport(scoredRecords = [], connectorName) {
  const acceptedRows = scoredRecords.filter((record) => record.accepted).length
  const totalRows = scoredRecords.length
  const byConfidenceTier = scoredRecords.reduce((acc, record) => {
    const key = String(record.confidenceTier || record.confidence_classifier || 'unknown')
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const byRejectionReason = scoredRecords.reduce((acc, record) => {
    if (!record.accepted) {
      const key = String(record.rejection_reason || 'unknown')
      acc[key] = (acc[key] || 0) + 1
    }
    return acc
  }, {})
  const averageConfidenceScore = totalRows
    ? Number((scoredRecords.reduce((sum, record) => sum + Number(record.confidence_score || 0), 0) / totalRows).toFixed(4))
    : 0

  return {
    pipelineName: 'run-market-pipeline',
    sourceScope: connectorName,
    totalRows,
    acceptedRows,
    rejectedRows: totalRows - acceptedRows,
    averageConfidenceScore,
    byConfidenceTier,
    byRejectionReason,
  }
}

function readCatalog(sqlite, filterIds, args = {}) {
  const limit = Number(args.limit || 25)
  const rows = sqlite.prepare(`
    SELECT id, title, console, year, loose_price, cib_price, mint_price
    FROM games
    WHERE type = 'game'
    ORDER BY title ASC
  `).all()

  const filtered = rows.filter((row) => !filterIds || filterIds.has(String(row.id)))
  if (args.query) {
    return filtered
  }
  return filtered.slice(0, limit)
}

function buildSeeds(args = {}, catalogRows = []) {
  if (args.query) {
    return [{
      id: String(args.gameId || '').trim() || null,
      title: String(args.query).trim(),
      platform: String(args.platform || '').trim() || null,
      query: String(args.query).trim(),
    }]
  }

  return catalogRows.map((row) => ({
    id: row.id,
    title: row.title,
    platform: row.console,
    query: `${row.title} ${row.console || ''}`.trim(),
  }))
}

async function fetchConnectorRecords(connector, seeds, args) {
  const results = []
  for (const seed of seeds) {
    const records = await connector.fetchSoldRecords(seed, {
      limit: args.recordLimit || 3,
      fixture: args.fixture,
    })
    results.push(...records)
  }
  return results
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const filterIds = parseIdFilter(args)
  const apply = process.argv.includes('--apply')
  const connector = getMarketConnector(args.connector || 'ebay_sold')
  const sqlite = openReadonlySqlite()

  let client = null

  try {
    const catalogRows = readCatalog(sqlite, filterIds, args)
    const seeds = buildSeeds(args, catalogRows)
    const catalogIndex = buildCatalogIndex(catalogRows)
    const rawRecords = await fetchConnectorRecords(connector, seeds, args)

    const normalizedRecords = rawRecords.map((record) => normalizeRawSoldRecord(record))
    const matchedRecords = normalizedRecords.map((record) => ({
      ...record,
      match: matchNormalizedSoldRecord(record, catalogIndex, {
        targetGameId: record.seed_game_id || args.gameId,
      }),
    }))
    const bucketSnapshots = buildBucketSnapshots(matchedRecords.filter((record) => record.match?.game?.id))
    const scoredRecords = matchedRecords.map((record) => scoreMatchedRecord(record, { bucketSnapshots }))
    const publishPayload = buildMarketPublishPayload(scoredRecords)
    const qualityReport = buildQualityReport(scoredRecords, connector.name)

    let publishResult = null
    if (apply) {
      client = createRemoteClient()
      await client.connect()
      publishResult = await publishMarketSnapshot(client, publishPayload, { apply: true })
    }

    console.log(JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      connector: connector.name,
      seeds: seeds.map((seed) => ({ id: seed.id, title: seed.title, platform: seed.platform })),
      rawRecords: rawRecords.length,
      normalized: normalizedRecords.length,
      matched: matchedRecords.filter((record) => record.match?.game?.id).length,
      rejected: normalizedRecords.filter((record) => record.is_rejected).length,
      snapshots: publishPayload.summary.snapshots,
      rawAccepted: publishPayload.summary.rawAccepted,
      qualityReport,
      sample: scoredRecords.slice(0, 5).map((record) => ({
        title_raw: record.title_raw,
        game_id: record.match?.game?.id || null,
        confidence_score: record.confidence_score,
        classifier: record.confidence_classifier,
        condition: record.normalized_condition,
        rejection_reasons: record.rejection_reasons,
        aggregate_blocks: record.aggregate_blocks,
      })),
      publish: publishResult,
    }, null, 2))
  } finally {
    sqlite.close()
    if (client) {
      await client.end().catch(() => {})
    }
  }
}

main().catch((error) => {
  console.error('[market-pipeline] failed:', error.message)
  process.exitCode = 1
})
