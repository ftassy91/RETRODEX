'use strict'

const { CONDITION_VALUES } = require('../source-registry')

function tableExists(client, tableName) {
  return client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
    ) AS exists
  `, [tableName]).then(({ rows }) => Boolean(rows?.[0]?.exists))
}

function resolveConditionFieldName(condition) {
  if (condition === 'Loose') return 'loose_price'
  if (condition === 'CIB') return 'cib_price'
  if (condition === 'Mint') return 'mint_price'
  return null
}

function buildObservationRows(scoredRecords = []) {
  return scoredRecords
    .filter((record) => record.keep_raw && record.match?.game?.id)
    .map((record) => ({
      game_id: record.match.game.id,
      price: Number(record.price_original),
      condition: record.normalized_condition,
      sale_date: record.sold_at ? String(record.sold_at).slice(0, 10) : null,
      source: record.source_name || record.source_slug,
      listing_url: record.listing_url || null,
      listing_title: record.title_raw,
      source_market: record.source_market,
      is_real_sale: record.is_real_sale === true,
      sale_type: record.sale_type,
      listing_reference: record.listing_reference,
      sold_at: record.sold_at,
      currency: record.currency,
      price_original: Number(record.price_original),
      price_eur: Number(record.price_eur),
      title_raw: record.title_raw,
      condition_normalized: record.normalized_condition,
      normalized_region: record.normalized_region,
      country_code: record.country_code || null,
      match_confidence: Number(record.match?.score || 0),
      source_confidence: Number(record.source_confidence || 0),
      payload_hash: record.payload_hash,
      raw_payload: JSON.stringify(record.raw_payload || {}),
      source_slug: record.source_slug,
    }))
}

function buildGamePriceUpdates(gameSnapshots = []) {
  return gameSnapshots.map((gameSnapshot) => {
    const pricePatch = {}

    for (const condition of CONDITION_VALUES) {
      const conditionSnapshot = gameSnapshot.conditions[condition]
      const fieldName = resolveConditionFieldName(condition)
      if (fieldName) {
        pricePatch[fieldName] = conditionSnapshot?.balancedPrice ?? null
      }
    }

    return {
      game_id: gameSnapshot.gameId,
      ...pricePatch,
      source_names: (gameSnapshot.sourceNames || []).join(', '),
      price_last_updated: gameSnapshot.latestSoldAt ? String(gameSnapshot.latestSoldAt).slice(0, 10) : null,
      price_confidence_tier: gameSnapshot.confidenceTier || 'unknown',
      price_confidence_reason: gameSnapshot.confidenceReason || null,
    }
  })
}

function buildMarketPublishPayload(marketResult = {}) {
  const scoredRecords = Array.isArray(marketResult.scoredRecords) ? marketResult.scoredRecords : []
  const gameSnapshots = Array.isArray(marketResult.gameSnapshots) ? marketResult.gameSnapshots : []

  return {
    observations: buildObservationRows(scoredRecords),
    gameUpdates: buildGamePriceUpdates(gameSnapshots),
    summary: {
      rawAccepted: scoredRecords.filter((record) => record.keep_raw && record.match?.game?.id).length,
      publishedGames: gameSnapshots.length,
    },
  }
}

async function buildSourceIdMap(client, observations = []) {
  const slugs = Array.from(new Set(observations.map((row) => row.source_slug).filter(Boolean)))
  if (!slugs.length) {
    return new Map()
  }

  const { rows } = await client.query(
    `SELECT id, slug
     FROM public.price_sources
     WHERE slug = ANY($1)`,
    [slugs]
  )

  return new Map((rows || []).map((row) => [String(row.slug), Number(row.id)]))
}

async function publishMarketSnapshot(client, payload, options = {}) {
  const apply = Boolean(options.apply)
  const result = {
    apply,
    observationRows: payload.observations.length,
    publishedGames: payload.gameUpdates.length,
    wrotePriceHistory: 0,
    wroteGames: 0,
  }

  if (!apply) {
    return result
  }

  const hasPriceHistory = await tableExists(client, 'price_history')
  const hasGames = await tableExists(client, 'games')
  result.hasPriceHistory = hasPriceHistory
  result.hasGames = hasGames

  if (hasPriceHistory) {
    const sourceIdMap = await buildSourceIdMap(client, payload.observations)
    for (const row of payload.observations) {
      await client.query(`
        INSERT INTO public.price_history (
          source_id,
          game_id,
          price,
          condition,
          sale_date,
          source,
          listing_url,
          listing_title,
          source_market,
          is_real_sale,
          sale_type,
          listing_reference,
          sold_at,
          currency,
          price_original,
          price_eur,
          title_raw,
          condition_normalized,
          normalized_region,
          country_code,
          match_confidence,
          source_confidence,
          payload_hash,
          raw_payload
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24::jsonb
        )
        ON CONFLICT (source_id, listing_reference) DO NOTHING
      `, [
        sourceIdMap.get(row.source_slug) || null,
        row.game_id,
        row.price,
        row.condition,
        row.sale_date,
        row.source,
        row.listing_url,
        row.listing_title,
        row.source_market,
        row.is_real_sale,
        row.sale_type,
        row.listing_reference,
        row.sold_at,
        row.currency,
        row.price_original,
        row.price_eur,
        row.title_raw,
        row.condition_normalized,
        row.normalized_region,
        row.country_code,
        row.match_confidence,
        row.source_confidence,
        row.payload_hash,
        row.raw_payload,
      ])
      result.wrotePriceHistory += 1
    }
  }

  if (hasGames) {
    for (const row of payload.gameUpdates) {
      await client.query(`
        UPDATE public.games
        SET loose_price = $2,
            cib_price = $3,
            mint_price = $4,
            source_names = $5,
            price_last_updated = $6,
            price_confidence_tier = $7,
            price_confidence_reason = $8
        WHERE id = $1
      `, [
        row.game_id,
        row.loose_price,
        row.cib_price,
        row.mint_price,
        row.source_names,
        row.price_last_updated,
        row.price_confidence_tier,
        row.price_confidence_reason,
      ])
      result.wroteGames += 1
    }
  }

  return result
}

module.exports = {
  buildGamePriceUpdates,
  buildMarketPublishPayload,
  buildObservationRows,
  publishMarketSnapshot,
}
