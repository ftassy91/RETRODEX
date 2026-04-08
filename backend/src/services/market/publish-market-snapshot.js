'use strict'

function median(values = []) {
  if (!values.length) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

async function tableExists(client, tableName) {
  const { rows } = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
    ) AS exists
  `, [tableName])

  return Boolean(rows?.[0]?.exists)
}

function buildObservationRow(scoredRecord) {
  return {
    game_id: scoredRecord.match.game.id,
    edition_id: null,
    condition: scoredRecord.normalized_condition,
    price: Number(scoredRecord.price_amount),
    currency: scoredRecord.price_currency,
    observed_at: scoredRecord.sold_at,
    source_name: scoredRecord.source_name,
    source_record_id: null,
    listing_reference: scoredRecord.listing_reference || scoredRecord.id,
    listing_url: scoredRecord.listing_url,
    confidence: Number(scoredRecord.confidence_score || 0),
    is_verified: scoredRecord.is_verified_sale ? 1 : 0,
    raw_payload: JSON.stringify({
      contract_version: scoredRecord.contract_version,
      score_breakdown: scoredRecord.score_breakdown,
      normalized_region: scoredRecord.normalized_region,
      normalized_platform: scoredRecord.normalized_platform,
      rejection_reasons: scoredRecord.rejection_reasons,
      aggregate_blocks: scoredRecord.aggregate_blocks,
      raw_payload: scoredRecord.raw_payload,
    }),
  }
}

function computeTrendSignal(rows = []) {
  const now = Date.now()
  const last7 = rows.filter((row) => Date.parse(row.observed_at) >= now - (7 * 86400000))
  const last30 = rows.filter((row) => Date.parse(row.observed_at) >= now - (30 * 86400000))
  const avg = (collection) => collection.length
    ? collection.reduce((sum, row) => sum + Number(row.price || 0), 0) / collection.length
    : null
  const avg7 = avg(last7)
  const avg30 = avg(last30)

  if (!avg7 || !avg30) return 'stable'
  if (avg7 > avg30 * 1.05) return 'up'
  if (avg7 < avg30 * 0.95) return 'down'
  return 'stable'
}

function buildSnapshotRow(gameId, observationRows = [], computedAt = new Date().toISOString()) {
  const byCondition = {
    Loose: [],
    CIB: [],
    Mint: [],
  }

  for (const row of observationRows) {
    if (byCondition[row.condition]) {
      byCondition[row.condition].push(Number(row.price))
    }
  }

  const confidenceValues = observationRows
    .map((row) => Number(row.confidence))
    .filter((value) => Number.isFinite(value))

  return {
    game_id: gameId,
    loose_price: median(byCondition.Loose),
    cib_price: median(byCondition.CIB),
    mint_price: median(byCondition.Mint),
    observation_count: observationRows.length,
    last_observed_at: observationRows
      .map((row) => row.observed_at)
      .filter(Boolean)
      .sort((left, right) => String(right).localeCompare(String(left)))[0] || null,
    trend_signal: computeTrendSignal(observationRows),
    confidence_score: confidenceValues.length
      ? Number((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length).toFixed(4))
      : 0,
    source_coverage: new Set(observationRows.map((row) => row.source_name).filter(Boolean)).size,
    computed_at: computedAt,
  }
}

function buildMarketPublishPayload(scoredRecords = [], options = {}) {
  const computedAt = options.computedAt || new Date().toISOString()
  const acceptedRaw = scoredRecords.filter((record) => record.keep_raw && record.match?.game?.id)
  const includedSnapshot = scoredRecords.filter((record) => record.include_in_snapshot && record.match?.game?.id)
  const snapshotKeySet = new Set(includedSnapshot.map((record) => `${record.source_name}::${record.listing_reference || record.id}`))

  const observations = acceptedRaw.map(buildObservationRow)
  const observationsByGame = new Map()
  for (const row of observations.filter((row) => snapshotKeySet.has(`${row.source_name}::${row.listing_reference}`))) {
    if (!observationsByGame.has(row.game_id)) observationsByGame.set(row.game_id, [])
    observationsByGame.get(row.game_id).push(row)
  }

  const snapshots = [...observationsByGame.entries()].map(([gameId, rows]) => buildSnapshotRow(gameId, rows, computedAt))

  return {
    computedAt,
    observations,
    snapshots,
    summary: {
      rawAccepted: observations.length,
      snapshots: snapshots.length,
      includedInSnapshots: includedSnapshot.length,
      rejected: scoredRecords.filter((record) => !record.keep_raw).length,
    },
  }
}

async function publishMarketSnapshot(client, payload, options = {}) {
  const apply = Boolean(options.apply)
  const snapshotTableExists = await tableExists(client, 'market_snapshots')
  const observationsTableExists = await tableExists(client, 'price_observations')

  const result = {
    apply,
    snapshotTableExists,
    observationsTableExists,
    observationRows: payload.observations.length,
    snapshotRows: payload.snapshots.length,
    writtenObservations: 0,
    writtenSnapshots: 0,
  }

  if (!apply) {
    return result
  }

  if (observationsTableExists) {
    for (const row of payload.observations) {
      await client.query(`
        INSERT INTO public.price_observations (
          game_id, edition_id, condition, price, currency, observed_at,
          source_name, source_record_id, listing_reference, listing_url,
          confidence, is_verified, raw_payload
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
        ON CONFLICT (source_name, listing_reference) DO UPDATE SET
          condition = EXCLUDED.condition,
          price = EXCLUDED.price,
          currency = EXCLUDED.currency,
          observed_at = EXCLUDED.observed_at,
          listing_url = EXCLUDED.listing_url,
          confidence = EXCLUDED.confidence,
          is_verified = EXCLUDED.is_verified,
          raw_payload = EXCLUDED.raw_payload
      `, [
        row.game_id,
        row.edition_id,
        row.condition,
        row.price,
        row.currency,
        row.observed_at,
        row.source_name,
        row.source_record_id,
        row.listing_reference,
        row.listing_url,
        row.confidence,
        row.is_verified,
        row.raw_payload,
      ])
      result.writtenObservations += 1
    }
  }

  if (snapshotTableExists) {
    for (const row of payload.snapshots) {
      await client.query(`
        INSERT INTO public.market_snapshots (
          game_id, loose_price, cib_price, mint_price, observation_count,
          last_observed_at, trend_signal, confidence_score, source_coverage, computed_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (game_id) DO UPDATE SET
          loose_price = EXCLUDED.loose_price,
          cib_price = EXCLUDED.cib_price,
          mint_price = EXCLUDED.mint_price,
          observation_count = EXCLUDED.observation_count,
          last_observed_at = EXCLUDED.last_observed_at,
          trend_signal = EXCLUDED.trend_signal,
          confidence_score = EXCLUDED.confidence_score,
          source_coverage = EXCLUDED.source_coverage,
          computed_at = EXCLUDED.computed_at
      `, [
        row.game_id,
        row.loose_price,
        row.cib_price,
        row.mint_price,
        row.observation_count,
        row.last_observed_at,
        row.trend_signal,
        row.confidence_score,
        row.source_coverage,
        row.computed_at,
      ])
      result.writtenSnapshots += 1
    }
  }

  return result
}

module.exports = {
  buildMarketPublishPayload,
  buildObservationRow,
  buildSnapshotRow,
  publishMarketSnapshot,
}
