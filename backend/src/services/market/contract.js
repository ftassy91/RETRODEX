'use strict'

const crypto = require('crypto')

const RAW_SOLD_RECORD_VERSION = 'market.raw-sold-record.v2'

function normalizeText(value) {
  const normalized = String(value || '').trim()
  return normalized || null
}

function normalizeNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function normalizeTimestamp(value) {
  if (value == null || value === '') {
    return null
  }

  const parsed = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function buildCanonicalRawSoldRecordId(input = {}) {
  const stableSeed = [
    input.source_slug || 'unknown',
    input.listing_reference || '',
    input.listing_url || '',
    input.title_raw || '',
    input.sold_at || '',
    input.price_original || '',
    input.currency || '',
  ].join('::')

  return `mrs_${crypto.createHash('sha1').update(stableSeed, 'utf8').digest('hex').slice(0, 16)}`
}

function createCanonicalRawSoldRecord(input = {}) {
  const sourceSlug = normalizeText(input.source_slug || input.connector)
  const sourceMarket = normalizeText(input.source_market)
  const listingReference = normalizeText(input.listing_reference || input.source_record_id || input.listing_url)
  const titleRaw = normalizeText(input.title_raw)
  const soldAt = normalizeTimestamp(input.sold_at)
  const priceOriginal = normalizeNumber(input.price_original ?? input.price_amount)
  const currency = String(input.currency || input.price_currency || '').trim().toUpperCase() || null
  const saleType = normalizeText(input.sale_type)

  if (!sourceSlug) throw new Error('source_slug is required')
  if (!sourceMarket) throw new Error('source_market is required')
  if (!listingReference) throw new Error('listing_reference, source_record_id, or listing_url is required')
  if (!titleRaw) throw new Error('title_raw is required')
  if (!Number.isFinite(priceOriginal) || priceOriginal <= 0) throw new Error('price_original must be > 0')
  if (!currency) throw new Error('currency is required')
  if (!soldAt) throw new Error('sold_at must be a valid date')
  if (!saleType) throw new Error('sale_type is required')

  return {
    contract_version: RAW_SOLD_RECORD_VERSION,
    id: buildCanonicalRawSoldRecordId({
      source_slug: sourceSlug,
      listing_reference: listingReference,
      listing_url: input.listing_url,
      title_raw: titleRaw,
      sold_at: soldAt,
      price_original: priceOriginal,
      currency,
    }),
    source_slug: sourceSlug,
    source_market: sourceMarket,
    source_name: normalizeText(input.source_name),
    source_type: normalizeText(input.source_type) || 'marketplace',
    listing_reference: listingReference,
    listing_url: normalizeText(input.listing_url),
    source_record_id: normalizeText(input.source_record_id),
    title_raw: titleRaw,
    subtitle_raw: normalizeText(input.subtitle_raw),
    query_text: normalizeText(input.query_text),
    sale_type: saleType,
    is_real_sale: input.is_real_sale === false ? false : true,
    sold_at: soldAt,
    currency,
    price_original: priceOriginal,
    country_code: normalizeText(input.country_code),
    region_hint_raw: normalizeText(input.region_hint_raw),
    platform_hint_raw: normalizeText(input.platform_hint_raw),
    condition_hint_raw: normalizeText(input.condition_hint_raw),
    seed_game_id: normalizeText(input.seed_game_id),
    raw_payload: input.raw_payload && typeof input.raw_payload === 'object'
      ? input.raw_payload
      : {},
  }
}

function isCanonicalRawSoldRecord(record) {
  return Boolean(
    record
    && record.contract_version === RAW_SOLD_RECORD_VERSION
    && normalizeText(record.source_slug)
    && normalizeText(record.source_market)
    && normalizeText(record.listing_reference)
    && normalizeText(record.title_raw)
    && Number.isFinite(Number(record.price_original))
    && normalizeTimestamp(record.sold_at)
    && normalizeText(record.currency)
    && normalizeText(record.sale_type)
  )
}

module.exports = {
  RAW_SOLD_RECORD_VERSION,
  buildCanonicalRawSoldRecordId,
  createCanonicalRawSoldRecord,
  isCanonicalRawSoldRecord,
}
