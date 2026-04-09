#!/usr/bin/env node
'use strict'

const {
  parseArgs,
  parseIdFilter,
  createRemoteClient,
  openReadonlySqlite,
} = require('../_supabase-publish-common')
const { sequelize } = require('../../src/database')
const { runMigrations } = require('../../src/services/migration-runner')

const {
  buildMarketPublishPayload,
  buildScoredMarketSnapshots,
  getMarketConnector,
  matchNormalizedSoldRecord,
  normalizeRawSoldRecord,
  buildCatalogIndex,
  startPriceIngestRun,
  completePriceIngestRun,
  writeRejections,
  buildMarketQualityReport,
} = require('../../src/services/market')

function readCatalog(sqlite, filterIds, args = {}) {
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

  return filtered.slice(0, Number(args.limit || 25))
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

async function runMarketPipeline(args = {}) {
  const connectorNames = String(args.connectors || args.connector || 'yahoo_auctions_jp')
    .split(',')
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  const connectors = connectorNames.map((name) => getMarketConnector(name))
  const filterIds = parseIdFilter(args)
  const apply = Boolean(args.apply)
  const ensureSchema = Boolean(args.ensureSchema)
  const recordRun = args.recordRun != null ? Boolean(args.recordRun) : apply
  const sqlite = openReadonlySqlite()
  let client = null
  let runRecord = null

  try {
    if (apply || ensureSchema) {
      await runMigrations(sequelize)
    }

    const catalogRows = readCatalog(sqlite, filterIds, args)
    const catalogIndex = buildCatalogIndex(catalogRows)
    const seeds = buildSeeds(args, catalogRows)
    const rawRecords = []

    if (apply || recordRun) {
      runRecord = await startPriceIngestRun({
        sourceMarket: connectors.length === 1 ? connectors[0].sourceMarket : null,
        sourceScope: connectorNames.join(','),
        pipelineName: 'market_pipeline',
        dryRun: !apply,
      })
    }

    for (const connector of connectors) {
      for (const seed of seeds) {
        const rows = await connector.fetchSoldRecords(seed, {
          fixture: args.fixture,
          fixtureDir: args.fixtureDir,
          limit: Number(args.recordLimit || 5),
        })
        rawRecords.push(...rows)
      }
    }

    const normalizedRecords = rawRecords.map((record) => normalizeRawSoldRecord(record, {
      fxRates: {
        USD: args.fxUsdToEur ? Number(args.fxUsdToEur) : undefined,
        JPY: args.fxJpyToEur ? Number(args.fxJpyToEur) : undefined,
      },
    }))

    const matchedRecords = normalizedRecords.map((record) => ({
      ...record,
      match: matchNormalizedSoldRecord(record, catalogIndex, {
        targetGameId: args.gameId || record.seed_game_id,
        targetTitle: args.query || record.query_text,
        minimumScore: args.minimumScore ? Number(args.minimumScore) : 0.55,
      }),
    }))

    const marketResult = buildScoredMarketSnapshots(matchedRecords)
    const publishPayload = buildMarketPublishPayload(marketResult)
    const qualityReport = buildMarketQualityReport(marketResult, {
      pipelineName: 'market_pipeline',
      sourceScope: connectorNames.join(','),
    })

    if (recordRun) {
      const rejected = matchedRecords.filter((r) => r.is_rejected)
      if (rejected.length > 0) {
        await writeRejections(rejected, { stage: 'normalize' })
      }
    }

    let publishResult = null
    if (apply) {
      client = createRemoteClient()
      await client.connect()
      publishResult = await require('../../src/services/market/publish/publish-market-snapshot').publishMarketSnapshot(
        client,
        publishPayload,
        { apply: true }
      )
    }

    if (runRecord?.id) {
      await completePriceIngestRun(runRecord.id, {
        status: 'completed',
        fetchedCount: rawRecords.length,
        normalizedCount: normalizedRecords.length,
        insertedCount: publishPayload.observations.length,
        dedupedCount: 0,
        matchedCount: matchedRecords.filter((record) => record.match?.game?.id).length,
        rejectedCount: matchedRecords.filter((record) => record.is_rejected).length,
        publishedGamesCount: publishPayload.gameUpdates.length,
        marketResult,
        qualityReport,
        sourceScope: connectorNames.join(','),
        pipelineName: 'market_pipeline',
      })
    }

    return {
      mode: apply ? 'apply' : 'dry-run',
      connectors: connectors.map((connector) => connector.name),
      seeds: seeds.map((seed) => ({ id: seed.id, title: seed.title, platform: seed.platform })),
      rawRecords: rawRecords.length,
      normalized: normalizedRecords.length,
      matched: matchedRecords.filter((record) => record.match?.game?.id).length,
      rejected: matchedRecords.filter((record) => record.is_rejected).length,
      publishPayload,
      qualityReport,
      publish: publishResult,
    }
  } catch (error) {
    if (runRecord?.id) {
      await completePriceIngestRun(runRecord.id, {
        status: 'failed',
        errorSummary: error.message,
        sourceScope: connectorNames.join(','),
        pipelineName: 'market_pipeline',
      }).catch(() => {})
    }
    throw error
  } finally {
    sqlite.close()
    if (client) {
      await client.end().catch(() => {})
    }
  }
}

if (require.main === module) {
  runMarketPipeline(parseArgs(process.argv.slice(2)))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2))
    })
    .catch((error) => {
      console.error('[market-pipeline] failed:', error.message)
      process.exitCode = 1
    })
}

module.exports = {
  runMarketPipeline,
}
