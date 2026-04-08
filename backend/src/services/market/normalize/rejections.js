'use strict'

const { SUPPORTED_CURRENCIES, AGGREGATE_CURRENCIES, REJECTION_KEYWORDS } = require('./constants')

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function detectRejectionReasons(rawRecord, normalizedRecord = {}) {
  const reasons = []
  const title = normalizeText(rawRecord.title_raw)
  const price = Number(rawRecord.price_amount)
  const currency = String(rawRecord.price_currency || '').toUpperCase()

  if (!title) reasons.push('missing_title')
  if (!Number.isFinite(price) || price <= 0) reasons.push('invalid_price')
  if (!rawRecord.sold_at) reasons.push('missing_sold_at')
  if (!SUPPORTED_CURRENCIES.has(currency)) reasons.push('unsupported_currency')
  if (!normalizedRecord.matchableTitle) reasons.push('unmatchable_title')

  if (REJECTION_KEYWORDS.some((keyword) => title.includes(keyword))) {
    reasons.push('accessory_or_non_game_listing')
  }

  return reasons
}

function detectAggregateBlocks(rawRecord, normalizedRecord = {}) {
  const blocks = []
  const currency = String(rawRecord.price_currency || '').toUpperCase()

  if (!AGGREGATE_CURRENCIES.has(currency)) {
    blocks.push('aggregate_currency_not_supported')
  }

  if (!['Loose', 'CIB', 'Mint'].includes(normalizedRecord.condition)) {
    blocks.push('aggregate_condition_not_supported')
  }

  return blocks
}

module.exports = {
  detectRejectionReasons,
  detectAggregateBlocks,
}
