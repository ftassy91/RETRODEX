'use strict'

const { DataTypes } = require('sequelize')

async function describeTableSafe(queryInterface, tableName) {
  try {
    return await queryInterface.describeTable(tableName)
  } catch (err) {
    const msg = String(err.message || '').toLowerCase()
    if (msg.includes('does not exist') || msg.includes('no such table')) {
      return null
    }
    console.error(`[migration] describeTableSafe failed for "${tableName}"`, err)
    throw err
  }
}

async function addColumnIfMissing(queryInterface, tableName, columns, columnName, definition) {
  if (!columns || columns[columnName]) {
    return
  }

  await queryInterface.addColumn(tableName, columnName, definition)
}

module.exports = {
  id: '20260404_011_ux_data_transparency',
  description: 'Add price_last_updated and source_names to games for UX transparency (Sprint A)',
  up: async ({ sequelize }) => {
    const queryInterface = sequelize.getQueryInterface()
    const gameColumns = await describeTableSafe(queryInterface, 'games')

    // When were prices last refreshed from market sources (PriceCharting, eBay, etc.)
    await addColumnIfMissing(queryInterface, 'games', gameColumns, 'price_last_updated', {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Date prices were last updated from market sources',
    })

    // Comma-separated list of source names used for this record (MobyGames, IGDB, PriceCharting...)
    await addColumnIfMissing(queryInterface, 'games', gameColumns, 'source_names', {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Comma-separated source attribution (e.g. "MobyGames, IGDB, PriceCharting")',
    })
  },
}
