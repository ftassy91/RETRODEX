'use strict'

async function getColumnNames(sequelize, tableName) {
  const [rows] = await sequelize.query(`PRAGMA table_info(${tableName})`)
  return new Set((rows || []).map((row) => String(row.name)))
}

async function addColumnIfMissing(sequelize, tableName, columnName, definition) {
  const columns = await getColumnNames(sequelize, tableName)
  if (columns.has(columnName)) {
    return
  }

  await sequelize.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
}

module.exports = {
  id: '20260330_005_supadata_external_assets_extension',
  description: 'Extend media references for external maps and asset metadata',
  up: async ({ sequelize }) => {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS media_references (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        media_type TEXT NOT NULL,
        url TEXT NOT NULL,
        provider TEXT,
        compliance_status TEXT NOT NULL DEFAULT 'approved_with_review',
        storage_mode TEXT NOT NULL DEFAULT 'external_reference',
        source_record_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(entity_type, entity_id, media_type, url)
      )
    `)

    await addColumnIfMissing(sequelize, 'media_references', 'title', 'TEXT')
    await addColumnIfMissing(sequelize, 'media_references', 'preview_url', 'TEXT')
    await addColumnIfMissing(sequelize, 'media_references', 'asset_subtype', 'TEXT')
    await addColumnIfMissing(sequelize, 'media_references', 'license_status', "TEXT NOT NULL DEFAULT 'reference_only'")
    await addColumnIfMissing(sequelize, 'media_references', 'ui_allowed', 'INTEGER NOT NULL DEFAULT 0')
    await addColumnIfMissing(sequelize, 'media_references', 'healthcheck_status', "TEXT NOT NULL DEFAULT 'unchecked'")
    await addColumnIfMissing(sequelize, 'media_references', 'notes', 'TEXT')
    await addColumnIfMissing(sequelize, 'media_references', 'last_checked_at', 'TEXT')
    await addColumnIfMissing(sequelize, 'media_references', 'source_context', 'TEXT')

    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_media_references_entity ON media_references(entity_type, entity_id)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_media_references_type ON media_references(media_type)')
  },
}
