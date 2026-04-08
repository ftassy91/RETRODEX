'use strict'

const { normalizeGameRecord } = require('../../lib/normalize')

const DEFAULT_COLLECTION_USER_ID = 'local'
const VALID_COLLECTION_CONDITIONS = new Set(['Loose', 'CIB', 'Mint'])
const VALID_COLLECTION_LIST_TYPES = new Set(['owned', 'wanted', 'for_sale'])
const VALID_COLLECTION_COMPLETENESS = new Set(['unknown', 'loose', 'partial', 'cib', 'sealed'])
const VALID_COLLECTION_QUALIFICATION_CONFIDENCE = new Set(['unknown', 'low', 'medium', 'high'])
const VALID_COLLECTION_REGIONS = new Set(['PAL', 'NTSC-U', 'NTSC-J', 'NTSC-B', 'MULTI', 'unknown'])

const REGION_ALIASES = {
  pal: 'PAL',
  eu: 'PAL',
  eur: 'PAL',
  europe: 'PAL',
  'europe/australie': 'PAL',
  ntsc: 'NTSC-U',
  'ntsc-u': 'NTSC-U',
  ntsc_u: 'NTSC-U',
  us: 'NTSC-U',
  usa: 'NTSC-U',
  na: 'NTSC-U',
  'north america': 'NTSC-U',
  'amerique du nord': 'NTSC-U',
  'ntsc-j': 'NTSC-J',
  ntsc_j: 'NTSC-J',
  jp: 'NTSC-J',
  jpn: 'NTSC-J',
  japan: 'NTSC-J',
  japon: 'NTSC-J',
  'ntsc-b': 'NTSC-B',
  ntsc_b: 'NTSC-B',
  br: 'NTSC-B',
  bra: 'NTSC-B',
  brazil: 'NTSC-B',
  bresil: 'NTSC-B',
  multi: 'MULTI',
  'multi-region': 'MULTI',
  multiregion: 'MULTI',
  worldwide: 'MULTI',
  ww: 'MULTI',
  unknown: 'unknown',
  inconnu: 'unknown',
  '?': 'unknown',
}

function normalizeCollectionCondition(value) {
  const raw = String(value ?? '').trim()
  if (!raw) {
    return 'Loose'
  }

  const upper = raw.toUpperCase()
  if (upper === 'LOOSE') return 'Loose'
  if (upper === 'CIB') return 'CIB'
  if (upper === 'MINT') return 'Mint'
  return null
}

function normalizeStoredCollectionCondition(value) {
  return normalizeCollectionCondition(value) || 'Loose'
}

function normalizeCollectionListType(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) {
    return 'owned'
  }

  return VALID_COLLECTION_LIST_TYPES.has(raw) ? raw : null
}

function normalizeNullableNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : Number.NaN
}

function normalizeDateOnly(value) {
  const raw = value ? String(value).trim() : null
  return raw || null
}

function normalizeNullableText(value) {
  const raw = String(value ?? '').trim()
  return raw || null
}

function normalizeNullableShortText(value, maxLength = 32) {
  const raw = String(value ?? '').trim()
  if (!raw) {
    return null
  }

  return raw.slice(0, maxLength)
}

function normalizeCollectionCompleteness(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) {
    return null
  }

  return VALID_COLLECTION_COMPLETENESS.has(raw) ? raw : null
}

function normalizeCollectionQualificationConfidence(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) {
    return null
  }

  return VALID_COLLECTION_QUALIFICATION_CONFIDENCE.has(raw) ? raw : null
}

function normalizeCollectionRegion(value) {
  const raw = String(value ?? '').trim()
  if (!raw) {
    return null
  }

  if (VALID_COLLECTION_REGIONS.has(raw)) {
    return raw
  }

  const alias = REGION_ALIASES[raw.toLowerCase()]
  if (alias) {
    return alias
  }

  return null
}

function hasOwnField(body, field) {
  return Object.prototype.hasOwnProperty.call(body || {}, field)
}

function resolveCollectionScope(options = {}) {
  const userId = String(options.userId || DEFAULT_COLLECTION_USER_ID).trim() || DEFAULT_COLLECTION_USER_ID
  const userSession = String(options.userSession || userId).trim() || DEFAULT_COLLECTION_USER_ID

  return {
    userId,
    userSession,
  }
}

function parseCollectionCreatePayload(body = {}) {
  const listType = normalizeCollectionListType(body?.list_type)
  const payload = {
    gameId: String(body?.gameId ?? '').trim(),
    condition: normalizeCollectionCondition(body?.condition),
    notes: normalizeNullableText(body?.notes),
    listType,
    pricePaid: normalizeNullableNumber(body?.price_paid),
    priceThreshold: normalizeNullableNumber(body?.price_threshold),
    purchaseDate: normalizeDateOnly(body?.purchase_date),
    personalNote: normalizeNullableText(body?.personal_note),
    editionNote: normalizeNullableText(body?.edition_note),
    region: normalizeCollectionRegion(body?.region),
    completeness: normalizeCollectionCompleteness(body?.completeness) || (listType === 'wanted' ? null : 'unknown'),
    qualificationConfidence: normalizeCollectionQualificationConfidence(body?.qualification_confidence)
      || (listType === 'wanted' ? null : 'unknown'),
  }

  if (!payload.gameId) {
    return { ok: false, error: 'gameId is required' }
  }

  if (!VALID_COLLECTION_CONDITIONS.has(payload.condition)) {
    return { ok: false, error: 'condition must be one of Loose, CIB or Mint' }
  }

  if (!VALID_COLLECTION_LIST_TYPES.has(payload.listType)) {
    return { ok: false, error: 'list_type must be one of owned, wanted or for_sale' }
  }

  if (payload.pricePaid !== null && (!Number.isFinite(payload.pricePaid) || payload.pricePaid <= 0)) {
    return { ok: false, error: 'price_paid must be a positive number' }
  }

  if (payload.priceThreshold !== null && (!Number.isFinite(payload.priceThreshold) || payload.priceThreshold <= 0)) {
    return { ok: false, error: 'price_threshold must be a positive number' }
  }

  if (payload.purchaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(payload.purchaseDate)) {
    return { ok: false, error: 'purchase_date must use YYYY-MM-DD' }
  }

  if (body?.completeness != null && !VALID_COLLECTION_COMPLETENESS.has(payload.completeness)) {
    return { ok: false, error: 'completeness must be one of unknown, loose, partial, cib or sealed' }
  }

  if (body?.qualification_confidence != null && !VALID_COLLECTION_QUALIFICATION_CONFIDENCE.has(payload.qualificationConfidence)) {
    return { ok: false, error: 'qualification_confidence must be one of unknown, low, medium or high' }
  }

  if (body?.region != null && String(body.region).trim() && payload.region === null) {
    return { ok: false, error: 'region must be one of PAL, NTSC-U, NTSC-J, NTSC-B, MULTI or unknown' }
  }

  return { ok: true, value: payload }
}

function parseCollectionPatchPayload(body = {}) {
  const nextValues = {}

  if (hasOwnField(body, 'condition')) {
    const condition = normalizeCollectionCondition(body?.condition)
    if (!VALID_COLLECTION_CONDITIONS.has(condition)) {
      return { ok: false, error: 'condition must be one of Loose, CIB or Mint' }
    }
    nextValues.condition = condition
  }

  if (hasOwnField(body, 'list_type')) {
    const listType = normalizeCollectionListType(body?.list_type)
    if (!VALID_COLLECTION_LIST_TYPES.has(listType)) {
      return { ok: false, error: 'list_type must be one of owned, wanted or for_sale' }
    }
    nextValues.listType = listType
  }

  if (hasOwnField(body, 'price_threshold')) {
    const priceThreshold = normalizeNullableNumber(body?.price_threshold)
    if (priceThreshold !== null && (!Number.isFinite(priceThreshold) || priceThreshold <= 0)) {
      return { ok: false, error: 'price_threshold must be a positive number' }
    }
    nextValues.priceThreshold = priceThreshold
  }

  if (hasOwnField(body, 'price_paid')) {
    const pricePaid = normalizeNullableNumber(body?.price_paid)
    if (pricePaid !== null && (!Number.isFinite(pricePaid) || pricePaid <= 0)) {
      return { ok: false, error: 'price_paid must be a positive number' }
    }
    nextValues.pricePaid = pricePaid
  }

  if (hasOwnField(body, 'purchase_date')) {
    const purchaseDate = normalizeDateOnly(body?.purchase_date)
    if (purchaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
      return { ok: false, error: 'purchase_date must use YYYY-MM-DD' }
    }
    nextValues.purchaseDate = purchaseDate
  }

  if (hasOwnField(body, 'personal_note')) {
    nextValues.personalNote = normalizeNullableText(body?.personal_note)
  }

  if (hasOwnField(body, 'notes')) {
    nextValues.notes = normalizeNullableText(body?.notes)
  }

  if (hasOwnField(body, 'edition_note')) {
    nextValues.editionNote = normalizeNullableText(body?.edition_note)
  }

  if (hasOwnField(body, 'region')) {
    const region = normalizeCollectionRegion(body?.region)
    if (body?.region != null && String(body.region).trim() && region === null) {
      return { ok: false, error: 'region must be one of PAL, NTSC-U, NTSC-J, NTSC-B, MULTI or unknown' }
    }
    nextValues.region = region
  }

  if (hasOwnField(body, 'completeness')) {
    const completeness = normalizeCollectionCompleteness(body?.completeness)
    if (body?.completeness != null && body?.completeness !== '' && !VALID_COLLECTION_COMPLETENESS.has(completeness)) {
      return { ok: false, error: 'completeness must be one of unknown, loose, partial, cib or sealed' }
    }
    nextValues.completeness = completeness
  }

  if (hasOwnField(body, 'qualification_confidence')) {
    const qualificationConfidence = normalizeCollectionQualificationConfidence(body?.qualification_confidence)
    if (
      body?.qualification_confidence != null
      && body?.qualification_confidence !== ''
      && !VALID_COLLECTION_QUALIFICATION_CONFIDENCE.has(qualificationConfidence)
    ) {
      return { ok: false, error: 'qualification_confidence must be one of unknown, low, medium or high' }
    }
    nextValues.qualificationConfidence = qualificationConfidence
  }

  return {
    ok: true,
    value: nextValues,
  }
}

function buildCollectionGamePayload(game) {
  if (!game) {
    return null
  }

  const item = normalizeGameRecord(game)

  return {
    id: item.id,
    title: item.title,
    console: item.console || null,
    platform: item.console || null,
    year: item.year ?? null,
    slug: item.slug || null,
    coverImage: item.coverImage || item.cover_url || null,
    cover_url: item.cover_url || item.coverImage || null,
    rarity: item.rarity || null,
    metascore: item.metascore ?? null,
    summary: item.summary || item.synopsis || null,
    synopsis: item.synopsis || null,
    loosePrice: item.loosePrice ?? null,
    cibPrice: item.cibPrice ?? null,
    mintPrice: item.mintPrice ?? null,
  }
}

function serializeCollectionItemDto(item) {
  return {
    id: item?.gameId,
    gameId: item?.gameId,
    condition: normalizeStoredCollectionCondition(item?.condition),
    notes: item?.notes || null,
    list_type: normalizeCollectionListType(item?.listType || item?.list_type) || 'owned',
    price_paid: item?.pricePaid ?? item?.price_paid ?? null,
    price_threshold: item?.priceThreshold ?? item?.price_threshold ?? null,
    purchase_date: item?.purchaseDate || item?.purchase_date || null,
    personal_note: item?.personalNote || item?.personal_note || null,
    edition_note: item?.editionNote || item?.edition_note || null,
    region: item?.region || null,
    completeness: item?.completeness || null,
    qualification_confidence: item?.qualificationConfidence || item?.qualification_confidence || null,
    qualification_updated_at: item?.qualificationUpdatedAt || item?.qualification_updated_at || null,
    addedAt: item?.addedAt || item?.added_at || item?.createdAt || item?.created_at || null,
    game: buildCollectionGamePayload(item?.game),
  }
}

module.exports = {
  DEFAULT_COLLECTION_USER_ID,
  VALID_COLLECTION_CONDITIONS,
  VALID_COLLECTION_LIST_TYPES,
  VALID_COLLECTION_COMPLETENESS,
  VALID_COLLECTION_QUALIFICATION_CONFIDENCE,
  VALID_COLLECTION_REGIONS,
  resolveCollectionScope,
  normalizeCollectionCondition,
  normalizeStoredCollectionCondition,
  normalizeCollectionListType,
  normalizeCollectionCompleteness,
  normalizeCollectionQualificationConfidence,
  normalizeCollectionRegion,
  hasOwnField,
  parseCollectionCreatePayload,
  parseCollectionPatchPayload,
  serializeCollectionItemDto,
}
