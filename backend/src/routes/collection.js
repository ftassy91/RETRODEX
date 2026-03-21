'use strict'

const { Router } = require('express')
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

  return {
    gameId,
    condition,
    notes: notes || null,
    list_type,
    price_paid,
  }
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

  const items = await listCollectionItems(listType)

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
  const item = await CollectionItem.findByPk(req.params.id)

  if (!item) {
    return res.status(404).json({ ok: false, error: 'Collection item not found' })
  }

  await item.destroy()

  return res.json({ ok: true, deletedId: item.gameId })
}))

router.get('/api/collection/public', handleAsync(async (_req, res) => {
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
    confidence: 'mixed',
    by_platform,
    top5,
  })
}))

module.exports = router
