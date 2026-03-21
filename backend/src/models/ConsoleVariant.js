'use strict'
const { DataTypes } = require('sequelize')
const { sequelize } = require('../database')

const ConsoleVariant = sequelize.define('ConsoleVariant', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    comment: 'slug ex: super-nintendo-pal-1'
  },
  console_id: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'FK vers Games.id avec type=console'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'ex: Super Nintendo PAL Edition'
  },
  region_code: {
    type: DataTypes.STRING(5),
    comment: 'JP | US | EU | WW | AU'
  },
  release_date: {
    type: DataTypes.DATEONLY
  },
  color: {
    type: DataTypes.STRING,
    comment: 'ex: gray, black, red-limited'
  },
  special_edition_flag: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  notes: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'console_variants',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
})

module.exports = ConsoleVariant
