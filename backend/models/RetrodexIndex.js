'use strict'

const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const RetrodexIndex = sequelize.define('RetrodexIndex', {
  item_id: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Game slug'
  },
  item_type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'game'
  },
  condition: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Loose / CIB / Mint'
  },
  index_value: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Displayed estimated price'
  },
  range_low: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'P25 of filtered sales'
  },
  range_high: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'P75 of filtered sales'
  },
  confidence_pct: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '0-100 confidence score'
  },
  sources_editorial: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  sources_community: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  trend: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'up / down / stable'
  },
  trend_pct: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Percent change across the tracked window'
  },
  sample_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  last_sale_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  last_computed_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'retrodex_index',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['item_id', 'condition']
    }
  ]
})

module.exports = RetrodexIndex
