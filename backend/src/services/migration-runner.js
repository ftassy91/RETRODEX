'use strict'

const fs = require('fs')
const path = require('path')

const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations')

function loadMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return []
  }

  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((fileName) => fileName.endsWith('.js'))
    .sort()
    .map((fileName) => ({
      fileName,
      migration: require(path.join(MIGRATIONS_DIR, fileName)),
    }))
}

async function ensureMigrationsTable(sequelize) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `)
}

async function listAppliedMigrations(sequelize) {
  await ensureMigrationsTable(sequelize)
  const [rows] = await sequelize.query('SELECT id FROM _schema_migrations')
  return new Set((rows || []).map((row) => String(row.id)))
}

async function markApplied(sequelize, id, fileName) {
  const [existingRows] = await sequelize.query(
    'SELECT id FROM _schema_migrations WHERE id = :id',
    { replacements: { id } }
  )

  if (Array.isArray(existingRows) && existingRows.length) {
    return
  }

  await sequelize.query(
    `INSERT INTO _schema_migrations (id, file_name, applied_at)
     VALUES (:id, :fileName, :appliedAt)`,
    {
      replacements: {
        id,
        fileName,
        appliedAt: new Date().toISOString(),
      },
    }
  )
}

async function runMigrations(sequelize) {
  const applied = await listAppliedMigrations(sequelize)
  const migrations = loadMigrationFiles()
  const executed = []

  for (const entry of migrations) {
    const { fileName, migration } = entry
    const migrationId = migration.id || fileName

    if (applied.has(migrationId)) {
      continue
    }

    if (typeof migration.up !== 'function') {
      throw new Error(`Migration ${fileName} is missing an up() function`)
    }

    await migration.up({ sequelize })
    await markApplied(sequelize, migrationId, fileName)
    executed.push({
      id: migrationId,
      fileName,
      description: migration.description || null,
    })
  }

  return executed
}

module.exports = {
  MIGRATIONS_DIR,
  runMigrations,
}
