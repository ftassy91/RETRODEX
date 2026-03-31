'use strict'

const { db, mode } = require('../../db_supabase')
const { normalizeGameRecord } = require('../lib/normalize')

const DEFAULT_COLLECTION_USER_ID = 'local'
const VALID_COLLECTION_CONDITIONS = new Set(['Loose', 'CIB', 'Mint'])
const VALID_COLLECTION_LIST_TYPES = new Set(['owned', 'wanted', 'for_sale'])

function isSqliteMode() {
  return mode === 'sqlite' && db && db._sqlite
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

function resolveCollectionScope(options = {}) {
  const userId = String(options.userId || DEFAULT_COLLECTION_USER_ID).trim() || DEFAULT_COLLECTION_USER_ID
  const userSession = String(options.userSession || userId).trim() || DEFAULT_COLLECTION_USER_ID

  return {
    userId,
    userSession,
  }
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

function isMissingSchemaError(error) {
  const message = String(error?.message || error || '').toLowerCase()
  return (
    message.includes('schema cache')
    || message.includes('does not exist')
    || message.includes('no such column')
    || message.includes('no such table')
  )
}

function sqliteHasColumn(table, column) {
  if (!isSqliteMode()) {
    return false
  }

  const pragma = db.raw(`PRAGMA table_info(${table})`)
  const rows = Array.isArray(pragma?.data) ? pragma.data : []
  return rows.some((entry) => String(entry.name || '').toLowerCase() === String(column).toLowerCase())
}

async function hasCanonicalCollectionSchema() {
  if (mode === 'supabase') {
    const probe = await db
      .from('collection_items')
      .select('user_id')
      .limit(1)

    if (!probe.error) {
      return true
    }

    if (isMissingSchemaError(probe.error)) {
      return false
    }

    throw new Error(probe.error.message)
  }

  return sqliteHasColumn('collection_items', 'user_id')
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
    addedAt: item?.addedAt || item?.added_at || item?.createdAt || item?.created_at || null,
    game: buildCollectionGamePayload(item?.game),
  }
}

function mapLegacyCollectionRow(row, scope) {
  return {
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
  }
}

async function fetchCollectionRows(scope, listType = null) {
  const canonical = await hasCanonicalCollectionSchema()

  if (mode === 'supabase') {
    if (canonical) {
      let query = db
        .from('collection_items')
        .select('id,user_id,user_session,game_id,added_at,condition,notes,list_type,price_paid,purchase_date,personal_note,price_threshold,created_at,updated_at')
        .eq('user_id', scope.userId)

      if (listType) {
        query = query.eq('list_type', listType)
      }

      const { data, error } = await query
      if (error) {
        throw new Error(error.message)
      }

      return Array.isArray(data) ? data : []
    }

    const { data, error } = await db
      .from('collection_items')
      .select('id,game_id,user_session,condition,price_paid,date_acquired,notes,wishlist,created_at,updated_at')
      .eq('user_session', scope.userSession)

    if (error) {
      throw new Error(error.message)
    }

    const rows = (data || []).map((row) => mapLegacyCollectionRow(row, scope))
    return listType ? rows.filter((row) => row.list_type === listType) : rows
  }

  if (!isSqliteMode()) {
    return []
  }

  if (canonical) {
    const params = [scope.userId]
    let sql = `
      SELECT id,user_id,user_session,game_id,added_at,condition,notes,list_type,price_paid,purchase_date,personal_note,price_threshold,created_at,updated_at
      FROM collection_items
      WHERE user_id = ?
    `

    if (listType) {
      sql += ' AND list_type = ?'
      params.push(listType)
    }

    sql += ' ORDER BY COALESCE(created_at, added_at) DESC'
    const rows = db._sqlite.prepare(sql).all(...params)
    return Array.isArray(rows) ? rows : []
  }

  const rows = db._sqlite.prepare(`
    SELECT id,game_id,user_session,condition,price_paid,date_acquired,notes,wishlist,created_at,updated_at
    FROM collection_items
    WHERE user_session = ?
    ORDER BY created_at DESC
  `).all(scope.userSession)

  const mapped = (rows || []).map((row) => mapLegacyCollectionRow(row, scope))
  return listType ? mapped.filter((row) => row.list_type === listType) : mapped
}

async function fetchGamesMap(gameIds) {
  const uniqueIds = [...new Set((gameIds || []).filter(Boolean).map((value) => String(value)))]
  if (!uniqueIds.length) {
    return new Map()
  }

  if (mode === 'supabase') {
    const { data, error } = await db
      .from('games')
      .select('*')
      .in('id', uniqueIds)

    if (error) {
      throw new Error(error.message)
    }

    return new Map((data || []).map((game) => [String(game.id), normalizeGameRecord(game)]))
  }

  if (!isSqliteMode()) {
    return new Map()
  }

  const placeholders = uniqueIds.map(() => '?').join(', ')
  const rows = db._sqlite
    .prepare(`SELECT * FROM games WHERE id IN (${placeholders})`)
    .all(...uniqueIds)

  return new Map((rows || []).map((game) => [String(game.id), normalizeGameRecord(game)]))
}

async function hydrateCollectionRows(rows = []) {
  const gameIds = rows.map((row) => String(row.game_id || row.gameId || '')).filter(Boolean)
  const gamesById = await fetchGamesMap(gameIds)

  return rows.map((row) => {
    const gameId = String(row.game_id || row.gameId || '')
    return {
      ...row,
      gameId,
      game: gamesById.get(gameId) || null,
    }
  })
}

async function getCollectionItem(options = {}) {
  const scope = resolveCollectionScope(options)
  const gameId = String(options.gameId || '').trim()
  if (!gameId) {
    return null
  }

  const rows = await fetchCollectionRows(scope)
  const match = rows.find((row) => String(row.game_id) === gameId)
  if (!match) {
    return null
  }

  const [hydrated] = await hydrateCollectionRows([match])
  return serializeCollectionItemDto(hydrated)
}

async function listCollectionItems(options = {}) {
  const scope = resolveCollectionScope(options)
  const listType = options.listType ? normalizeCollectionListType(options.listType) : null
  const rows = await fetchCollectionRows(scope, listType)
  const hydrated = await hydrateCollectionRows(rows)

  return hydrated
    .map(serializeCollectionItemDto)
    .sort((left, right) => String(left.game?.title || left.gameId || '').localeCompare(String(right.game?.title || right.gameId || ''), 'fr'))
}

async function listPublicCollectionItems() {
  return listCollectionItems({ listType: 'for_sale' })
}

async function ensureGameExists(gameId) {
  const gamesById = await fetchGamesMap([gameId])
  return gamesById.get(String(gameId)) || null
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
        String(payload.condition || 'Loose').toLowerCase() === 'cib'
          ? 'cib'
          : String(payload.condition || 'Loose').toLowerCase() === 'mint'
            ? 'mint'
            : 'loose',
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
      if (hasOwnField(nextValues, 'condition')) {
        patch.condition = String(nextValues.condition || 'Loose').toLowerCase() === 'cib'
          ? 'cib'
          : String(nextValues.condition || 'Loose').toLowerCase() === 'mint'
            ? 'mint'
            : 'loose'
      }
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
        params.push(
          String(nextValues.condition || 'Loose').toLowerCase() === 'cib'
            ? 'cib'
            : String(nextValues.condition || 'Loose').toLowerCase() === 'mint'
              ? 'mint'
              : 'loose'
        )
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

    if (item.condition === 'CIB') totalCib += resolvedValue
    else if (item.condition === 'Mint') totalMint += resolvedValue
    else totalLoose += resolvedValue

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
  getCollectionItem,
  createCollectionItem,
  updateCollectionItem,
  deleteCollectionItem,
  getCollectionStats,
}
