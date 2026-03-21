'use strict'
const { DataTypes } = require('sequelize')
const { sequelize } = require('../database')

const CRTDisplay = sequelize.define('CRTDisplay', {
  id: { type: DataTypes.STRING, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  manufacturer_id: { type: DataTypes.STRING, comment: 'FK vers companies.id' },
  screen_size_inches: { type: DataTypes.FLOAT },
  resolution: { type: DataTypes.STRING, comment: 'ex: 800x600' },
  release_year: { type: DataTypes.INTEGER },
  region_code: { type: DataTypes.STRING(5) },
  slug: { type: DataTypes.STRING },
  source_confidence: { type: DataTypes.FLOAT, defaultValue: 0.5 }
}, { tableName: 'crt_displays', timestamps: true,
    createdAt: 'created_at', updatedAt: 'updated_at' })

module.exports = CRTDisplay
