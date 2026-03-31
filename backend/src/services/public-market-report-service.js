'use strict'

const CommunityReport = require('../../models/CommunityReport')

function createValidationError(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

function validateReportPayload(body = {}) {
  const { item_id, condition, reported_price, context, date_estimated, text_raw } = body
  const normalizedItemId = String(item_id || '').trim()
  const allowedConditions = ['Loose', 'CIB', 'Mint']
  const normalizedPrice = Number(reported_price)
  const normalizedDate = date_estimated == null || date_estimated === '' ? null : String(date_estimated).trim()

  if (!normalizedItemId) {
    throw createValidationError('item_id requis')
  }

  if (!allowedConditions.includes(condition)) {
    throw createValidationError('condition invalide: Loose, CIB ou Mint attendu')
  }

  if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
    throw createValidationError('reported_price doit etre superieur a 0')
  }

  if (normalizedDate && !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    throw createValidationError('date_estimated doit etre au format YYYY-MM-DD ou null')
  }

  return {
    item_id: normalizedItemId,
    condition,
    reported_price: normalizedPrice,
    context: context || 'autre',
    date_estimated: normalizedDate,
    sale_title: text_raw || null,
    user_id: 'anonymous',
    user_trust_score: 0.40,
    is_editorial: false,
    report_confidence_score: 0.50,
  }
}

async function createMarketReport(gameId, payload = {}) {
  const normalizedPayload = validateReportPayload({
    ...payload,
    item_id: String(gameId || '').trim(),
  })
  const newReport = await CommunityReport.create(normalizedPayload)

  return {
    id: newReport.id,
  }
}

module.exports = {
  createMarketReport,
}
