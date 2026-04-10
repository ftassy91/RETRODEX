'use strict'

const MARKET_BUCKETS = Object.freeze(['jp', 'us', 'eu'])
const CONDITION_VALUES = Object.freeze(['Loose', 'CIB', 'Mint'])
const PRICE_CONFIDENCE_TIERS = Object.freeze(['high', 'medium', 'low', 'unknown'])

const MARKET_SOURCE_REGISTRY = Object.freeze({
  yahoo_auctions_jp: Object.freeze({
    slug: 'yahoo_auctions_jp',
    name: 'Yahoo Auctions Japan',
    marketBucket: 'jp',
    sourceType: 'marketplace',
    reliabilityWeight: 0.9,
    defaultCurrency: 'JPY',
    complianceStatus: 'approved_with_review',
    isActive: true,
    isPrimarySoldTruth: true,
    publishEligible: true,
    notes: 'Closed/completed auction results only.',
  }),
  mercari_jp: Object.freeze({
    slug: 'mercari_jp',
    name: 'Mercari Japan',
    marketBucket: 'jp',
    sourceType: 'marketplace',
    reliabilityWeight: 0.82,
    defaultCurrency: 'JPY',
    complianceStatus: 'approved_with_review',
    isActive: true,
    isPrimarySoldTruth: true,
    publishEligible: true,
    notes: 'Sold items only.',
  }),
  rakuma: Object.freeze({
    slug: 'rakuma',
    name: 'Rakuma',
    marketBucket: 'jp',
    sourceType: 'marketplace',
    reliabilityWeight: 0.76,
    defaultCurrency: 'JPY',
    complianceStatus: 'approved_with_review',
    isActive: true,
    isPrimarySoldTruth: true,
    publishEligible: true,
    notes: 'Sold items only.',
  }),
  mercari_us: Object.freeze({
    slug: 'mercari_us',
    name: 'Mercari US',
    marketBucket: 'us',
    sourceType: 'marketplace',
    reliabilityWeight: 0.8,
    defaultCurrency: 'USD',
    complianceStatus: 'approved_with_review',
    isActive: true,
    isPrimarySoldTruth: true,
    publishEligible: true,
    notes: 'Sold items only.',
  }),
  shopgoodwill: Object.freeze({
    slug: 'shopgoodwill',
    name: 'ShopGoodwill',
    marketBucket: 'us',
    sourceType: 'auction_house',
    reliabilityWeight: 0.72,
    defaultCurrency: 'USD',
    complianceStatus: 'approved_with_review',
    isActive: true,
    isPrimarySoldTruth: true,
    publishEligible: true,
    notes: 'Closed auctions only.',
  }),
  heritage: Object.freeze({
    slug: 'heritage',
    name: 'Heritage Auctions',
    marketBucket: 'us',
    sourceType: 'auction_house',
    reliabilityWeight: 0.95,
    defaultCurrency: 'USD',
    complianceStatus: 'approved_with_review',
    isActive: true,
    isPrimarySoldTruth: true,
    publishEligible: true,
    notes: 'Realized prices only. Premium validation source.',
  }),
  catawiki: Object.freeze({
    slug: 'catawiki',
    name: 'Catawiki',
    marketBucket: 'eu',
    sourceType: 'auction_house',
    reliabilityWeight: 0.72,
    defaultCurrency: 'EUR',
    complianceStatus: 'approved_with_review',
    isActive: true,
    isPrimarySoldTruth: true,
    publishEligible: true,
    notes: 'Closed auction results only.',
  }),
  ebay: Object.freeze({
    slug: 'ebay',
    name: 'eBay',
    marketBucket: 'us',
    sourceType: 'marketplace',
    reliabilityWeight: 0.85,
    defaultCurrency: 'USD',
    complianceStatus: 'approved',
    isActive: true,
    isPrimarySoldTruth: true,
    publishEligible: true,
    notes: 'Live sold-listings connector via Jina proxy. US market bucket.',
  }),
  pricecharting_calibration: Object.freeze({
    slug: 'pricecharting_calibration',
    name: 'PriceCharting Calibration',
    marketBucket: 'us',
    sourceType: 'aggregator',
    reliabilityWeight: 0.55,
    defaultCurrency: 'USD',
    complianceStatus: 'approved_with_review',
    isActive: true,
    isPrimarySoldTruth: false,
    publishEligible: false,
    notes: 'Calibration only. Never primary sold truth.',
  }),
  collector_media_signal: Object.freeze({
    slug: 'collector_media_signal',
    name: 'Collector Media Signal',
    marketBucket: 'eu',
    sourceType: 'manual_signal',
    reliabilityWeight: 0.2,
    defaultCurrency: 'EUR',
    complianceStatus: 'reference_only',
    isActive: true,
    isPrimarySoldTruth: false,
    publishEligible: false,
    notes: 'Secondary only for anomaly detection, rarity hints, or manual review queues.',
  }),
  json_fixture: Object.freeze({
    slug: 'json_fixture',
    name: 'JSON Fixture',
    marketBucket: 'eu',
    sourceType: 'manual_signal',
    reliabilityWeight: 0.1,
    defaultCurrency: 'EUR',
    complianceStatus: 'approved',
    isActive: true,
    isPrimarySoldTruth: false,
    publishEligible: false,
    notes: 'Local fixture source for deterministic tests and dry runs.',
  }),
})

const PRICE_SOURCE_SEED_ROWS = Object.freeze(
  Object.values(MARKET_SOURCE_REGISTRY).map((source) => ({
    slug: source.slug,
    name: source.name,
    marketBucket: source.marketBucket,
    sourceType: source.sourceType,
    reliabilityWeight: source.reliabilityWeight,
    defaultCurrency: source.defaultCurrency,
    complianceStatus: source.complianceStatus,
    isActive: source.isActive,
    isPrimarySoldTruth: source.isPrimarySoldTruth,
    publishEligible: source.publishEligible,
    notes: source.notes,
  }))
)

function normalizeMarketSourceSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function getMarketSource(sourceSlug) {
  return MARKET_SOURCE_REGISTRY[normalizeMarketSourceSlug(sourceSlug)] || null
}

function listMarketSources() {
  return PRICE_SOURCE_SEED_ROWS.map((source) => ({ ...source }))
}

function getPublishEligibleSourceSlugs() {
  return PRICE_SOURCE_SEED_ROWS
    .filter((source) => source.publishEligible)
    .map((source) => source.slug)
}

function getBucketWeightMap() {
  return {
    jp: 0.333,
    us: 0.333,
    eu: 0.333,
  }
}

module.exports = {
  CONDITION_VALUES,
  MARKET_BUCKETS,
  MARKET_SOURCE_REGISTRY,
  PRICE_CONFIDENCE_TIERS,
  PRICE_SOURCE_SEED_ROWS,
  getBucketWeightMap,
  getMarketSource,
  getPublishEligibleSourceSlugs,
  listMarketSources,
  normalizeMarketSourceSlug,
}
