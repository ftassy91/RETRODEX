'use strict'
// REFACTOR PLAN: Split this 835-line file into 3 modules:
//
// 1. routes/collection/helpers.js (lines 23-266: constants + pure functions + DB utilities)
//    - VALID_COLLECTION_CONDITIONS, VALID_COLLECTION_LIST_TYPES constants
//    - normalizePriceThreshold, normalizeCollectionCondition, normalizeCollectionListType
//    - normalizePricePaid, normalizeCollectionPayload, hasOwnField, toPriceNumber
//    - getItemConditionValue, serializeCollectionItem, toCollectionGamePayload
//    - enrichCollectionItems, supabaseConditionFromApi, apiConditionFromSupabase
//    - serializeSupabaseCollectionItem, buildSupabaseCollectionPayload
//    - fetchSupabaseGamesMap, fetchSupabaseCollectionRows, fetchSupabaseCollectionItem
//    - listSupabaseCollectionItems, fetchSupabaseGame, ensureCollectionColumns
//    - GAME_INCLUDE, listCollectionItems
//
// 2. routes/collection/crud.js (lines 392-722: CRUD endpoints — GET/POST/DELETE/PATCH)
//    - GET    /collection              (legacy Sequelize list)
//    - POST   /collection              (legacy Sequelize add)
//    - DELETE /collection/:id          (legacy Sequelize remove)
//    - GET    /api/collection           (Supabase-aware list)
//    - POST   /api/collection           (Supabase-aware add, with Sequelize fallback)
//    - DELETE /api/collection/:id       (Supabase-aware remove)
//    - PATCH  /api/collection/:id       (Supabase-aware update)
//
// 3. routes/collection/extras.js (lines 724-833: public list + stats)
//    - GET  /api/collection/public  (for_sale items, public-facing)
//    - GET  /api/collection/stats   (owned items valuation + breakdown)
//
// Entry point: routes/collection/index.js — creates Router, mounts sub-routers
//
// Shared helpers needed (extract to helpers.js):
//   normalizeCollectionCondition, normalizeCollectionListType,
//   normalizePricePaid, normalizePriceThreshold, normalizeCollectionPayload,
//   hasOwnField, toPriceNumber, getItemConditionValue,
//   serializeCollectionItem, toCollectionGamePayload, enrichCollectionItems,
//   supabaseConditionFromApi, apiConditionFromSupabase,
//   serializeSupabaseCollectionItem, buildSupabaseCollectionPayload,
//   fetchSupabaseGamesMap, fetchSupabaseCollectionRows, fetchSupabaseCollectionItem,
//   listSupabaseCollectionItems, fetchSupabaseGame, ensureCollectionColumns,
//   GAME_INCLUDE, listCollectionItems, VALID_COLLECTION_CONDITIONS, VALID_COLLECTION_LIST_TYPES
//
// Dependencies: db_supabase (db, mode), models/Game, models/CollectionItem,
//   helpers/query (handleAsync), services/game-read-service (getHydratedGameById, getHydratedGamesByIds)
//
// Risk: MEDIUM — dual-backend pattern (Sequelize fallback vs Supabase) makes
//   extraction tricky. The `mode` check from db_supabase is scattered across
//   POST /api/collection, DELETE /api/collection/:id, and PATCH /api/collection/:id.
//   Validation logic is duplicated between legacy /collection and /api/collection routes.
//   Consider consolidating the Sequelize fallback before or during the split.
//
// Suggested migration order:
//   Step 1: Extract helpers.js (all normalize*, serialize*, fetch* functions)
//   Step 2: Extract extras.js (public + stats — simplest, read-only)
//   Step 3: Extract crud.js (bulk of the file, most complex)
//   Step 4: Replace collection.js with index.js that mounts sub-routers
//
// SYNC: A4 - migre le 2026-03-23 - routes /api/collection lues via Supabase
// Décision source : SYNC.md § A4

const { Router } = require('express')
const { DataTypes } = require('sequelize')
const Game = require('../models/Game')
const CollectionItem = require('../models/CollectionItem')
process.env.SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPERDATA_Project_URL
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPERDATA_SERVICE_KEY
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPERDATA_Anon_Key
const { db } = require('../../db_supabase')
const { handleAsync } = require('../helpers/query')
const {
  getHydratedGameById,
  getHydratedGamesByIds,
} = require('../services/game-read-service')

const router = Router()

const VALID_COLLECTION_CONDITIONS = new Set(['Loose', 'CIB', 'Mint'])
const VALID_COLLECTION_LIST_TYPES = new Set(['owned', 'wanted', 'for_sale'])
let collectionSchemaReady = false

function normalizePriceThreshold(value) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : Number.NaN
}

async function ensureCollectionColumns() {
  if (collectionSchemaReady) {
    return
  }

  const queryInterface = CollectionItem.sequelize.getQueryInterface()
  const columns = await queryInterface.describeTable('collection_items').catch(() => null)
  if (!columns) {
    collectionSchemaReady = true
    return
  }

  const missingColumns = [
    ['purchase_date', { type: DataTypes.DATEONLY, allowNull: true }],
    ['personal_note', { type: DataTypes.TEXT, allowNull: true }],
    ['price_threshold', { type: DataTypes.FLOAT, allowNull: true }],
  ].filter(([name]) => !columns[name])

  for (const [name, definition] of missingColumns) {
    await queryInterface.addColumn('collection_items', name, definition)
  }

  collectionSchemaReady = true
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

function normalizeCollectionListType(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) {
    return 'owned'
  }

  return VALID_COLLECTION_LIST_TYPES.has(raw) ? raw : null
}

function normalizePricePaid(value) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : Number.NaN
}

function normalizeCollectionPayload(body) {
  const gameId = String(body?.gameId ?? '').trim()
  const condition = normalizeCollectionCondition(body?.condition)
  const notes = String(body?.notes ?? '').trim()
  const list_type = normalizeCollectionListType(body?.list_type)
  const price_paid = normalizePricePaid(body?.price_paid)
  const price_threshold = normalizePriceThreshold(body?.price_threshold)
  const purchase_date = body?.purchase_date ? String(body.purchase_date).trim() : null
  const personal_note = String(body?.personal_note ?? '').trim()

  return {
    gameId,
    condition,
    notes: notes || null,
    list_type,
    price_paid,
    price_threshold,
    purchase_date: purchase_date || null,
    personal_note: personal_note || null,
  }
}

function hasOwnField(body, field) {
  return Object.prototype.hasOwnProperty.call(body || {}, field)
}

function toPriceNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function getItemConditionValue(item) {
  const condition = normalizeCollectionCondition(item?.condition)
  const game = item?.game

  if (!game) {
    return 0
  }

  if (condition === 'CIB') {
    return toPriceNumber(game.cibPrice)
  }

  if (condition === 'Mint') {
    return toPriceNumber(game.mintPrice)
  }

  return toPriceNumber(game.loosePrice)
}

function serializeCollectionItem(item) {
  const condition = normalizeCollectionCondition(item?.condition) || 'Loose'

  return {
    id: item?.gameId,
    gameId: item?.gameId,
    condition,
    notes: item?.notes || null,
    list_type: normalizeCollectionListType(item?.list_type) || 'owned',
    price_paid: item?.price_paid ?? null,
    price_threshold: item?.price_threshold ?? null,
    purchase_date: item?.purchase_date || null,
    personal_note: item?.personal_note || null,
    addedAt: item?.addedAt || null,
    game: toCollectionGamePayload(item?.game),
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
    rarity: game.rarity,
    metascore: game.metascore ?? null,
    summary: game.summary || game.synopsis || null,
    loosePrice: game.loosePrice ?? game.loose_price ?? null,
    cibPrice: game.cibPrice ?? game.cib_price ?? null,
    mintPrice: game.mintPrice ?? game.mint_price ?? null,
    quality: game.quality || null,
    market: game.market || null,
  }
}

async function enrichCollectionItems(items) {
  const plainItems = (items || []).map((item) => (
    typeof item?.get === 'function' ? item.get({ plain: true }) : item
  ))
  const gameIds = plainItems
    .map((item) => item?.gameId || item?.game_id || item?.id)
    .filter(Boolean)
  const hydratedGames = await getHydratedGamesByIds(gameIds, {
    preserveOrder: false,
  })
  const gamesById = new Map(hydratedGames.map((game) => [String(game.id), game]))

  return plainItems.map((item) => {
    const gameId = item?.gameId || item?.game_id || item?.id
    return {
      ...item,
      game: gamesById.get(String(gameId)) || item?.game || null,
    }
  })
}

function supabaseConditionFromApi(value) {
  const condition = normalizeCollectionCondition(value)

  if (condition === 'CIB') return 'cib'
  if (condition === 'Mint') return 'mint'
  return 'loose'
}

function apiConditionFromSupabase(value) {
  const normalized = String(value || '').trim().toLowerCase()

  if (normalized === 'cib') return 'CIB'
  if (normalized === 'mint') return 'Mint'
  return 'Loose'
}

function serializeSupabaseCollectionItem(item, game) {
  return {
    id: item?.game_id,
    gameId: item?.game_id,
    condition: apiConditionFromSupabase(item?.condition),
    notes: item?.notes || null,
    list_type: item?.wishlist ? 'wanted' : 'owned',
    price_paid: item?.price_paid ?? null,
    price_threshold: null,
    purchase_date: item?.date_acquired || null,
    personal_note: null,
    addedAt: item?.created_at || null,
    game: game ? {
      id: game.id,
      title: game.title,
      console: game.console,
      platform: game.console,
      year: game.year,
      coverImage: game.cover_url || null,
      image: game.image || null,
      rarity: game.rarity,
      loosePrice: game.loosePrice ?? game.loose_price ?? null,
      cibPrice: game.cibPrice ?? game.cib_price ?? null,
      mintPrice: game.mintPrice ?? game.mint_price ?? null,
    } : null,
  }
}

async function fetchSupabaseGamesMap(gameIds) {
  const uniqueIds = [...new Set((gameIds || []).filter(Boolean))]
  if (!uniqueIds.length) {
    return new Map()
  }

  const { data, error } = await db
    .from('games')
    .select('id,title,console,year,rarity,cover_url,loose_price,cib_price,mint_price')
    .in('id', uniqueIds)

  if (error) {
    throw new Error(error.message)
  }

  return new Map((data || []).map((game) => [game.id, game]))
}

async function fetchSupabaseCollectionRows() {
  const { data, error } = await db
    .from('collection_items')
    .select('id,game_id,user_session,condition,price_paid,date_acquired,notes,wishlist,created_at,updated_at')
    .eq('user_session', 'local')

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

async function fetchSupabaseCollectionItem(gameId) {
  const { data, error } = await db
    .from('collection_items')
    .select('id,game_id,user_session,condition,price_paid,date_acquired,notes,wishlist,created_at,updated_at')
    .eq('user_session', 'local')
    .eq('game_id', gameId)
    .limit(1)

  if (error) {
    throw new Error(error.message)
  }

  return Array.isArray(data) ? (data[0] || null) : null
}

async function listSupabaseCollectionItems(listType = null) {
  // Fallback to Sequelize if Supabase JS client is unavailable
  const { mode } = require('../../db_supabase')
  if (mode !== 'supabase') {
    const where = {}
    if (listType) where.list_type = listType
    const items = await CollectionItem.findAll({
      where,
      include: [{
        model: Game,
        as: 'game',
        attributes: ['id', 'title', 'console', 'rarity', 'loosePrice', 'cibPrice', 'mintPrice', 'cover_url'],
      }],
      order: [['addedAt', 'DESC']],
    })
    const enrichedItems = await enrichCollectionItems(items)
    return enrichedItems.map((item) => serializeCollectionItem(item))
  }

  const rows = await fetchSupabaseCollectionRows()
  const filteredRows = rows.filter((row) => {
    if (!listType) {
      return true
    }

    if (listType === 'wanted') {
      return Boolean(row.wishlist)
    }

    if (listType === 'owned') {
      return !row.wishlist
    }

    if (listType === 'for_sale') {
      return false
    }

    return true
  })

  const gamesMap = await fetchSupabaseGamesMap(filteredRows.map((row) => row.game_id))

  return filteredRows
    .map((row) => serializeSupabaseCollectionItem(row, gamesMap.get(row.game_id) || null))
    .sort((left, right) => String(left.game?.title || left.gameId || '').localeCompare(String(right.game?.title || right.gameId || '')))
}

async function fetchSupabaseGame(gameId) {
  const { data, error } = await db
    .from('games')
    .select('id,title,console,year,rarity,loose_price,cib_price,mint_price')
    .eq('id', gameId)
    .eq('type', 'game')
    .limit(1)

  if (error) {
    throw new Error(error.message)
  }

  return Array.isArray(data) ? (data[0] || null) : null
}

function buildSupabaseCollectionPayload(payload) {
  return {
    game_id: payload.gameId,
    user_session: 'local',
    condition: supabaseConditionFromApi(payload.condition),
    price_paid: payload.price_paid,
    date_acquired: payload.purchase_date,
    notes: payload.notes || payload.personal_note || null,
    wishlist: payload.list_type === 'wanted',
  }
}

const GAME_INCLUDE = [{
  model: Game,
  as: 'game',
  attributes: ['id', 'title', 'console', 'year', 'rarity', 'loosePrice', 'cibPrice', 'mintPrice'],
}]

async function listCollectionItems(listType) {
  await ensureCollectionColumns()
  const where = listType ? { list_type: listType } : undefined

  const items = await CollectionItem.findAll({
    where,
    include: GAME_INCLUDE,
    order: [['gameId', 'ASC']],
  })
  const enrichedItems = await enrichCollectionItems(items)

  return enrichedItems
    .map(serializeCollectionItem)
    .sort((left, right) => String(left.game?.title || left.gameId || '').localeCompare(String(right.game?.title || right.gameId || '')))
}

router.get('/collection', handleAsync(async (req, res) => {
  const listType = req.query?.list_type ? normalizeCollectionListType(req.query.list_type) : null
  if (req.query?.list_type && !listType) {
    return res.status(400).json({ ok: false, error: 'list_type must be one of owned, wanted or for_sale' })
  }

  const items = await listCollectionItems(listType)
  return res.json(items)
}))

router.post('/collection', handleAsync(async (req, res) => {
  await ensureCollectionColumns()
  const payload = normalizeCollectionPayload(req.body)

  if (!payload.gameId) {
    return res.status(400).json({ ok: false, error: 'gameId is required' })
  }

  if (!VALID_COLLECTION_CONDITIONS.has(payload.condition)) {
    return res.status(400).json({ ok: false, error: 'condition must be one of Loose, CIB or Mint' })
  }

  if (!VALID_COLLECTION_LIST_TYPES.has(payload.list_type)) {
    return res.status(400).json({ ok: false, error: 'list_type must be one of owned, wanted or for_sale' })
  }

  if (payload.price_paid !== null && (!Number.isFinite(payload.price_paid) || payload.price_paid <= 0)) {
    return res.status(400).json({ ok: false, error: 'price_paid must be a positive number' })
  }

  if (payload.price_threshold !== null && (!Number.isFinite(payload.price_threshold) || payload.price_threshold <= 0)) {
    return res.status(400).json({ ok: false, error: 'price_threshold must be a positive number' })
  }

  if (payload.purchase_date && !/^\d{4}-\d{2}-\d{2}$/.test(payload.purchase_date)) {
    return res.status(400).json({ ok: false, error: 'purchase_date must use YYYY-MM-DD' })
  }

  const game = await getHydratedGameById(payload.gameId)

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  const existing = await CollectionItem.findByPk(payload.gameId)
  if (existing) {
    return res.status(409).json({ ok: false, error: 'Game is already in your collection' })
  }

  const item = await CollectionItem.create(payload)
  const created = await CollectionItem.findByPk(item.gameId, { include: GAME_INCLUDE })
  return res.status(201).json(serializeCollectionItem(created))
}))

router.delete('/collection/:id', handleAsync(async (req, res) => {
  await ensureCollectionColumns()
  const item = await CollectionItem.findByPk(req.params.id)

  if (!item) {
    return res.status(404).json({ ok: false, error: 'Collection item not found' })
  }

  await item.destroy()
  return res.json({ ok: true, deletedId: item.gameId })
}))

router.get('/api/collection', handleAsync(async (req, res) => {
  const listType = req.query?.list_type ? normalizeCollectionListType(req.query.list_type) : null
  if (req.query?.list_type && !listType) {
    return res.status(400).json({ ok: false, error: 'list_type must be one of owned, wanted or for_sale' })
  }

  const items = await listSupabaseCollectionItems(listType)

  return res.json({
    items,
    total: items.length,
  })
}))

router.post('/api/collection', handleAsync(async (req, res) => {
  const payload = normalizeCollectionPayload(req.body)

  if (!payload.gameId) {
    return res.status(400).json({ ok: false, error: 'gameId is required' })
  }

  if (!VALID_COLLECTION_CONDITIONS.has(payload.condition)) {
    return res.status(400).json({ ok: false, error: 'condition must be one of Loose, CIB or Mint' })
  }

  if (!VALID_COLLECTION_LIST_TYPES.has(payload.list_type)) {
    return res.status(400).json({ ok: false, error: 'list_type must be one of owned, wanted or for_sale' })
  }

  if (payload.price_paid !== null && (!Number.isFinite(payload.price_paid) || payload.price_paid <= 0)) {
    return res.status(400).json({ ok: false, error: 'price_paid must be a positive number' })
  }

  if (payload.price_threshold !== null && (!Number.isFinite(payload.price_threshold) || payload.price_threshold <= 0)) {
    return res.status(400).json({ ok: false, error: 'price_threshold must be a positive number' })
  }

  if (payload.purchase_date && !/^\d{4}-\d{2}-\d{2}$/.test(payload.purchase_date)) {
    return res.status(400).json({ ok: false, error: 'purchase_date must use YYYY-MM-DD' })
  }

  const { mode } = require('../../db_supabase')
  if (mode !== 'supabase') {
    const game = await getHydratedGameById(payload.gameId)
    if (!game) {
      return res.status(404).json({ ok: false, error: 'Game not found' })
    }

    const existing = await CollectionItem.findByPk(payload.gameId)
    if (existing) {
      return res.status(409).json({ ok: false, error: 'Game is already in your collection' })
    }

    await CollectionItem.create({
      gameId: payload.gameId,
      condition: payload.condition || 'Loose',
      list_type: payload.list_type || 'owned',
      price_paid: payload.price_paid || null,
      purchase_date: payload.purchase_date || null,
      personal_note: payload.personal_note || null,
      price_threshold: payload.price_threshold || null,
      addedAt: new Date().toISOString(),
    }, {
      validate: false,
    })

    return res.json({ ok: true })
  }

  const game = await fetchSupabaseGame(payload.gameId)

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  const existing = await fetchSupabaseCollectionItem(payload.gameId)
  if (existing) {
    return res.status(409).json({ ok: false, error: 'Game is already in your collection' })
  }

  const insertPayload = buildSupabaseCollectionPayload(payload)
  const { error } = await db
    .from('collection_items')
    .insert([insertPayload])

  if (error) {
    throw new Error(error.message)
  }

  const created = await fetchSupabaseCollectionItem(payload.gameId)

  return res.status(201).json({
    ok: true,
    item: serializeSupabaseCollectionItem(created, game),
  })
}))

router.delete('/api/collection/:id', handleAsync(async (req, res) => {
  const { mode } = require('../../db_supabase')
  if (mode !== 'supabase') {
    const item = await CollectionItem.findByPk(req.params.id)
    if (!item) {
      return res.status(404).json({ ok: false, error: 'Collection item not found' })
    }

    await CollectionItem.destroy({ where: { gameId: req.params.id } })
    return res.json({ ok: true })
  }

  const item = await fetchSupabaseCollectionItem(req.params.id)

  if (!item) {
    return res.status(404).json({ ok: false, error: 'Collection item not found' })
  }

  const { error } = await db
    .from('collection_items')
    .delete()
    .eq('user_session', 'local')
    .eq('game_id', req.params.id)

  if (error) {
    throw new Error(error.message)
  }

  return res.json({ ok: true, deletedId: item.game_id })
}))

router.patch('/api/collection/:id', handleAsync(async (req, res) => {
  const { mode } = require('../../db_supabase')
  if (mode !== 'supabase') {
    const item = await CollectionItem.findByPk(req.params.id)
    if (!item) {
      return res.status(404).json({ ok: false, error: 'Collection item not found' })
    }

    const nextValues = {}

    if (hasOwnField(req.body, 'condition')) {
      const condition = normalizeCollectionCondition(req.body?.condition)
      if (!VALID_COLLECTION_CONDITIONS.has(condition)) {
        return res.status(400).json({ ok: false, error: 'condition must be one of Loose, CIB or Mint' })
      }
      nextValues.condition = condition
    }

    if (hasOwnField(req.body, 'list_type')) {
      const listType = normalizeCollectionListType(req.body?.list_type)
      if (!VALID_COLLECTION_LIST_TYPES.has(listType)) {
        return res.status(400).json({ ok: false, error: 'list_type must be one of owned, wanted or for_sale' })
      }
      nextValues.list_type = listType
    }

    if (hasOwnField(req.body, 'price_threshold')) {
      const priceThreshold = normalizePriceThreshold(req.body?.price_threshold)
      if (priceThreshold !== null && (!Number.isFinite(priceThreshold) || priceThreshold <= 0)) {
        return res.status(400).json({ ok: false, error: 'price_threshold must be a positive number' })
      }
      nextValues.price_threshold = priceThreshold
    }

    if (hasOwnField(req.body, 'price_paid')) {
      const pricePaid = normalizePricePaid(req.body?.price_paid)
      if (pricePaid !== null && (!Number.isFinite(pricePaid) || pricePaid <= 0)) {
        return res.status(400).json({ ok: false, error: 'price_paid must be a positive number' })
      }
      nextValues.price_paid = pricePaid
    }

    if (hasOwnField(req.body, 'purchase_date')) {
      const purchaseDate = req.body?.purchase_date ? String(req.body.purchase_date).trim() : null
      if (purchaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
        return res.status(400).json({ ok: false, error: 'purchase_date must use YYYY-MM-DD' })
      }
      nextValues.purchase_date = purchaseDate
    }

    if (hasOwnField(req.body, 'personal_note')) {
      nextValues.personal_note = String(req.body.personal_note ?? '').trim() || null
    }

    if (hasOwnField(req.body, 'notes')) {
      nextValues.notes = String(req.body.notes ?? '').trim() || null
    }

    await CollectionItem.update(nextValues, {
      where: { gameId: req.params.id },
      validate: false,
    })
    return res.json({ ok: true })
  }

  const item = await fetchSupabaseCollectionItem(req.params.id)
  if (!item) {
    return res.status(404).json({ ok: false, error: 'Collection item not found' })
  }

  const nextValues = {}

  if (hasOwnField(req.body, 'condition')) {
    const condition = normalizeCollectionCondition(req.body?.condition)
    if (!VALID_COLLECTION_CONDITIONS.has(condition)) {
      return res.status(400).json({ ok: false, error: 'condition must be one of Loose, CIB or Mint' })
    }
    nextValues.condition = supabaseConditionFromApi(condition)
  }

  if (hasOwnField(req.body, 'list_type')) {
    const listType = normalizeCollectionListType(req.body?.list_type)
    if (!VALID_COLLECTION_LIST_TYPES.has(listType)) {
      return res.status(400).json({ ok: false, error: 'list_type must be one of owned, wanted or for_sale' })
    }
    nextValues.wishlist = listType === 'wanted'
  }

  if (hasOwnField(req.body, 'price_threshold')) {
    const priceThreshold = normalizePriceThreshold(req.body?.price_threshold)
    if (priceThreshold !== null && (!Number.isFinite(priceThreshold) || priceThreshold <= 0)) {
      return res.status(400).json({ ok: false, error: 'price_threshold must be a positive number' })
    }
  }

  if (hasOwnField(req.body, 'price_paid')) {
    const pricePaid = normalizePricePaid(req.body?.price_paid)
    if (pricePaid !== null && (!Number.isFinite(pricePaid) || pricePaid <= 0)) {
      return res.status(400).json({ ok: false, error: 'price_paid must be a positive number' })
    }
    nextValues.price_paid = pricePaid
  }

  if (hasOwnField(req.body, 'purchase_date')) {
    const purchaseDate = req.body?.purchase_date ? String(req.body.purchase_date).trim() : null
    if (purchaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
      return res.status(400).json({ ok: false, error: 'purchase_date must use YYYY-MM-DD' })
    }
    nextValues.date_acquired = purchaseDate
  }

  if (hasOwnField(req.body, 'personal_note')) {
    nextValues.notes = String(req.body.personal_note ?? '').trim() || item.notes || null
  }

  if (hasOwnField(req.body, 'notes')) {
    nextValues.notes = String(req.body.notes ?? '').trim() || null
  }

  const { error } = await db
    .from('collection_items')
    .update(nextValues)
    .eq('user_session', 'local')
    .eq('game_id', req.params.id)

  if (error) {
    throw new Error(error.message)
  }

  const updated = await fetchSupabaseCollectionItem(req.params.id)
  const game = await fetchSupabaseGame(req.params.id)

  return res.json({
    ok: true,
    item: serializeSupabaseCollectionItem(updated, game),
  })
}))

router.get('/api/collection/public', handleAsync(async (_req, res) => {
  await ensureCollectionColumns()
  const items = await CollectionItem.findAll({
    where: {
      list_type: 'for_sale',
    },
    include: [{
      model: Game,
      as: 'game',
      attributes: ['id', 'title', 'console', 'year', 'rarity'],
    }],
    order: [['gameId', 'ASC']],
  })
  const enrichedItems = await enrichCollectionItems(items)

  const serializedItems = enrichedItems
    .map((item) => serializeCollectionItem(item))
    .sort((left, right) => String(left.game?.title || left.gameId || '').localeCompare(String(right.game?.title || right.gameId || '')))

  res.json({
    ok: true,
    items: serializedItems,
    count: serializedItems.length,
  })
}))

router.get('/api/collection/stats', handleAsync(async (_req, res) => {
  await ensureCollectionColumns()
  const items = await CollectionItem.findAll({
    where: {
      list_type: 'owned',
    },
    include: [{
      model: Game,
      as: 'game',
      attributes: ['id', 'title', 'console', 'rarity', 'loosePrice', 'cibPrice', 'mintPrice'],
    }],
    order: [['gameId', 'ASC']],
  })
  const enrichedItems = await enrichCollectionItems(items)

  const ownedItems = enrichedItems.filter((item) => item.game)
  const byPlatformMap = new Map()

  let totalLoose = 0
  let totalCib = 0
  let totalMint = 0
  let totalPaid = 0

  for (const item of ownedItems) {
    const platform = item.game.console || 'Unknown'
    const condition = normalizeCollectionCondition(item.condition)
    const resolvedValue = getItemConditionValue(item)

    if (condition === 'CIB') {
      totalCib += resolvedValue
    } else if (condition === 'Mint') {
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

  const top5 = ownedItems
    .slice()
    .sort((left, right) => toPriceNumber(right.game?.loosePrice) - toPriceNumber(left.game?.loosePrice))
    .slice(0, 5)
    .map((item) => ({
      id: item.game.id,
      title: item.game.title,
      platform: item.game.console,
      loosePrice: toPriceNumber(item.game.loosePrice),
      rarity: item.game.rarity,
    }))

  res.json({
    ok: true,
    count: ownedItems.length,
    total_loose: Math.round(totalLoose * 100) / 100,
    total_cib: Math.round(totalCib * 100) / 100,
    total_mint: Math.round(totalMint * 100) / 100,
    total_paid: Math.round(totalPaid * 100) / 100,
    profit_estimate: Math.round((totalLoose - totalPaid) * 100) / 100,
    confidence: 'mixed',
    by_platform,
    top5,
  })
}))

module.exports = router
