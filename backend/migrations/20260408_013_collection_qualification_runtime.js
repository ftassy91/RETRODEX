'use strict'

const { DataTypes } = require('sequelize')

const TABLE_NAME = 'collection_items'

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables()
  const normalized = (tables || []).map((entry) => String(entry).replace(/"/g, '').toLowerCase())
  return normalized.includes(String(tableName).toLowerCase())
}

async function addColumnIfMissing(queryInterface, tableName, columnName, definition) {
  const description = await queryInterface.describeTable(tableName)
  if (description[columnName]) {
    return
  }

  await queryInterface.addColumn(tableName, columnName, definition)
}

module.exports = {
  id: '20260408_013_collection_qualification_runtime',
  description: 'Add minimal collection qualification fields for runtime control surfaces',
  up: async ({ sequelize }) => {
    const queryInterface = sequelize.getQueryInterface()
    const exists = await tableExists(queryInterface, TABLE_NAME)

    if (!exists) {
      return
    }

    await addColumnIfMissing(queryInterface, TABLE_NAME, 'edition_note', {
      type: DataTypes.TEXT,
      allowNull: true,
    })

    await addColumnIfMissing(queryInterface, TABLE_NAME, 'region', {
      type: DataTypes.STRING,
      allowNull: true,
    })

    await addColumnIfMissing(queryInterface, TABLE_NAME, 'completeness', {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'unknown',
    })

    await addColumnIfMissing(queryInterface, TABLE_NAME, 'qualification_confidence', {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'unknown',
    })

    await addColumnIfMissing(queryInterface, TABLE_NAME, 'qualification_updated_at', {
      type: DataTypes.DATE,
      allowNull: true,
    })
  },
}
