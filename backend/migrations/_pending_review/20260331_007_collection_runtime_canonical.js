'use strict'

const { DataTypes, QueryTypes } = require('sequelize')

const COLLECTION_TABLE = 'collection_items'
const NEXT_COLLECTION_TABLE = 'collection_items__next'
const DEFAULT_USER_ID = 'local'

function normalizeText(value, fallback = null) {
  const text = String(value ?? '').trim()
  return text || fallback
}

function normalizeNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function normalizeCondition(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'cib') return 'CIB'
  if (raw === 'mint') return 'Mint'
  return 'Loose'
}

function normalizeListType(value, fallbackWishlist = false) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'wanted' || raw === 'for_sale') {
    return raw
  }

  if (fallbackWishlist) {
    return 'wanted'
  }

  return 'owned'
}

function normalizeDateOnly(value) {
  const text = normalizeText(value)
  if (!text) {
    return null
  }

  const match = text.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

function normalizeTimestamp(value, fallback = null) {
  if (!value) {
    return fallback
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return fallback
  }

  return date.toISOString()
}

function toCanonicalCollectionRow(row = {}) {
  const userSession = normalizeText(row.user_session, DEFAULT_USER_ID)
  const createdAt = normalizeTimestamp(
    row.created_at || row.added_at || row.addedAt || row.updated_at,
    new Date().toISOString()
  )
  const updatedAt = normalizeTimestamp(row.updated_at, createdAt)

  return {
    user_id: normalizeText(row.user_id || row.owner_id, userSession || DEFAULT_USER_ID),
    user_session: userSession,
    game_id: normalizeText(row.game_id || row.gameId || row.id),
    added_at: normalizeTimestamp(row.added_at || row.addedAt, createdAt),
    condition: normalizeCondition(row.condition),
    notes: normalizeText(row.notes),
    list_type: normalizeListType(row.list_type, Boolean(row.wishlist)),
    price_paid: normalizeNumber(row.price_paid),
    purchase_date: normalizeDateOnly(row.purchase_date || row.date_acquired),
    personal_note: normalizeText(row.personal_note),
    price_threshold: normalizeNumber(row.price_threshold),
    created_at: createdAt,
    updated_at: updatedAt,
  }
}

function getRecencyScore(row) {
  const timestamp = Date.parse(row.updated_at || row.created_at || row.added_at || '')
  return Number.isFinite(timestamp) ? timestamp : 0
}

function dedupeCollectionRows(rows = []) {
  const byKey = new Map()

  for (const row of rows) {
    if (!row.game_id) {
      continue
    }

    const key = `${row.user_id}::${row.game_id}`
    const existing = byKey.get(key)
    if (!existing || getRecencyScore(row) >= getRecencyScore(existing)) {
      byKey.set(key, row)
    }
  }

  return Array.from(byKey.values())
}

async function listTables(queryInterface) {
  const tables = await queryInterface.showAllTables()
  return (tables || []).map((tableName) => String(tableName).replace(/"/g, '').toLowerCase())
}

async function ensureCollectionIndexes(sequelize) {
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_collection_items_user_id
    ON ${COLLECTION_TABLE}(user_id)
  `)
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_collection_items_game_id
    ON ${COLLECTION_TABLE}(game_id)
  `)
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_collection_items_list_type
    ON ${COLLECTION_TABLE}(list_type)
  `)
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_items_user_game
    ON ${COLLECTION_TABLE}(user_id, game_id)
  `)
}

async function createCanonicalCollectionTable(queryInterface, tableName) {
  await queryInterface.createTable(tableName, {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: DEFAULT_USER_ID,
    },
    user_session: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    game_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    added_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    condition: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'Loose',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    list_type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'owned',
    },
    price_paid: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    purchase_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    personal_note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    price_threshold: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  })
}

module.exports = {
  id: '20260331_007_collection_runtime_canonical',
  description: 'Stabilize collection_items for runtime services and multi-user ownership',
  up: async ({ sequelize }) => {
    const queryInterface = sequelize.getQueryInterface()
    const knownTables = await listTables(queryInterface)

    if (!knownTables.includes(COLLECTION_TABLE)) {
      await createCanonicalCollectionTable(queryInterface, COLLECTION_TABLE)
      await ensureCollectionIndexes(sequelize)
      return
    }

    const existingRows = await sequelize.query(
      `SELECT * FROM ${COLLECTION_TABLE}`,
      { type: QueryTypes.SELECT }
    )

    await queryInterface.dropTable(NEXT_COLLECTION_TABLE).catch(() => {})
    await createCanonicalCollectionTable(queryInterface, NEXT_COLLECTION_TABLE)

    const normalizedRows = dedupeCollectionRows(existingRows.map(toCanonicalCollectionRow))

    if (normalizedRows.length) {
      await queryInterface.bulkInsert(NEXT_COLLECTION_TABLE, normalizedRows)
    }

    await queryInterface.dropTable(COLLECTION_TABLE)
    await queryInterface.renameTable(NEXT_COLLECTION_TABLE, COLLECTION_TABLE)
    await ensureCollectionIndexes(sequelize)
  },
}
