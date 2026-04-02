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

async function createTable(sequelize, sql) {
  await sequelize.query(sql)
}

module.exports = {
  id: '20260330_006_pass1_curation_program',
  description: 'Add PASS 1 curation profiles, lifecycle state, immutability events and publication slots',
  up: async ({ sequelize }) => {
    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS game_content_profiles (
        game_id TEXT PRIMARY KEY,
        console_id TEXT,
        profile_version TEXT NOT NULL,
        profile_mode TEXT NOT NULL DEFAULT 'heuristic',
        content_profile_json TEXT NOT NULL,
        profile_basis_json TEXT,
        relevant_expected INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS game_curation_states (
        game_id TEXT PRIMARY KEY,
        console_id TEXT,
        pass_key TEXT NOT NULL,
        status TEXT NOT NULL,
        selection_score REAL,
        target_rank INTEGER,
        is_target INTEGER NOT NULL DEFAULT 0,
        completion_score REAL NOT NULL DEFAULT 0,
        relevant_expected INTEGER NOT NULL DEFAULT 0,
        relevant_filled INTEGER NOT NULL DEFAULT 0,
        missing_relevant_sections_json TEXT,
        critical_errors_json TEXT,
        validation_summary_json TEXT,
        last_validated_at TEXT,
        locked_at TEXT,
        published_at TEXT,
        content_version TEXT,
        immutable_hash TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS game_curation_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT NOT NULL UNIQUE,
        game_id TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        reason TEXT NOT NULL,
        run_key TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        diff_summary_json TEXT
      )
    `)

    await createTable(sequelize, `
      CREATE TABLE IF NOT EXISTS console_publication_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        console_id TEXT NOT NULL,
        game_id TEXT NOT NULL,
        pass_key TEXT NOT NULL,
        slot_rank INTEGER NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        published_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(pass_key, game_id)
      )
    `)

    await addColumnIfMissing(sequelize, 'game_content_profiles', 'console_id', 'TEXT')
    await addColumnIfMissing(sequelize, 'game_content_profiles', 'profile_basis_json', 'TEXT')
    await addColumnIfMissing(sequelize, 'game_content_profiles', 'relevant_expected', 'INTEGER NOT NULL DEFAULT 0')

    await addColumnIfMissing(sequelize, 'game_curation_states', 'console_id', 'TEXT')
    await addColumnIfMissing(sequelize, 'game_curation_states', 'selection_score', 'REAL')
    await addColumnIfMissing(sequelize, 'game_curation_states', 'target_rank', 'INTEGER')
    await addColumnIfMissing(sequelize, 'game_curation_states', 'is_target', 'INTEGER NOT NULL DEFAULT 0')
    await addColumnIfMissing(sequelize, 'game_curation_states', 'validation_summary_json', 'TEXT')
    await addColumnIfMissing(sequelize, 'game_curation_states', 'updated_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP')

    await addColumnIfMissing(sequelize, 'game_curation_events', 'event_key', 'TEXT')
    await addColumnIfMissing(sequelize, 'game_curation_events', 'diff_summary_json', 'TEXT')

    await addColumnIfMissing(sequelize, 'console_publication_slots', 'updated_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP')

    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_game_content_profiles_console ON game_content_profiles(console_id)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_game_curation_states_console ON game_curation_states(console_id)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_game_curation_states_pass ON game_curation_states(pass_key, status)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_game_curation_events_game ON game_curation_events(game_id, created_at)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_console_publication_slots_console ON console_publication_slots(console_id, pass_key)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_console_publication_slots_game ON console_publication_slots(game_id)')
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_console_publication_slots_active_rank
      ON console_publication_slots(pass_key, console_id, slot_rank)
      WHERE is_active = 1
    `)
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_game_curation_states_target_rank
      ON game_curation_states(pass_key, console_id, target_rank)
      WHERE is_target = 1 AND target_rank IS NOT NULL
    `)
  },
}
