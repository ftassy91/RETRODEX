'use strict'

const { Router } = require('express')
const { DataTypes } = require('sequelize')
const Game = require('../models/Game')
const CollectionItem = require('../models/CollectionItem')
const { handleAsync } = require('../helpers/query')

const router = Router()

CollectionItem.belongsTo(Game, {
  foreignKey: 'gameId',
  targetKey: 'id',
  as: 'game',
})

Game.hasMany(CollectionItem, {
  foreignKey: 'gameId',
  sourceKey: 'id',
  as: 'collectionItems',
})

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
    game: item?.game ? {
      id: item.game.id,
      title: item.game.title,
      console: item.game.console,
      platform: item.game.console,
      year: item.game.year,
      image: item.game.image || null,
      rarity: item.game.rarity,
      loosePrice: item.game.loosePrice,
      cibPrice: item.game.cibPrice,
      mintPrice: item.game.mintPrice,
    } : null,
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

  return items
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

  const game = await Game.findByPk(payload.gameId)

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
  await ensureCollectionColumns()
  const listType = req.query?.list_type ? normalizeCollectionListType(req.query.list_type) : null
  if (req.query?.list_type && !listType) {
    return res.status(400).json({ ok: false, error: 'list_type must be one of owned, wanted or for_sale' })
  }

  const items = await listCollectionItems(listType)

  return res.json({
    items,
    total: items.length,
  })
}))

router.post('/api/collection', handleAsync(async (req, res) => {
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

  const game = await Game.findByPk(payload.gameId)

  if (!game) {
    return res.status(404).json({ ok: false, error: 'Game not found' })
  }

  const existing = await CollectionItem.findByPk(payload.gameId)
  if (existing) {
    return res.status(409).json({ ok: false, error: 'Game is already in your collection' })
  }

  const item = await CollectionItem.create(payload)
  const created = await CollectionItem.findByPk(item.gameId, { include: GAME_INCLUDE })

  return res.status(201).json({
    ok: true,
    item: serializeCollectionItem(created),
  })
}))

router.delete('/api/collection/:id', handleAsync(async (req, res) => {
  await ensureCollectionColumns()
  const item = await CollectionItem.findByPk(req.params.id)

  if (!item) {
    return res.status(404).json({ ok: false, error: 'Collection item not found' })
  }

  await item.destroy()

  return res.json({ ok: true, deletedId: item.gameId })
}))

router.patch('/api/collection/:id', handleAsync(async (req, res) => {
  await ensureCollectionColumns()

  const item = await CollectionItem.findByPk(req.params.id, { include: GAME_INCLUDE })
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

  Object.assign(item, nextValues)
  await item.save()

  return res.json({
    ok: true,
    item: serializeCollectionItem(item),
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

  const serializedItems = items
    .map((item) => ({
      id: item.gameId,
      gameId: item.gameId,
      condition: item.condition || 'Loose',
      notes: item.notes || null,
      list_type: item.list_type || 'for_sale',
      price_paid: item.price_paid ?? null,
      price_threshold: item.price_threshold ?? null,
      purchase_date: item.purchase_date || null,
      personal_note: item.personal_note || null,
      addedAt: item.addedAt || null,
      game: item.game ? {
        id: item.game.id,
        title: item.game.title,
        platform: item.game.console,
        console: item.game.console,
        year: item.game.year,
        rarity: item.game.rarity,
      } : null,
    }))
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

  const ownedItems = items.filter((item) => item.game)
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
