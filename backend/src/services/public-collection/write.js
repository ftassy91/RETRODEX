'use strict'

const { db, mode } = require('../../../db_supabase')
const {
  hasOwnField,
  parseCollectionCreatePayload,
  parseCollectionPatchPayload,
  resolveCollectionScope,
} = require('./core')
const {
  ensureGameExists,
  getCollectionItem,
  hasCanonicalCollectionSchema,
} = require('./storage')

function isSqliteMode() {
  return mode === 'sqlite' && db && db._sqlite
}

function toLegacyCondition(value) {
  return String(value || 'Loose').toLowerCase() === 'cib'
    ? 'cib'
    : String(value || 'Loose').toLowerCase() === 'mint'
      ? 'mint'
      : 'loose'
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
  const game = await ensureGameExists(payload.gameId)
  if (!game) {
    const error = new Error('Game not found')
    error.statusCode = 404
    throw error
  }

  const existing = await getCollectionItem({
    userId: scope.userId,
    userSession: scope.userSession,
    gameId: payload.gameId,
  })
  if (existing) {
    const error = new Error('Game is already in your collection')
    error.statusCode = 409
    throw error
  }

  const canonical = await hasCanonicalCollectionSchema()
  const now = new Date().toISOString()

  if (mode === 'supabase') {
    if (canonical) {
      const { error } = await db
        .from('collection_items')
        .insert([{
          user_id: scope.userId,
          user_session: scope.userSession,
          game_id: payload.gameId,
          added_at: now,
          condition: payload.condition,
          notes: payload.notes,
          list_type: payload.listType,
          price_paid: payload.pricePaid,
          purchase_date: payload.purchaseDate,
          personal_note: payload.personalNote,
          price_threshold: payload.priceThreshold,
        }])

      if (error) {
        throw new Error(error.message)
      }
    } else {
      const { error } = await db
        .from('collection_items')
        .insert([{
          game_id: payload.gameId,
          user_session: scope.userSession,
          condition: toLegacyCondition(payload.condition),
          price_paid: payload.pricePaid,
          date_acquired: payload.purchaseDate,
          notes: payload.notes || payload.personalNote || null,
          wishlist: payload.listType === 'wanted',
        }])

      if (error) {
        throw new Error(error.message)
      }
    }
  } else if (isSqliteMode()) {
    if (canonical) {
      db._sqlite.prepare(`
        INSERT INTO collection_items (
          user_id,user_session,game_id,added_at,condition,notes,list_type,
          price_paid,purchase_date,personal_note,price_threshold,created_at,updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        scope.userId,
        scope.userSession,
        payload.gameId,
        now,
        payload.condition,
        payload.notes,
        payload.listType,
        payload.pricePaid,
        payload.purchaseDate,
        payload.personalNote,
        payload.priceThreshold,
        now,
        now
      )
    } else {
      db._sqlite.prepare(`
        INSERT INTO collection_items (
          game_id,user_session,condition,price_paid,date_acquired,notes,wishlist,created_at,updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        payload.gameId,
        scope.userSession,
        toLegacyCondition(payload.condition),
        payload.pricePaid,
        payload.purchaseDate,
        payload.notes || payload.personalNote || null,
        payload.listType === 'wanted' ? 1 : 0,
        now,
        now
      )
    }
  }

  return getCollectionItem({
    userId: scope.userId,
    userSession: scope.userSession,
    gameId: payload.gameId,
  })
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
  const canonical = await hasCanonicalCollectionSchema()
  const now = new Date().toISOString()

  if (mode === 'supabase') {
    if (canonical) {
      const patch = { updated_at: now }
      if (hasOwnField(nextValues, 'condition')) patch.condition = nextValues.condition
      if (hasOwnField(nextValues, 'listType')) patch.list_type = nextValues.listType
      if (hasOwnField(nextValues, 'pricePaid')) patch.price_paid = nextValues.pricePaid
      if (hasOwnField(nextValues, 'priceThreshold')) patch.price_threshold = nextValues.priceThreshold
      if (hasOwnField(nextValues, 'purchaseDate')) patch.purchase_date = nextValues.purchaseDate
      if (hasOwnField(nextValues, 'personalNote')) patch.personal_note = nextValues.personalNote
      if (hasOwnField(nextValues, 'notes')) patch.notes = nextValues.notes

      const { error } = await db
        .from('collection_items')
        .update(patch)
        .eq('user_id', scope.userId)
        .eq('game_id', gameId)

      if (error) {
        throw new Error(error.message)
      }
    } else {
      const patch = {}
      if (hasOwnField(nextValues, 'condition')) patch.condition = toLegacyCondition(nextValues.condition)
      if (hasOwnField(nextValues, 'listType')) patch.wishlist = nextValues.listType === 'wanted'
      if (hasOwnField(nextValues, 'pricePaid')) patch.price_paid = nextValues.pricePaid
      if (hasOwnField(nextValues, 'purchaseDate')) patch.date_acquired = nextValues.purchaseDate
      if (hasOwnField(nextValues, 'notes')) patch.notes = nextValues.notes
      else if (hasOwnField(nextValues, 'personalNote')) patch.notes = nextValues.personalNote

      const { error } = await db
        .from('collection_items')
        .update(patch)
        .eq('user_session', scope.userSession)
        .eq('game_id', gameId)

      if (error) {
        throw new Error(error.message)
      }
    }
  } else if (isSqliteMode()) {
    if (canonical) {
      const updates = []
      const params = []
      if (hasOwnField(nextValues, 'condition')) {
        updates.push('condition = ?')
        params.push(nextValues.condition)
      }
      if (hasOwnField(nextValues, 'listType')) {
        updates.push('list_type = ?')
        params.push(nextValues.listType)
      }
      if (hasOwnField(nextValues, 'pricePaid')) {
        updates.push('price_paid = ?')
        params.push(nextValues.pricePaid)
      }
      if (hasOwnField(nextValues, 'priceThreshold')) {
        updates.push('price_threshold = ?')
        params.push(nextValues.priceThreshold)
      }
      if (hasOwnField(nextValues, 'purchaseDate')) {
        updates.push('purchase_date = ?')
        params.push(nextValues.purchaseDate)
      }
      if (hasOwnField(nextValues, 'personalNote')) {
        updates.push('personal_note = ?')
        params.push(nextValues.personalNote)
      }
      if (hasOwnField(nextValues, 'notes')) {
        updates.push('notes = ?')
        params.push(nextValues.notes)
      }
      updates.push('updated_at = ?')
      params.push(now, scope.userId, gameId)

      db._sqlite.prepare(`
        UPDATE collection_items
        SET ${updates.join(', ')}
        WHERE user_id = ? AND game_id = ?
      `).run(...params)
    } else {
      const updates = []
      const params = []
      if (hasOwnField(nextValues, 'condition')) {
        updates.push('condition = ?')
        params.push(toLegacyCondition(nextValues.condition))
      }
      if (hasOwnField(nextValues, 'listType')) {
        updates.push('wishlist = ?')
        params.push(nextValues.listType === 'wanted' ? 1 : 0)
      }
      if (hasOwnField(nextValues, 'pricePaid')) {
        updates.push('price_paid = ?')
        params.push(nextValues.pricePaid)
      }
      if (hasOwnField(nextValues, 'purchaseDate')) {
        updates.push('date_acquired = ?')
        params.push(nextValues.purchaseDate)
      }
      if (hasOwnField(nextValues, 'notes')) {
        updates.push('notes = ?')
        params.push(nextValues.notes)
      } else if (hasOwnField(nextValues, 'personalNote')) {
        updates.push('notes = ?')
        params.push(nextValues.personalNote)
      }
      updates.push('updated_at = ?')
      params.push(now, scope.userSession, gameId)

      db._sqlite.prepare(`
        UPDATE collection_items
        SET ${updates.join(', ')}
        WHERE user_session = ? AND game_id = ?
      `).run(...params)
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

  const canonical = await hasCanonicalCollectionSchema()

  if (mode === 'supabase') {
    let query = db.from('collection_items').delete()
    query = canonical
      ? query.eq('user_id', scope.userId).eq('game_id', gameId)
      : query.eq('user_session', scope.userSession).eq('game_id', gameId)

    const { error } = await query
    if (error) {
      throw new Error(error.message)
    }
  } else if (isSqliteMode()) {
    if (canonical) {
      db._sqlite.prepare('DELETE FROM collection_items WHERE user_id = ? AND game_id = ?').run(scope.userId, gameId)
    } else {
      db._sqlite.prepare('DELETE FROM collection_items WHERE user_session = ? AND game_id = ?').run(scope.userSession, gameId)
    }
  }

  return {
    ok: true,
    deletedId: gameId,
  }
}

module.exports = {
  createCollectionItem,
  updateCollectionItem,
  deleteCollectionItem,
}
