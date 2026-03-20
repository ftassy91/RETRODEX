'use strict'
const { DataTypes } = require('sequelize')
const { sequelize } = require('../database')

const OST = sequelize.define('OST', {
  id: { type: DataTypes.STRING, primaryKey: true },
  game_id: { type: DataTypes.STRING, comment: 'FK vers Games.id' },
  name: { type: DataTypes.STRING, allowNull: false },
  format: { type: DataTypes.STRING, comment: 'CD | vinyl | cassette | digital' },
  track_count: { type: DataTypes.INTEGER },
  release_year: { type: DataTypes.INTEGER },
  label: { type: DataTypes.STRING },
  region_code: { type: DataTypes.STRING(5) },
  slug: { type: DataTypes.STRING },
  source_confidence: { type: DataTypes.FLOAT, defaultValue: 0.5 }
}, { tableName: 'osts', timestamps: true,
    createdAt: 'created_at', updatedAt: 'updated_at' })

module.exports = OST
