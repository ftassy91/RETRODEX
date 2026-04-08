'use strict'

const { db, mode } = require('../../../db_supabase')
const { normalizeGameRecord } = require('../../lib/normalize')
const {
  resolveCollectionScope,
  normalizeStoredCollectionCondition,
  serializeCollectionItemDto,
} = require('./core')

let collectionSchemaStatePromise = null

function isSqliteMode() {
  return mode === 'sqlite' && db && db._sqlite
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
  const state = await getCollectionSchemaState()
  return state.canonical
}

async function getCollectionSchemaState() {
  if (collectionSchemaStatePromise) {
    return collectionSchemaStatePromise
  }

  collectionSchemaStatePromise = detectCollectionSchemaState().catch((error) => {
    collectionSchemaStatePromise = null
    throw error
  })

  return collectionSchemaStatePromise
}

async function detectCollectionSchemaState() {
  if (mode === 'supabase') {
    const probe = await db
      .from('collection_items')
      .select('user_id')
      .limit(1)

    if (!probe.error) {
      const qualificationProbe = await db
        .from('collection_items')
        .select('edition_note')
        .limit(1)

      if (qualificationProbe.error && !isMissingSchemaError(qualificationProbe.error)) {
        throw new Error(qualificationProbe.error.message)
      }

      return {
        canonical: true,
        qualification: !qualificationProbe.error,
      }
    }

    if (isMissingSchemaError(probe.error)) {
      return {
        canonical: false,
        qualification: false,
      }
    }

    throw new Error(probe.error.message)
  }

  const canonical = sqliteHasColumn('collection_items', 'user_id')
  const qualification = canonical && sqliteHasColumn('collection_items', 'edition_note')

  return {
    canonical,
    qualification,
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
    edition_note: null,
    region: null,
    completeness: null,
    qualification_confidence: null,
    qualification_updated_at: null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  }
}

async function fetchCollectionRows(scope, listType = null) {
  const schema = await getCollectionSchemaState()
  const canonical = schema.canonical

  if (mode === 'supabase') {
    if (canonical) {
      const columns = [
        'id',
        'user_id',
        'user_session',
        'game_id',
        'added_at',
        'condition',
        'notes',
        'list_type',
        'price_paid',
        'purchase_date',
        'personal_note',
        'price_threshold',
        'created_at',
        'updated_at',
      ]

      if (schema.qualification) {
        columns.push(
          'edition_note',
          'region',
          'completeness',
          'qualification_confidence',
          'qualification_updated_at'
        )
      }

      let query = db
        .from('collection_items')
        .select(columns.join(','))
        .eq('user_id', scope.userId)

      if (listType) {
        query = query.eq('list_type', listType)
      }

      const { data, error } = await query
      if (error) {
        throw new Error(error.message)
      }

      return (Array.isArray(data) ? data : []).map((row) => ({
        ...row,
        edition_note: schema.qualification ? row.edition_note ?? null : null,
        region: schema.qualification ? row.region ?? null : null,
        completeness: schema.qualification ? row.completeness ?? null : null,
        qualification_confidence: schema.qualification ? row.qualification_confidence ?? null : null,
        qualification_updated_at: schema.qualification ? row.qualification_updated_at ?? null : null,
      }))
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
    const qualificationColumns = schema.qualification
      ? ', edition_note, region, completeness, qualification_confidence, qualification_updated_at'
      : ''
    const params = [scope.userId]
    let sql = `
      SELECT id,user_id,user_session,game_id,added_at,condition,notes,list_type,price_paid,purchase_date,personal_note,price_threshold,created_at,updated_at${qualificationColumns}
      FROM collection_items
      WHERE user_id = ?
    `

    if (listType) {
      sql += ' AND list_type = ?'
      params.push(listType)
    }

    sql += ' ORDER BY COALESCE(created_at, added_at) DESC'
    const rows = db._sqlite.prepare(sql).all(...params)
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      ...row,
      edition_note: schema.qualification ? row.edition_note ?? null : null,
      region: schema.qualification ? row.region ?? null : null,
      completeness: schema.qualification ? row.completeness ?? null : null,
      qualification_confidence: schema.qualification ? row.qualification_confidence ?? null : null,
      qualification_updated_at: schema.qualification ? row.qualification_updated_at ?? null : null,
    }))
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
  const listType = options.listType ? String(options.listType).trim().toLowerCase() : null
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

module.exports = {
  hasCanonicalCollectionSchema,
  getCollectionSchemaState,
  getCollectionItem,
  listCollectionItems,
  listPublicCollectionItems,
  ensureGameExists,
}
