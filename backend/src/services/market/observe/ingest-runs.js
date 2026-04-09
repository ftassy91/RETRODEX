'use strict'

const { QueryTypes } = require('sequelize')

const { sequelize } = require('../../../database')
const { buildMarketQualityReport } = require('./quality-report')

const schemaCache = new WeakMap()

function buildRunKey(sourceScope, pipelineName = 'market_pipeline') {
  const safeSource = String(sourceScope || 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown'
  const safePipeline = String(pipelineName || 'market_pipeline')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'market_pipeline'
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  return `${safePipeline}__${safeSource}__${timestamp}`
}

async function getPriceIngestRunSchema(targetSequelize) {
  if (schemaCache.has(targetSequelize)) {
    return schemaCache.get(targetSequelize)
  }

  const schema = await targetSequelize.getQueryInterface().describeTable('price_ingest_runs').catch(() => ({}))
  schemaCache.set(targetSequelize, schema || {})
  return schema || {}
}

async function startPriceIngestRun(options = {}) {
  const targetSequelize = options.sequelize || sequelize
  const schema = await getPriceIngestRunSchema(targetSequelize)
  const runKey = options.runKey || buildRunKey(options.sourceScope || options.sourceMarket || 'unknown', options.pipelineName)
  const startedAt = options.startedAt || new Date().toISOString()
  const hasRunKey = Boolean(schema.run_key)
  const hasPipelineName = Boolean(schema.pipeline_name)
  const hasSourceScope = Boolean(schema.source_scope)
  const hasDryRun = Boolean(schema.dry_run)
  const notes = JSON.stringify({
    run_key: runKey,
    pipeline_name: options.pipelineName || 'market_pipeline',
    source_scope: options.sourceScope || null,
    dry_run: options.dryRun !== false,
  })

  const columns = [
    'source_id',
    'source_market',
    'status',
    'started_at',
    'notes',
    'error_summary',
  ]
  const values = [
    ':sourceId',
    ':sourceMarket',
    ':status',
    ':startedAt',
    ':notes',
    'NULL',
  ]

  if (hasRunKey) {
    columns.splice(4, 0, 'run_key')
    values.splice(4, 0, ':runKey')
  }
  if (hasPipelineName) {
    columns.splice(columns.length - 2, 0, 'pipeline_name')
    values.splice(values.length - 2, 0, ':pipelineName')
  }
  if (hasSourceScope) {
    columns.splice(columns.length - 2, 0, 'source_scope')
    values.splice(values.length - 2, 0, ':sourceScope')
  }
  if (hasDryRun) {
    columns.splice(columns.length - 2, 0, 'dry_run')
    values.splice(values.length - 2, 0, ':dryRun')
  }

  await targetSequelize.query(
    `INSERT INTO price_ingest_runs (
      ${columns.join(',\n      ')}
    ) VALUES (
      ${values.join(',\n      ')}
    )`,
    {
      replacements: {
        sourceId: options.sourceId || null,
        sourceMarket: options.sourceMarket || null,
        status: options.status || 'running',
        startedAt,
        runKey,
        pipelineName: options.pipelineName || 'market_pipeline',
        sourceScope: options.sourceScope || null,
        dryRun: options.dryRun !== false,
        notes,
      },
      type: QueryTypes.INSERT,
    }
  )

  const selectSql = hasRunKey
    ? `SELECT *
       FROM price_ingest_runs
       WHERE run_key = :runKey
       LIMIT 1`
    : `SELECT *
       FROM price_ingest_runs
       ORDER BY id DESC
       LIMIT 1`
  const [run] = await targetSequelize.query(selectSql, {
    replacements: hasRunKey ? { runKey } : undefined,
    type: QueryTypes.SELECT,
  })

  return {
    ...(run || {}),
    run_key: runKey,
  }
}

async function completePriceIngestRun(runId, outcome = {}) {
  const targetSequelize = outcome.sequelize || sequelize
  const qualityReport = outcome.qualityReport || buildMarketQualityReport(outcome.marketResult || {}, {
    pipelineName: outcome.pipelineName || 'market_pipeline',
    sourceScope: outcome.sourceScope || null,
  })

  await targetSequelize.query(
    `UPDATE price_ingest_runs
     SET status = :status,
         finished_at = :finishedAt,
         fetched_count = :fetchedCount,
         normalized_count = :normalizedCount,
         inserted_count = :insertedCount,
         deduped_count = :dedupedCount,
         matched_count = :matchedCount,
         rejected_count = :rejectedCount,
         published_games_count = :publishedGamesCount,
         notes = :notes,
         error_summary = :errorSummary
     WHERE id = :id`,
    {
      replacements: {
        id: runId,
        status: outcome.status || 'completed',
        finishedAt: outcome.finishedAt || new Date().toISOString(),
        fetchedCount: Number(outcome.fetchedCount || 0),
        normalizedCount: Number(outcome.normalizedCount || 0),
        insertedCount: Number(outcome.insertedCount || 0),
        dedupedCount: Number(outcome.dedupedCount || 0),
        matchedCount: Number(outcome.matchedCount || 0),
        rejectedCount: Number(outcome.rejectedCount || 0),
        publishedGamesCount: Number(outcome.publishedGamesCount || 0),
        notes: JSON.stringify(qualityReport),
        errorSummary: outcome.errorSummary || null,
      },
      type: QueryTypes.UPDATE,
    }
  )

  const [run] = await targetSequelize.query(
    `SELECT * FROM price_ingest_runs WHERE id = :id LIMIT 1`,
    {
      replacements: { id: runId },
      type: QueryTypes.SELECT,
    }
  )

  return run || null
}

async function writeRejections(records, options = {}) {
  if (!records || records.length === 0) return 0
  const targetSequelize = options.sequelize || sequelize
  const stage = options.stage || 'normalize'

  let written = 0
  for (const record of records) {
    const reasons = record.rejection_reasons || []
    if (reasons.length === 0) continue

    await targetSequelize.query(
      `INSERT INTO price_rejections (
        source_id, source_market, listing_reference, title_raw,
        rejection_reason, rejection_stage, raw_payload
      ) VALUES (
        :sourceId, :sourceMarket, :listingReference, :titleRaw,
        :rejectionReason, :rejectionStage, :rawPayload
      )`,
      {
        replacements: {
          sourceId: record.source_id || null,
          sourceMarket: record.source_market || null,
          listingReference: record.listing_reference || null,
          titleRaw: record.title_raw || null,
          rejectionReason: reasons.join(','),
          rejectionStage: stage,
          rawPayload: record.raw_payload ? JSON.stringify(record.raw_payload) : null,
        },
        type: QueryTypes.INSERT,
      }
    )
    written += 1
  }

  return written
}

module.exports = {
  buildRunKey,
  completePriceIngestRun,
  startPriceIngestRun,
  writeRejections,
}
