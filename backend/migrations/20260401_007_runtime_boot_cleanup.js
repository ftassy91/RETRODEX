'use strict'

const { DataTypes } = require('sequelize')

async function describeTableSafe(queryInterface, tableName) {
  try {
    return await queryInterface.describeTable(tableName)
  } catch (_error) {
    return null
  }
}

async function addColumnIfMissing(queryInterface, tableName, columns, columnName, definition) {
  if (!columns || columns[columnName]) {
    return
  }

  await queryInterface.addColumn(tableName, columnName, definition)
}

module.exports = {
  id: '20260401_007_runtime_boot_cleanup',
  description: 'Move hidden runtime schema mutations into an explicit migration',
  up: async ({ sequelize }) => {
    const queryInterface = sequelize.getQueryInterface()
    const gameColumns = await describeTableSafe(queryInterface, 'games')

    await addColumnIfMissing(queryInterface, 'games', gameColumns, 'tagline', {
      type: DataTypes.TEXT,
      allowNull: true,
    })
    await addColumnIfMissing(queryInterface, 'games', gameColumns, 'cover_url', {
      type: DataTypes.TEXT,
      allowNull: true,
    })
    await addColumnIfMissing(queryInterface, 'games', gameColumns, 'synopsis', {
      type: DataTypes.TEXT,
      allowNull: true,
    })
    await addColumnIfMissing(queryInterface, 'games', gameColumns, 'dev_anecdotes', {
      type: DataTypes.TEXT,
      allowNull: true,
    })
    await addColumnIfMissing(queryInterface, 'games', gameColumns, 'dev_team', {
      type: DataTypes.TEXT,
      allowNull: true,
    })
    await addColumnIfMissing(queryInterface, 'games', gameColumns, 'cheat_codes', {
      type: DataTypes.TEXT,
      allowNull: true,
    })

    const priceHistoryColumns = await describeTableSafe(queryInterface, 'price_history')
    if (!priceHistoryColumns) {
      await queryInterface.createTable('price_history', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        game_id: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        price: {
          type: DataTypes.REAL,
          allowNull: false,
        },
        condition: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        sale_date: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        source: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        listing_title: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        listing_url: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        created_at: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
      })
    }

    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_ph_game_id ON price_history(game_id)')
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_ph_sale_date ON price_history(sale_date)')
  },
}
