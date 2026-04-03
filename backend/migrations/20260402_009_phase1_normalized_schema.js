'use strict'

async function createTable(sequelize, sql) {
  await sequelize.query(sql)
}

module.exports = {
  id: '20260402_009_phase1_normalized_schema',
  description: 'Phase 1 normalized schema: game_credits, price_summary, game_ost, game_ost_tracks, competitive_profiles, competitive_records',
  up: async ({ sequelize }) => {
    // Unified credits table replacing game_people + game_companies (those tables are NOT dropped)
    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS game_credits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id TEXT NOT NULL,
        credited_entity_id TEXT NOT NULL,
        credited_entity_type TEXT CHECK(credited_entity_type IN ('person','company')),
        role TEXT NOT NULL,
        billing_order INTEGER,
        source_record_id INTEGER,
        confidence REAL DEFAULT 0.5,
        is_inferred INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(game_id, credited_entity_id, credited_entity_type, role)
      )
    `)

    // Computed aggregate price view over price_observations
    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS price_summary (
        game_id TEXT PRIMARY KEY,
        loose_price_p50 REAL,
        loose_price_p25 REAL,
        loose_price_p75 REAL,
        loose_sample_count INTEGER DEFAULT 0,
        cib_price_p50 REAL,
        cib_price_p25 REAL,
        cib_price_p75 REAL,
        cib_sample_count INTEGER DEFAULT 0,
        mint_price_p50 REAL,
        mint_price_p25 REAL,
        mint_price_p75 REAL,
        mint_sample_count INTEGER DEFAULT 0,
        trend_90d TEXT,
        last_observed_at TEXT,
        confidence_score INTEGER DEFAULT 0,
        computed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Cleaner OST replacement (ost table is NOT dropped)
    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS game_ost (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        title TEXT,
        track_count INTEGER,
        primary_release_date TEXT,
        primary_label TEXT,
        source_record_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS game_ost_tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ost_id TEXT NOT NULL,
        track_number INTEGER,
        title TEXT NOT NULL,
        composer_person_id TEXT,
        duration_seconds INTEGER,
        source_record_id INTEGER,
        confidence REAL DEFAULT 0.5,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Simplified competitive profile (game_competitive_profiles in migration 008 is NOT dropped)
    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS competitive_profiles (
        game_id TEXT PRIMARY KEY,
        is_speedrun_relevant INTEGER DEFAULT 0,
        is_score_attack_relevant INTEGER DEFAULT 0,
        is_achievement_relevant INTEGER DEFAULT 0,
        source_name TEXT,
        source_url TEXT,
        freshness_checked_at TEXT,
        source_record_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Flat competitive records table (game_record_entries in migration 008 is NOT dropped)
    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS competitive_records (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        category_label TEXT NOT NULL,
        record_kind TEXT CHECK(record_kind IN ('speedrun','score','achievement')),
        rank_position INTEGER,
        player_handle TEXT,
        score_display TEXT NOT NULL,
        score_raw TEXT,
        achieved_at TEXT,
        source_name TEXT NOT NULL,
        source_url TEXT,
        observed_at TEXT,
        source_record_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(game_id, category_label, rank_position, player_handle)
      )
    `)
  },

  down: async ({ sequelize }) => {
    await sequelize.query('DROP TABLE IF EXISTS competitive_records')
    await sequelize.query('DROP TABLE IF EXISTS competitive_profiles')
    await sequelize.query('DROP TABLE IF EXISTS game_ost_tracks')
    await sequelize.query('DROP TABLE IF EXISTS game_ost')
    await sequelize.query('DROP TABLE IF EXISTS price_summary')
    await sequelize.query('DROP TABLE IF EXISTS game_credits')
  },
}
