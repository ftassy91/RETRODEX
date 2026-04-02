'use strict'

const CollectionItem = require('../models/CollectionItem')
const { databaseMode } = require('../database')
const { getRuntimeDbContext } = require('./runtime-db-context')
const { getHydratedGameById, getHydratedGamesByIds } = require('./game-read-service')
const { db, isSupabase } = require('../../db_supabase')

const DEFAULT_COLLECTION_USER_ID = 'local'
const VALID_COLLECTION_CONDITIONS = new Set(['Loose', 'CIB', 'Mint'])
const VALID_COLLECTION_LIST_TYPES = new Set(['owned', 'wanted', 'for_sale'])

function useSequelizeCollectionRuntime() {
  const context = getRuntimeDbContext()
  return databaseMode === 'postgres' || (databaseMode === 'sqlite' && !context.isVercel)
}

function resolveCollectionScope(options = {}) {
  const userId = String(options.userId || DEFAULT_COLLECTION_USER_ID).trim() || DEFAULT_COLLECTION_USER_ID
  const userSession = String(options.userSession || userId).trim() || DEFAULT_COLLECTION_USER_ID

  return {
    userId,
    userSession,
  }
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

function hasOwnField(body, field) {
  return Object.prototype.hasOwnProperty.call(body || {}, field)
}

function parseCollectionCreatePayload(body = {}) {
  const payload = {
    gameId: String(body?.gameId ?? '').trim(),
    condition: normalizeCollectionCondition(body?.condition),
    notes: normalizeNullableText(body?.notes),
    listType: normalizeCollectionListType(body?.list_type),
    pricePaid: normalizeNullableNumber(body?.price_paid),
    priceThreshold: normalizeNullableNumber(body?.price_threshold),
    purchaseDate: normalizeDateOnly(body?.purchase_date),
    personalNote: normalizeNullableText(body?.personal_note),
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

  return {
    ok: true,
    value: nextValues,
  }
}

function toCollectionGamePayload(game) {
  if (!game) {
    return null
  }

  return {
    id: game.id,
    title: game.title,
    console: game.console,
    platform: game.console,
    year: game.year,
    slug: game.slug || null,
    image: game.image || null,
    coverImage: game.coverImage || game.cover_url || null,
    cover_url: game.cover_url || game.coverImage || null,
    rarity: game.rarity,
    metascore: game.metascore ?? null,
    summary: game.summary || game.synopsis || null,
    synopsis: game.synopsis || null,
    tagline: game.tagline || null,
    loosePrice: game.loosePrice ?? game.loose_price ?? null,
    cibPrice: game.cibPrice ?? game.cib_price ?? null,
    mintPrice: game.mintPrice ?? game.mint_price ?? null,
    quality: game.quality || null,
    market: game.market || null,
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
    addedAt: item?.addedAt || item?.added_at || item?.createdAt || item?.created_at || null,
    game: toCollectionGamePayload(item?.game),
  }
}

function toPlainRow(record) {
  if (!record) {
    return null
  }

  return typeof record.get === 'function' ? record.get({ plain: true }) : record
}

async function hydrateCollectionRows(rows = []) {
  const gameIds = rows
    .map((row) => row?.gameId || row?.game_id || row?.id)
    .filter(Boolean)
  const hydratedGames = await getHydratedGamesByIds(gameIds, {
    preserveOrder: false,
  })
  const gamesById = new Map(hydratedGames.map((game) => [String(game.id), game]))

  return rows.map((row) => {
    const gameId = String(row?.gameId || row?.game_id || row?.id || '')
    return {
      ...row,
      gameId,
      game: gamesById.get(gameId) || row?.game || null,
    }
  })
}

function getCollectionValueByCondition(item) {
  const game = item?.game
  if (!game) {
    return 0
  }

  const loose = Number(game.loosePrice || 0)
  const cib = Number(game.cibPrice || 0)
  const mint = Number(game.mintPrice || 0)
  const condition = normalizeStoredCollectionCondition(item?.condition)

  if (condition === 'CIB') return cib
  if (condition === 'Mint') return mint
  return loose
}

async function fetchSupabaseCollectionRows(scope, listType = null) {
  const canonicalQuery = await db
    .from('collection_items')
    .select('id,user_id,user_session,game_id,added_at,condition,notes,list_type,price_paid,purchase_date,personal_note,price_threshold,created_at,updated_at')
    .eq('user_id', scope.userId)

  if (!canonicalQuery.error) {
    const rows = Array.isArray(canonicalQuery.data) ? canonicalQuery.data : []
    if (!listType) {
      return rows
    }
    return rows.filter((row) => row.list_type === listType)
  }

  const legacyQuery = await db
    .from('collection_items')
    .select('id,game_id,user_session,condition,price_paid,date_acquired,notes,wishlist,created_at,updated_at')
    .eq('user_session', scope.userSession)

  if (legacyQuery.error) {
    throw new Error(legacyQuery.error.message)
  }

  const rows = Array.isArray(legacyQuery.data) ? legacyQuery.data : []
    .map((row) => ({
      id: row.id,
      user_id: scope.userId,
      user_session: row.user_session || scope.userSession,
      game_id: row.game_id,
      added_at: row.created_at || null,
      condition: normalizeStoredCollectionCondition(row.condition),
      notes: row.notes || null,
      list_type: row.wishlist ? 'wanted' : 'owned',
      price_paid: row.price_paid ?? null,
      purchase_date: row.date_acquired || null,
      personal_note: null,
      price_threshold: null,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
    }))

  if (!listType) {
    return rows
  }

  return rows.filter((row) => row.list_type === listType)
}

async function findSupabaseCollectionRow(scope, gameId) {
  const rows = await fetchSupabaseCollectionRows(scope, null)
  return rows.find((row) => String(row.game_id) === String(gameId)) || null
}

async function listCollectionItems(options = {}) {
  const scope = resolveCollectionScope(options)
  const listType = options.listType ? normalizeCollectionListType(options.listType) : null

  if (useSequelizeCollectionRuntime()) {
    const where = { userId: scope.userId }
    if (listType) {
      where.list_type = listType
    }

    const rows = await CollectionItem.findAll({
      where,
      order: [['gameId', 'ASC']],
    })

    const hydrated = await hydrateCollectionRows(rows.map(toPlainRow))
    return hydrated
      .map(serializeCollectionItemDto)
      .sort((left, right) => String(left.game?.title || left.gameId || '').localeCompare(String(right.game?.title || right.gameId || '')))
  }

  if (!isSupabase) {
    return []
  }

  const rows = await fetchSupabaseCollectionRows(scope, listType)
  const hydrated = await hydrateCollectionRows(rows.map((row) => ({
    ...row,
    gameId: row.game_id,
    list_type: row.list_type,
    purchase_date: row.purchase_date,
    price_paid: row.price_paid,
    price_threshold: row.price_threshold,
    personal_note: row.personal_note,
    added_at: row.added_at || row.created_at,
  })))

  return hydrated
    .map(serializeCollectionItemDto)
    .sort((left, right) => String(left.game?.title || left.gameId || '').localeCompare(String(right.game?.title || right.gameId || '')))
}

async function listPublicCollectionItems() {
  if (useSequelizeCollectionRuntime()) {
    const rows = await CollectionItem.findAll({
      where: {
        list_type: 'for_sale',
      },
      order: [['gameId', 'ASC']],
    })
    const hydrated = await hydrateCollectionRows(rows.map(toPlainRow))

    return hydrated
      .map(serializeCollectionItemDto)
      .sort((left, right) => String(left.game?.title || left.gameId || '').localeCompare(String(right.game?.title || right.gameId || '')))
  }

  return []
}

async function getCollectionItem(options = {}) {
  const scope = resolveCollectionScope(options)
  const gameId = String(options.gameId || '').trim()
  if (!gameId) {
    return null
  }

  if (useSequelizeCollectionRuntime()) {
    const row = await CollectionItem.findOne({
      where: {
        userId: scope.userId,
        gameId,
      },
    })

    if (!row) {
      return null
    }

    const hydrated = await hydrateCollectionRows([toPlainRow(row)])
    return serializeCollectionItemDto(hydrated[0])
  }

  if (!isSupabase) {
    return null
  }

  const row = await findSupabaseCollectionRow(scope, gameId)
  if (!row) {
    return null
  }

  const hydrated = await hydrateCollectionRows([{
    ...row,
    gameId: row.game_id,
  }])
  return serializeCollectionItemDto(hydrated[0])
}

async function createCollectionItem(options = {}) {
  const scope = resolveCollectionScope(options)
  const parsed = parseCollectionCreatePayload(options.body)
  if (!parsed.ok) {
    const error = new Error(parsed.error)
    error.statusCode = 400
    throw error
  }

  const payload = parsed.value
  const game = await getHydratedGameById(payload.gameId)
  if (!game) {
    const error = new Error('Game not found')
    error.statusCode = 404
    throw error
  }

  const existing = await getCollectionItem({ userId: scope.userId, userSession: scope.userSession, gameId: payload.gameId })
  if (existing) {
    const error = new Error('Game is already in your collection')
    error.statusCode = 409
    throw error
  }

  if (useSequelizeCollectionRuntime()) {
    await CollectionItem.create({
      userId: scope.userId,
      userSession: scope.userSession,
      gameId: payload.gameId,
      condition: payload.condition,
      notes: payload.notes,
      list_type: payload.listType,
      price_paid: payload.pricePaid,
      price_threshold: payload.priceThreshold,
      purchase_date: payload.purchaseDate,
      personal_note: payload.personalNote,
      addedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, {
      validate: false,
    })

    return getCollectionItem({ userId: scope.userId, userSession: scope.userSession, gameId: payload.gameId })
  }

  const canonicalInsert = await db
    .from('collection_items')
    .insert([{
      user_id: scope.userId,
      user_session: scope.userSession,
      game_id: payload.gameId,
      added_at: new Date().toISOString(),
      condition: payload.condition,
      notes: payload.notes,
      list_type: payload.listType,
      price_paid: payload.pricePaid,
      purchase_date: payload.purchaseDate,
      personal_note: payload.personalNote,
      price_threshold: payload.priceThreshold,
    }])

  if (canonicalInsert.error) {
    const legacyInsert = await db
      .from('collection_items')
      .insert([{
        game_id: payload.gameId,
        user_session: scope.userSession,
        condition: String(payload.condition || 'Loose').toLowerCase() === 'cib'
          ? 'cib'
          : String(payload.condition || 'Loose').toLowerCase() === 'mint'
            ? 'mint'
            : 'loose',
        price_paid: payload.pricePaid,
        date_acquired: payload.purchaseDate,
        notes: payload.notes || payload.personalNote || null,
        wishlist: payload.listType === 'wanted',
      }])

    if (legacyInsert.error) {
      throw new Error(legacyInsert.error.message)
    }
  }

  return getCollectionItem({ userId: scope.userId, userSession: scope.userSession, gameId: payload.gameId })
}

async function updateCollectionItem(options = {}) {
  const scope = resolveCollectionScope(options)
  const gameId = String(options.gameId || '').trim()
  const existing = await getCollectionItem({ userId: scope.userId, userSession: scope.userSession, gameId })

  if (!existing) {
    const error = new Error('Collection item not found')
    error.statusCode = 404
    throw error
  }

  const parsed = parseCollectionPatchPayload(options.body)
  if (!parsed.ok) {
    const error = new Error(parsed.error)
    error.statusCode = 400
    throw error
  }

  const nextValues = parsed.value

  if (useSequelizeCollectionRuntime()) {
    const updatePayload = {}
    if (hasOwnField(nextValues, 'condition')) updatePayload.condition = nextValues.condition
    if (hasOwnField(nextValues, 'listType')) updatePayload.list_type = nextValues.listType
    if (hasOwnField(nextValues, 'pricePaid')) updatePayload.price_paid = nextValues.pricePaid
    if (hasOwnField(nextValues, 'priceThreshold')) updatePayload.price_threshold = nextValues.priceThreshold
    if (hasOwnField(nextValues, 'purchaseDate')) updatePayload.purchase_date = nextValues.purchaseDate
    if (hasOwnField(nextValues, 'personalNote')) updatePayload.personal_note = nextValues.personalNote
    if (hasOwnField(nextValues, 'notes')) updatePayload.notes = nextValues.notes
    updatePayload.updatedAt = new Date().toISOString()

    await CollectionItem.update(updatePayload, {
      where: {
        userId: scope.userId,
        gameId,
      },
      validate: false,
    })

    return getCollectionItem({ userId: scope.userId, userSession: scope.userSession, gameId })
  }

  const canonicalPatch = {}
  if (hasOwnField(nextValues, 'condition')) canonicalPatch.condition = nextValues.condition
  if (hasOwnField(nextValues, 'listType')) canonicalPatch.list_type = nextValues.listType
  if (hasOwnField(nextValues, 'pricePaid')) canonicalPatch.price_paid = nextValues.pricePaid
  if (hasOwnField(nextValues, 'priceThreshold')) canonicalPatch.price_threshold = nextValues.priceThreshold
  if (hasOwnField(nextValues, 'purchaseDate')) canonicalPatch.purchase_date = nextValues.purchaseDate
  if (hasOwnField(nextValues, 'personalNote')) canonicalPatch.personal_note = nextValues.personalNote
  if (hasOwnField(nextValues, 'notes')) canonicalPatch.notes = nextValues.notes
  canonicalPatch.updated_at = new Date().toISOString()

  const canonicalUpdate = await db
    .from('collection_items')
    .update(canonicalPatch)
    .eq('user_id', scope.userId)
    .eq('game_id', gameId)

  if (canonicalUpdate.error) {
    const legacyPatch = {}
    if (hasOwnField(nextValues, 'condition')) {
      legacyPatch.condition = String(nextValues.condition || 'Loose').toLowerCase() === 'cib'
        ? 'cib'
        : String(nextValues.condition || 'Loose').toLowerCase() === 'mint'
          ? 'mint'
          : 'loose'
    }
    if (hasOwnField(nextValues, 'listType')) legacyPatch.wishlist = nextValues.listType === 'wanted'
    if (hasOwnField(nextValues, 'pricePaid')) legacyPatch.price_paid = nextValues.pricePaid
    if (hasOwnField(nextValues, 'purchaseDate')) legacyPatch.date_acquired = nextValues.purchaseDate
    if (hasOwnField(nextValues, 'notes')) legacyPatch.notes = nextValues.notes
    else if (hasOwnField(nextValues, 'personalNote')) legacyPatch.notes = nextValues.personalNote

    const legacyUpdate = await db
      .from('collection_items')
      .update(legacyPatch)
      .eq('user_session', scope.userSession)
      .eq('game_id', gameId)

    if (legacyUpdate.error) {
      throw new Error(legacyUpdate.error.message)
    }
  }

  return getCollectionItem({ userId: scope.userId, userSession: scope.userSession, gameId })
}

async function deleteCollectionItem(options = {}) {
  const scope = resolveCollectionScope(options)
  const gameId = String(options.gameId || '').trim()
  const existing = await getCollectionItem({ userId: scope.userId, userSession: scope.userSession, gameId })

  if (!existing) {
    const error = new Error('Collection item not found')
    error.statusCode = 404
    throw error
  }

  if (useSequelizeCollectionRuntime()) {
    await CollectionItem.destroy({
      where: {
        userId: scope.userId,
        gameId,
      },
    })

    return {
      ok: true,
      deletedId: gameId,
    }
  }

  const canonicalDelete = await db
    .from('collection_items')
    .delete()
    .eq('user_id', scope.userId)
    .eq('game_id', gameId)

  if (canonicalDelete.error) {
    const legacyDelete = await db
      .from('collection_items')
      .delete()
      .eq('user_session', scope.userSession)
      .eq('game_id', gameId)

    if (legacyDelete.error) {
      throw new Error(legacyDelete.error.message)
    }
  }

  return {
    ok: true,
    deletedId: gameId,
  }
}

async function getCollectionStats(options = {}) {
  const items = await listCollectionItems({
    ...options,
    listType: 'owned',
  })

  const byPlatformMap = new Map()
  let totalLoose = 0
  let totalCib = 0
  let totalMint = 0
  let totalPaid = 0

  for (const item of items) {
    if (!item.game) {
      continue
    }

    const platform = item.game.console || 'Unknown'
    const resolvedValue = getCollectionValueByCondition(item)

    if (item.condition === 'CIB') {
      totalCib += resolvedValue
    } else if (item.condition === 'Mint') {
      totalMint += resolvedValue
    } else {
      totalLoose += resolvedValue
    }

    totalPaid += Number(item.price_paid) || 0

    if (!byPlatformMap.has(platform)) {
      byPlatformMap.set(platform, {
        platform,
        count: 0,
        total_loose: 0,
      })
    }

    const bucket = byPlatformMap.get(platform)
    bucket.count += 1
    bucket.total_loose += resolvedValue
  }

  const by_platform = Array.from(byPlatformMap.values())
    .map((entry) => ({
      platform: entry.platform,
      count: entry.count,
      total_loose: Math.round(entry.total_loose * 100) / 100,
    }))
    .sort((left, right) => left.platform.localeCompare(right.platform))

  const top5 = items
    .slice()
    .sort((left, right) => Number(right.game?.loosePrice || 0) - Number(left.game?.loosePrice || 0))
    .slice(0, 5)
    .map((item) => ({
      id: item.game.id,
      title: item.game.title,
      platform: item.game.console,
      loosePrice: Number(item.game.loosePrice || 0),
      rarity: item.game.rarity,
    }))

  return {
    ok: true,
    count: items.length,
    total_loose: Math.round(totalLoose * 100) / 100,
    total_cib: Math.round(totalCib * 100) / 100,
    total_mint: Math.round(totalMint * 100) / 100,
    total_paid: Math.round(totalPaid * 100) / 100,
    profit_estimate: Math.round((totalLoose - totalPaid) * 100) / 100,
    confidence: 'mixed',
    by_platform,
    top5,
  }
}

async function listCollectionGameIds(options = {}) {
  const items = await listCollectionItems(options)
  return items.map((item) => item.gameId).filter(Boolean)
}

module.exports = {
  DEFAULT_COLLECTION_USER_ID,
  VALID_COLLECTION_CONDITIONS,
  VALID_COLLECTION_LIST_TYPES,
  resolveCollectionScope,
  normalizeCollectionCondition,
  normalizeCollectionListType,
  parseCollectionCreatePayload,
  parseCollectionPatchPayload,
  serializeCollectionItemDto,
  listCollectionItems,
  listPublicCollectionItems,
  listCollectionGameIds,
  getCollectionItem,
  createCollectionItem,
  updateCollectionItem,
  deleteCollectionItem,
  getCollectionStats,
}
