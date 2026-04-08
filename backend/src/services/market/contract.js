'use strict'

const crypto = require('crypto')

const RAW_SOLD_RECORD_VERSION = 'market.raw-sold-record.v1'

function stableHash(value) {
  return crypto.createHash('sha1').update(String(value || ''), 'utf8').digest('hex').slice(0, 16)
}

function normalizeText(value) {
  if (value == null) return null
  const normalized = String(value).trim()
  return normalized || null
}

function normalizeNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function normalizeTimestamp(value) {
  if (value == null || value === '') return null
  const parsed = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function buildCanonicalRawSoldRecordId(input = {}) {
  const seed = [
    input.source_name || input.connector || 'unknown',
    input.listing_reference || '',
    input.listing_url || '',
    input.title_raw || '',
    input.sold_at || '',
    input.price_amount || '',
    input.price_currency || '',
  ].join('::')

  return `mrs_${stableHash(seed)}`
}

function createCanonicalRawSoldRecord(input = {}) {
  const sourceName = normalizeText(input.source_name || input.connector || 'unknown_source')
  const listingReference = normalizeText(input.listing_reference)
    || normalizeText(input.source_record_id)
    || normalizeText(input.listing_url)
  const titleRaw = normalizeText(input.title_raw)
  const priceAmount = normalizeNumber(input.price_amount)
  const priceCurrency = String(input.price_currency || 'USD').trim().toUpperCase() || 'USD'
  const soldAt = normalizeTimestamp(input.sold_at)

  if (!sourceName) throw new Error('source_name is required for canonical raw sold record')
  if (!listingReference) throw new Error('listing_reference, source_record_id, or listing_url is required')
  if (!titleRaw) throw new Error('title_raw is required')
  if (!Number.isFinite(priceAmount) || priceAmount <= 0) throw new Error('price_amount must be > 0')
  if (!soldAt) throw new Error('sold_at must be a valid date')

  return {
    contract_version: RAW_SOLD_RECORD_VERSION,
    id: buildCanonicalRawSoldRecordId({
      source_name: sourceName,
      listing_reference: listingReference,
      listing_url: input.listing_url,
      title_raw: titleRaw,
      sold_at: soldAt,
      price_amount: priceAmount,
      price_currency: priceCurrency,
    }),
    connector: normalizeText(input.connector) || sourceName,
    source_name: sourceName,
    source_type: normalizeText(input.source_type) || 'sold_listing',
    listing_reference: listingReference,
    listing_url: normalizeText(input.listing_url),
    source_record_id: normalizeText(input.source_record_id),
    title_raw: titleRaw,
    subtitle_raw: normalizeText(input.subtitle_raw),
    query_text: normalizeText(input.query_text),
    price_amount: priceAmount,
    price_currency: priceCurrency,
    shipping_amount: normalizeNumber(input.shipping_amount),
    total_amount: normalizeNumber(input.total_amount) || priceAmount,
    sold_at: soldAt,
    region_hint_raw: normalizeText(input.region_hint_raw),
    platform_hint_raw: normalizeText(input.platform_hint_raw),
    condition_hint_raw: normalizeText(input.condition_hint_raw),
    seller_country_raw: normalizeText(input.seller_country_raw),
    is_verified_sale: input.is_verified_sale === false ? false : true,
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
    && normalizeText(record.source_name)
    && normalizeText(record.listing_reference)
    && normalizeText(record.title_raw)
    && Number.isFinite(Number(record.price_amount))
    && normalizeTimestamp(record.sold_at)
  )
}

module.exports = {
  RAW_SOLD_RECORD_VERSION,
  buildCanonicalRawSoldRecordId,
  createCanonicalRawSoldRecord,
  isCanonicalRawSoldRecord,
}
