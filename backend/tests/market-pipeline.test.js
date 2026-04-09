'use strict'

const {
  createCanonicalRawSoldRecord,
  normalizeRawSoldRecord,
  buildScoredMarketSnapshots,
  buildMarketPublishPayload,
  buildMarketQualityReport,
} = require('../src/services/market')

function makeMatchedRecord(sourceSlug, sourceMarket, overrides = {}) {
  const rawRecord = createCanonicalRawSoldRecord({
    source_slug: sourceSlug,
    source_market: sourceMarket,
    sale_type: overrides.sale_type || 'auction',
    listing_reference: overrides.listing_reference || `${sourceSlug}-sm64-1`,
    listing_url: overrides.listing_url || `https://example.invalid/${sourceSlug}/sm64-1`,
    title_raw: overrides.title_raw || 'Super Mario 64 Nintendo 64 cart only',
    sold_at: overrides.sold_at || '2026-04-01T10:00:00.000Z',
    currency: overrides.currency || 'EUR',
    price_original: overrides.price_original || 40,
    country_code: overrides.country_code || null,
    platform_hint_raw: overrides.platform_hint_raw || 'Nintendo 64',
    region_hint_raw: overrides.region_hint_raw || null,
    condition_hint_raw: overrides.condition_hint_raw || 'cart only',
  })

  const normalized = normalizeRawSoldRecord(rawRecord, {
    fxRates: {
      USD: 0.9,
      JPY: 0.0062,
    },
  })

  return {
    ...normalized,
    match: {
      game: {
        id: 'super-mario-64-nintendo-64',
        title: 'Super Mario 64',
        console: 'Nintendo 64',
      },
      score: 0.92,
    },
  }
}

describe('market pipeline scoring', () => {
  test('builds a balanced JP/US/EU snapshot and publish payload', () => {
    const records = [
      makeMatchedRecord('yahoo_auctions_jp', 'jp', {
        currency: 'JPY',
        price_original: 6200,
        region_hint_raw: 'NTSC-J',
      }),
      makeMatchedRecord('mercari_us', 'us', {
        currency: 'USD',
        price_original: 38,
        region_hint_raw: 'NTSC-U',
      }),
      makeMatchedRecord('catawiki', 'eu', {
        currency: 'EUR',
        price_original: 47,
        region_hint_raw: 'PAL',
      }),
    ]

    const marketResult = buildScoredMarketSnapshots(records)
    const payload = buildMarketPublishPayload(marketResult)

    expect(marketResult.gameSnapshots).toHaveLength(1)
    expect(marketResult.gameSnapshots[0].conditions.Loose.representedBuckets).toBe(3)
    expect(marketResult.gameSnapshots[0].conditions.Loose.balancedPrice).toBeGreaterThan(0)
    expect(['high', 'medium', 'low']).toContain(marketResult.gameSnapshots[0].confidenceTier)

    expect(payload.observations).toHaveLength(3)
    expect(payload.gameUpdates).toHaveLength(1)
    expect(payload.gameUpdates[0].source_names).toContain('Yahoo Auctions Japan')
    expect(payload.gameUpdates[0].source_names).toContain('Mercari US')
    expect(payload.gameUpdates[0].source_names).toContain('Catawiki')
  })

  test('quality report exposes bucket and rejection visibility', () => {
    const accepted = makeMatchedRecord('mercari_us', 'us', {
      currency: 'USD',
      price_original: 30,
      region_hint_raw: 'NTSC-U',
    })
    accepted.keep_raw = true
    accepted.is_rejected = false
    accepted.confidence_tier = 'medium'
    accepted.confidence_score = 0.7
    const rejected = makeMatchedRecord('json_fixture', 'eu', {
      price_original: 30,
    })
    rejected.is_rejected = true
    rejected.keep_raw = false
    rejected.rejection_reasons = ['invalid_price']
    rejected.confidence_tier = 'unknown'
    rejected.confidence_score = 0

    const marketResult = {
      scoredRecords: [accepted, rejected],
      gameSnapshots: [],
    }

    const report = buildMarketQualityReport(marketResult, {
      pipelineName: 'market_pipeline',
      sourceScope: 'test',
    })

    expect(report.totalRows).toBe(2)
    expect(report.byBucket.us).toBe(1)
    expect(report.byBucket.eu).toBe(1)
    expect(report.rejectionReasons.invalid_price).toBe(1)
  })

  test('does not elevate mono-bucket signals to medium confidence', () => {
    const records = [
      makeMatchedRecord('mercari_us', 'us', {
        currency: 'USD',
        price_original: 31,
        listing_reference: 'mercari-us-sm64-a',
      }),
      makeMatchedRecord('mercari_us', 'us', {
        currency: 'USD',
        price_original: 34,
        listing_reference: 'mercari-us-sm64-b',
        sold_at: '2026-04-02T10:00:00.000Z',
      }),
    ]

    const marketResult = buildScoredMarketSnapshots(records)

    expect(marketResult.gameSnapshots[0].conditions.Loose.representedBuckets).toBe(1)
    expect(marketResult.gameSnapshots[0].confidenceTier).toBe('low')
  })

  test('publish payload preserves sold-truth flag from normalized records', () => {
    const record = makeMatchedRecord('catawiki', 'eu', {
      currency: 'EUR',
      price_original: 47,
      listing_reference: 'catawiki-sm64-nonsale',
    })
    record.is_real_sale = false
    record.keep_raw = true

    const payload = buildMarketPublishPayload({
      scoredRecords: [record],
      gameSnapshots: [],
    })

    expect(payload.observations).toHaveLength(1)
    expect(payload.observations[0].is_real_sale).toBe(false)
  })
})
