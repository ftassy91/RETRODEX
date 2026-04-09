'use strict'

const {
  BUNDLE_KEYWORDS,
  JP_BUNDLE_REGEX,
  PUBLISHABLE_CONDITIONS,
  REJECTION_KEYWORDS,
  SALE_TYPES,
  SUPPORTED_CURRENCIES,
} = require('./constants')

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function includesKeyword(title, keywords) {
  const normalizedTitle = normalizeText(title)
  return keywords.some((keyword) => normalizedTitle.includes(normalizeText(keyword)))
}

function detectRejectionReasons(rawRecord, normalizedRecord = {}) {
  const reasons = []
  const title = normalizeText(rawRecord.title_raw)
  const currency = String(rawRecord.currency || rawRecord.price_currency || '').trim().toUpperCase()
  const saleType = String(rawRecord.sale_type || '').trim()
  const priceOriginal = Number(rawRecord.price_original ?? rawRecord.price_amount)

  if (!rawRecord.is_real_sale) reasons.push('not_real_sale')
  if (!title) reasons.push('missing_title')
  if (!Number.isFinite(priceOriginal) || priceOriginal <= 0) reasons.push('invalid_price')
  if (!rawRecord.sold_at) reasons.push('missing_sold_at')
  if (!SALE_TYPES.has(saleType)) reasons.push('invalid_sale_type')
  if (!SUPPORTED_CURRENCIES.has(currency)) reasons.push('unsupported_currency')
  if (includesKeyword(title, REJECTION_KEYWORDS)) reasons.push('non_game_or_repro_listing')
  if (includesKeyword(title, BUNDLE_KEYWORDS)) reasons.push('bundle_or_lot_listing')
  // Japanese bundle detection — run on raw title (CJK stripped by normalizeText)
  if (JP_BUNDLE_REGEX.test(String(rawRecord.title_raw || ''))) reasons.push('bundle_or_lot_listing')
  if (!normalizedRecord.matchableTitle) reasons.push('unmatchable_title')

  return Array.from(new Set(reasons))
}

function detectAggregateBlocks(rawRecord, normalizedRecord = {}) {
  const blocks = []

  if (!PUBLISHABLE_CONDITIONS.has(normalizedRecord.condition)) {
    blocks.push('unclassified_condition')
  }

  if (!Number.isFinite(Number(rawRecord.price_eur)) || Number(rawRecord.price_eur) <= 0) {
    blocks.push('missing_price_eur')
  }

  if (!normalizedRecord.region || normalizedRecord.region === 'unknown') {
    blocks.push('unknown_region')
  }

  return blocks
}

module.exports = {
  detectAggregateBlocks,
  detectRejectionReasons,
}
