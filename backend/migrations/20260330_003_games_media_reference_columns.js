'use strict'

const { DataTypes } = require('sequelize')

async function addColumnIfMissing(queryInterface, tableName, columns, columnName, definition) {
  if (columns[columnName]) {
    return
  }

  await queryInterface.addColumn(tableName, columnName, definition)
}

module.exports = {
  id: '20260330_003_games_media_reference_columns',
  description: 'Add zero-hosting media reference columns to games',
  up: async ({ sequelize }) => {
    const queryInterface = sequelize.getQueryInterface()
    const columns = await queryInterface.describeTable('games')

    await addColumnIfMissing(queryInterface, 'games', columns, 'youtube_id', {
      type: DataTypes.TEXT,
      allowNull: true,
    })
    await addColumnIfMissing(queryInterface, 'games', columns, 'youtube_verified', {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    })
    await addColumnIfMissing(queryInterface, 'games', columns, 'archive_id', {
      type: DataTypes.TEXT,
      allowNull: true,
    })
    await addColumnIfMissing(queryInterface, 'games', columns, 'archive_verified', {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    })
  },
}
