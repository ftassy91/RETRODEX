'use strict'

async function tableExists(sequelize, tableName) {
  const [rows] = await sequelize.query(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table'
       AND name = :tableName
     LIMIT 1`,
    {
      replacements: { tableName },
    }
  )

  return Array.isArray(rows) && rows.length > 0
}

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

async function createTable(sequelize, sql) {
  await sequelize.query(sql)
}

module.exports = {
  id: '20260330_004_supadata_knowledge_core',
  description: 'Align local canonical knowledge tables with the Supadata editorial, records and OST schema',
  up: async ({ sequelize }) => {
    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS game_editorial (
        game_id TEXT PRIMARY KEY,
        summary TEXT,
        synopsis TEXT,
        lore TEXT,
        dev_notes TEXT,
        cheat_codes TEXT,
        characters TEXT,
        gameplay_description TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await addColumnIfMissing(sequelize, 'game_editorial', 'dev_anecdotes', 'TEXT')
    await addColumnIfMissing(sequelize, 'game_editorial', 'versions', 'TEXT')
    await addColumnIfMissing(sequelize, 'game_editorial', 'avg_duration_main', 'REAL')
    await addColumnIfMissing(sequelize, 'game_editorial', 'avg_duration_complete', 'REAL')
    await addColumnIfMissing(sequelize, 'game_editorial', 'speedrun_wr', 'TEXT')
    await addColumnIfMissing(sequelize, 'game_editorial', 'source_record_id', 'INTEGER')

    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS people (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        primary_role TEXT,
        source_record_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_people_normalized_name ON people(normalized_name)')

    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS game_people (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id TEXT NOT NULL,
        person_id TEXT NOT NULL,
        role TEXT NOT NULL,
        billing_order INTEGER,
        source_record_id INTEGER,
        confidence REAL NOT NULL DEFAULT 0.5,
        is_inferred INTEGER NOT NULL DEFAULT 0,
        UNIQUE(game_id, person_id, role)
      )
    `)

    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS ost (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        title TEXT,
        source_record_id INTEGER,
        confidence REAL NOT NULL DEFAULT 0.5,
        needs_release_enrichment INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS ost_tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ost_id TEXT NOT NULL,
        track_title TEXT NOT NULL,
        track_number INTEGER,
        composer_person_id TEXT,
        source_record_id INTEGER,
        confidence REAL NOT NULL DEFAULT 0.5
      )
    `)

    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS ost_releases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ost_id TEXT NOT NULL,
        region_code TEXT,
        release_date TEXT,
        catalog_number TEXT,
        label TEXT,
        source_record_id INTEGER,
        confidence REAL NOT NULL DEFAULT 0.5
      )
    `)

    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS source_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        field_name TEXT,
        source_name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_url TEXT,
        source_license TEXT,
        compliance_status TEXT NOT NULL,
        ingested_at TEXT NOT NULL,
        last_verified_at TEXT,
        confidence_level REAL NOT NULL DEFAULT 0.5,
        notes TEXT,
        UNIQUE(entity_type, entity_id, field_name, source_name, source_type)
      )
    `)

    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS field_provenance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        source_record_id INTEGER,
        value_hash TEXT,
        is_inferred INTEGER NOT NULL DEFAULT 0,
        confidence_level REAL NOT NULL DEFAULT 0.5,
        verified_at TEXT,
        UNIQUE(entity_type, entity_id, field_name)
      )
    `)

    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS quality_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        completeness_score INTEGER NOT NULL,
        confidence_score INTEGER NOT NULL,
        source_coverage_score INTEGER NOT NULL,
        freshness_score INTEGER,
        overall_score INTEGER NOT NULL,
        tier TEXT NOT NULL,
        missing_critical_fields TEXT,
        breakdown_json TEXT,
        priority_score REAL,
        updated_at TEXT NOT NULL,
        UNIQUE(entity_type, entity_id)
      )
    `)

    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_game_editorial_source_record_id ON game_editorial(source_record_id)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_game_people_game_id ON game_people(game_id)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_ost_game_id ON ost(game_id)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_ost_tracks_ost_id ON ost_tracks(ost_id)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_ost_releases_ost_id ON ost_releases(ost_id)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_source_records_entity ON source_records(entity_type, entity_id)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_quality_records_entity ON quality_records(entity_type, entity_id)')

    if (await tableExists(sequelize, 'osts')) {
      await sequelize.query(`
        INSERT OR IGNORE INTO ost (
          id,
          game_id,
          title,
          source_record_id,
          confidence,
          needs_release_enrichment,
          created_at,
          updated_at
        )
        SELECT
          id,
          game_id,
          name,
          NULL,
          COALESCE(source_confidence, 0.5),
          0,
          COALESCE(created_at, CURRENT_TIMESTAMP),
          COALESCE(updated_at, CURRENT_TIMESTAMP)
        FROM osts
      `)
    }
  },
}
