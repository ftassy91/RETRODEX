'use strict'
const { DataTypes } = require('sequelize')
const { sequelize } = require('../database')

const CollectorEdition = sequelize.define('CollectorEdition', {
  id: { type: DataTypes.STRING, primaryKey: true },
  game_id: { type: DataTypes.STRING, comment: 'FK vers Games.id' },
  name: { type: DataTypes.STRING, allowNull: false },
  contents: { type: DataTypes.TEXT, comment: 'description des éléments inclus' },
  release_year: { type: DataTypes.INTEGER },
  region_code: { type: DataTypes.STRING(5) },
  limited_quantity: { type: DataTypes.INTEGER },
  slug: { type: DataTypes.STRING },
  source_confidence: { type: DataTypes.FLOAT, defaultValue: 0.5 }
}, { tableName: 'collector_editions', timestamps: true,
    createdAt: 'created_at', updatedAt: 'updated_at' })

module.exports = CollectorEdition
