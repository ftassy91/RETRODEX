'use strict'

const { Router } = require('express')

const { handleAsync } = require('../../helpers/query')
const { resolveRequestCollectionScope } = require('../../middleware/auth')
const {
  normalizeCollectionListType,
  parseCollectionCreatePayload,
  parseCollectionPatchPayload,
  listCollectionItems,
  listPublicCollectionItems,
  createCollectionItem,
  updateCollectionItem,
  deleteCollectionItem,
} = require('../../services/public-collection-service')

const router = Router()

function parseListTypeQuery(req) {
  const rawListType = req.query?.list_type
  if (!rawListType) {
    return null
  }

  const listType = normalizeCollectionListType(rawListType)
  if (!listType) {
    const error = new Error('list_type must be one of owned, wanted or for_sale')
    error.statusCode = 400
    throw error
  }

  return listType
}

async function runCollectionOperation(res, operation) {
  try {
    return await operation()
  } catch (error) {
    if (error?.statusCode) {
      res.status(error.statusCode).json({
        ok: false,
        error: error.message,
      })
      return null
    }

    throw error
  }
}

router.get('/collection', handleAsync(async (req, res) => {
  const items = await listCollectionItems({
    ...resolveRequestCollectionScope(req),
    listType: parseListTypeQuery(req),
  })

  return res.json(items)
}))

router.post('/collection', handleAsync(async (req, res) => {
  const parsed = parseCollectionCreatePayload(req.body)
  if (!parsed.ok) {
    return res.status(400).json({ ok: false, error: parsed.error })
  }

  const item = await runCollectionOperation(res, () => createCollectionItem({
    ...resolveRequestCollectionScope(req),
    body: req.body,
  }))
  if (!item) {
    return
  }

  return res.status(201).json(item)
}))

router.delete('/collection/:id', handleAsync(async (req, res) => {
  const deleted = await runCollectionOperation(res, () => deleteCollectionItem({
    ...resolveRequestCollectionScope(req),
    gameId: req.params.id,
  }))
  if (!deleted) {
    return
  }

  return res.json({ ok: true })
}))

router.get('/api/collection', handleAsync(async (req, res) => {
  const items = await listCollectionItems({
    ...resolveRequestCollectionScope(req),
    listType: parseListTypeQuery(req),
  })

  return res.json({
    items,
    total: items.length,
  })
}))

router.post('/api/collection', handleAsync(async (req, res) => {
  const parsed = parseCollectionCreatePayload(req.body)
  if (!parsed.ok) {
    return res.status(400).json({ ok: false, error: parsed.error })
  }

  const item = await runCollectionOperation(res, () => createCollectionItem({
    ...resolveRequestCollectionScope(req),
    body: req.body,
  }))
  if (!item) {
    return
  }

  return res.status(201).json({
    ok: true,
    item,
  })
}))

router.delete('/api/collection/:id', handleAsync(async (req, res) => {
  const deleted = await runCollectionOperation(res, () => deleteCollectionItem({
    ...resolveRequestCollectionScope(req),
    gameId: req.params.id,
  }))
  if (!deleted) {
    return
  }

  return res.json(deleted)
}))

router.patch('/api/collection/:id', handleAsync(async (req, res) => {
  const parsed = parseCollectionPatchPayload(req.body)
  if (!parsed.ok) {
    return res.status(400).json({ ok: false, error: parsed.error })
  }

  const item = await runCollectionOperation(res, () => updateCollectionItem({
    ...resolveRequestCollectionScope(req),
    gameId: req.params.id,
    body: req.body,
  }))
  if (!item) {
    return
  }

  return res.json({
    ok: true,
    item,
  })
}))

router.get('/api/collection/public', handleAsync(async (_req, res) => {
  const items = await listPublicCollectionItems()

  return res.json({
    ok: true,
    items,
    count: items.length,
  })
}))

module.exports = router
