'use strict'

async function createTable(sequelize, sql) {
  await sequelize.query(sql)
}

module.exports = {
  id: '20260326_001_canonical_core',
  description: 'Introduce canonical data, provenance, quality and enrichment run tables',
  up: async ({ sequelize }) => {
    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS releases (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        console_id TEXT,
        region_code TEXT,
        edition_name TEXT,
        release_year INTEGER,
        release_date TEXT,
        release_identity TEXT,
        source_record_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

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
      CREATE TABLE IF NOT EXISTS game_companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id TEXT NOT NULL,
        company_id TEXT NOT NULL,
        role TEXT NOT NULL,
        source_record_id INTEGER,
        confidence REAL NOT NULL DEFAULT 0.5,
        is_inferred INTEGER NOT NULL DEFAULT 0,
        UNIQUE(game_id, company_id, role)
      )
    `)

    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS price_observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id TEXT NOT NULL,
        edition_id TEXT,
        condition TEXT,
        price REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        observed_at TEXT NOT NULL,
        source_name TEXT NOT NULL,
        source_record_id INTEGER,
        listing_reference TEXT,
        listing_url TEXT,
        confidence REAL NOT NULL DEFAULT 0.5,
        is_verified INTEGER NOT NULL DEFAULT 0,
        raw_payload TEXT
      )
    `)

    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS market_snapshots (
        game_id TEXT PRIMARY KEY,
        loose_price REAL,
        cib_price REAL,
        mint_price REAL,
        observation_count INTEGER NOT NULL DEFAULT 0,
        last_observed_at TEXT,
        trend_signal TEXT,
        confidence_score REAL NOT NULL DEFAULT 0,
        source_coverage INTEGER NOT NULL DEFAULT 0,
        computed_at TEXT NOT NULL
      )
    `)

    await createTable(sequelize, `
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

    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS enrichment_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_key TEXT NOT NULL UNIQUE,
        pipeline_name TEXT NOT NULL,
        mode TEXT NOT NULL,
        source_name TEXT,
        status TEXT NOT NULL,
        dry_run INTEGER NOT NULL DEFAULT 1,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        items_seen INTEGER NOT NULL DEFAULT 0,
        items_created INTEGER NOT NULL DEFAULT 0,
        items_updated INTEGER NOT NULL DEFAULT 0,
        items_skipped INTEGER NOT NULL DEFAULT 0,
        items_flagged INTEGER NOT NULL DEFAULT 0,
        error_count INTEGER NOT NULL DEFAULT 0,
        notes TEXT
      )
    `)

    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_releases_game_id ON releases(game_id)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_game_people_game_id ON game_people(game_id)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_game_companies_game_id ON game_companies(game_id)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_price_observations_game_id ON price_observations(game_id)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_price_observations_observed_at ON price_observations(observed_at)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_media_references_entity ON media_references(entity_type, entity_id)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_source_records_entity ON source_records(entity_type, entity_id)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_quality_records_entity ON quality_records(entity_type, entity_id)')
  },
}
