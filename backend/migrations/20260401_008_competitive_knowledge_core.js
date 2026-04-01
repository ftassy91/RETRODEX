'use strict'

async function createTable(sequelize, sql) {
  await sequelize.query(sql)
}

module.exports = {
  id: '20260401_008_competitive_knowledge_core',
  description: 'Introduce canonical competitive knowledge tables for records and leaderboard context',
  up: async ({ sequelize }) => {
    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS game_competitive_profiles (
        game_id TEXT PRIMARY KEY,
        speedrun_relevant INTEGER NOT NULL DEFAULT 0,
        score_attack_relevant INTEGER NOT NULL DEFAULT 0,
        leaderboard_relevant INTEGER NOT NULL DEFAULT 0,
        achievement_competitive INTEGER NOT NULL DEFAULT 0,
        primary_source TEXT,
        source_summary TEXT,
        source_record_id INTEGER,
        freshness_checked_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS game_record_categories (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        category_key TEXT,
        label TEXT NOT NULL,
        record_kind TEXT,
        value_direction TEXT,
        external_url TEXT,
        source_name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_url TEXT,
        observed_at TEXT,
        is_primary INTEGER NOT NULL DEFAULT 0,
        display_order INTEGER NOT NULL DEFAULT 0,
        source_record_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(game_id, source_name, label)
      )
    `)

    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS game_record_entries (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        game_id TEXT NOT NULL,
        rank_position INTEGER,
        player_handle TEXT,
        score_raw TEXT,
        score_display TEXT NOT NULL,
        achieved_at TEXT,
        external_url TEXT,
        source_name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_url TEXT,
        observed_at TEXT,
        source_record_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(category_id, rank_position, player_handle, score_display)
      )
    `)

    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS game_achievement_profiles (
        game_id TEXT PRIMARY KEY,
        source_name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_url TEXT,
        points_total INTEGER,
        achievement_count INTEGER,
        leaderboard_count INTEGER,
        mastery_summary TEXT,
        high_score_summary TEXT,
        observed_at TEXT,
        source_record_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_competitive_profiles_game_id ON game_competitive_profiles(game_id)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_record_categories_game_id ON game_record_categories(game_id)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_record_entries_game_id ON game_record_entries(game_id)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_record_entries_category_id ON game_record_entries(category_id)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_achievement_profiles_game_id ON game_achievement_profiles(game_id)')
  },
}
