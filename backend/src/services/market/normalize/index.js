'use strict'

const crypto = require('crypto')

const { isCanonicalRawSoldRecord } = require('../contract')
const { getMarketSource } = require('../source-registry')
const { normalizeCondition } = require('./condition')
const { DEFAULT_MARKET_FX_TO_EUR } = require('./constants')
const { normalizePlatform, normalizePlatformKey } = require('./platform')
const { normalizeRegion } = require('./region')
const { detectAggregateBlocks, detectRejectionReasons } = require('./rejections')

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokenize(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token && token.length > 1)
}

function toFiniteNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function roundPrice(value) {
  const numeric = toFiniteNumber(value)
  return numeric == null ? null : Math.round(numeric * 100) / 100
}

function normalizeTimestamp(value) {
  if (!value) {
    return null
  }

  const parsed = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function resolveFxToEur(currency, fxRates = {}) {
  const normalizedCurrency = String(currency || '').trim().toUpperCase()
  const configured = fxRates[normalizedCurrency]
  const fallback = DEFAULT_MARKET_FX_TO_EUR[normalizedCurrency]
  const rate = Number(configured ?? fallback)
  return Number.isFinite(rate) && rate > 0 ? rate : null
}

function convertToEur(priceOriginal, currency, fxRates = {}) {
  const numeric = toFiniteNumber(priceOriginal)
  if (numeric == null) {
    return null
  }

  const normalizedCurrency = String(currency || '').trim().toUpperCase()
  if (normalizedCurrency === 'EUR') {
    return roundPrice(numeric)
  }

  const rate = resolveFxToEur(normalizedCurrency, fxRates)
  if (!rate) {
    return null
  }

  return roundPrice(numeric * rate)
}

function buildPayloadHash(record) {
  const stableSeed = JSON.stringify({
    source_slug: record.source_slug,
    listing_reference: record.listing_reference,
    sold_at: record.sold_at,
    price_original: record.price_original,
    currency: record.currency,
    title_raw: record.title_raw,
  })
  return crypto.createHash('sha1').update(stableSeed, 'utf8').digest('hex')
}

function normalizeRawSoldRecord(rawRecord, options = {}) {
  if (!isCanonicalRawSoldRecord(rawRecord)) {
    throw new Error('normalizeRawSoldRecord expects a canonical raw sold record')
  }

  const sourceMeta = getMarketSource(rawRecord.source_slug)
  const conditionResult = normalizeCondition(rawRecord.title_raw, rawRecord.condition_hint_raw, { sourceMarket: rawRecord.source_market })
  const platformResult = normalizePlatform(rawRecord.title_raw, rawRecord.platform_hint_raw)
  const regionResult = normalizeRegion(rawRecord.title_raw, rawRecord.region_hint_raw, rawRecord.source_market)
  const matchableTitle = normalizeText(rawRecord.title_raw)
  const soldAt = normalizeTimestamp(rawRecord.sold_at)
  const priceOriginal = roundPrice(rawRecord.price_original)
  const priceEur = convertToEur(priceOriginal, rawRecord.currency, options.fxRates)
  const rejectionReasons = detectRejectionReasons(rawRecord, {
    condition: conditionResult.condition,
    matchableTitle,
  })
  const aggregateBlocks = detectAggregateBlocks({
    ...rawRecord,
    price_eur: priceEur,
  }, {
    condition: conditionResult.condition,
    region: regionResult.region,
  })
  const sourceConfidence = roundPrice((sourceMeta?.reliabilityWeight || 0) * 100) / 100

  return {
    ...rawRecord,
    sold_at: soldAt,
    price_original: priceOriginal,
    price_eur: priceEur,
    source_name: sourceMeta?.name || rawRecord.source_name,
    matchableTitle,
    titleTokens: tokenize(rawRecord.title_raw),
    normalized_platform: platformResult.platform,
    normalized_platform_key: normalizePlatformKey(platformResult.platform || rawRecord.platform_hint_raw || ''),
    platform_confidence: platformResult.confidence,
    normalized_region: regionResult.region,
    region_confidence: regionResult.confidence,
    normalized_condition: conditionResult.condition,
    condition_confidence: conditionResult.confidence,
    source_confidence: sourceConfidence,
    payload_hash: buildPayloadHash(rawRecord),
    rejection_reasons: rejectionReasons,
    aggregate_blocks: aggregateBlocks,
    is_rejected: rejectionReasons.length > 0,
    is_publishable: rejectionReasons.length === 0 && aggregateBlocks.length === 0,
  }
}

module.exports = {
  convertToEur,
  normalizeRawSoldRecord,
  normalizeText,
  normalizeTimestamp,
  roundPrice,
  tokenize,
}
