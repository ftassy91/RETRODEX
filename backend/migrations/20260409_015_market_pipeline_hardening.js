'use strict'

const { DataTypes } = require('sequelize')

async function describeTableSafe(queryInterface, tableName) {
  try {
    return await queryInterface.describeTable(tableName)
  } catch (_error) {
    return null
  }
}

async function addColumnIfMissing(queryInterface, tableName, columnName, definition) {
  const columns = await describeTableSafe(queryInterface, tableName)
  if (!columns || columns[columnName]) {
    return
  }

  await queryInterface.addColumn(tableName, columnName, definition)
}

async function createIndexIfPossible(sequelize, sql) {
  await sequelize.query(sql)
}

module.exports = {
  id: '20260409_015_market_pipeline_hardening',
  description: 'Harden ingest run traceability and sold-listing dedupe guarantees for the market pipeline',
  up: async ({ sequelize }) => {
    const queryInterface = sequelize.getQueryInterface()

    await addColumnIfMissing(queryInterface, 'price_ingest_runs', 'run_key', {
      type: DataTypes.STRING,
      allowNull: true,
    })
    await addColumnIfMissing(queryInterface, 'price_ingest_runs', 'pipeline_name', {
      type: DataTypes.STRING,
      allowNull: true,
    })
    await addColumnIfMissing(queryInterface, 'price_ingest_runs', 'source_scope', {
      type: DataTypes.TEXT,
      allowNull: true,
    })
    await addColumnIfMissing(queryInterface, 'price_ingest_runs', 'dry_run', {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    })

    await createIndexIfPossible(
      sequelize,
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_price_ingest_runs_run_key_unique ON price_ingest_runs(run_key)'
    )
    await createIndexIfPossible(
      sequelize,
      'CREATE INDEX IF NOT EXISTS idx_price_ingest_runs_pipeline_started ON price_ingest_runs(pipeline_name, started_at)'
    )
    await createIndexIfPossible(
      sequelize,
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_price_history_source_listing_unique ON price_history(source_id, listing_reference)'
    )
  },
}
