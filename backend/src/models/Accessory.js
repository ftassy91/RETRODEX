'use strict'
const { DataTypes } = require('sequelize')
const { sequelize } = require('../database')

const Accessory = sequelize.define('Accessory', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    comment: 'slug ex: super-nintendo-controller-snes'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  console_id: {
    type: DataTypes.STRING,
    comment: 'FK vers Games.id avec type=console — optionnel'
  },
  manufacturer_id: {
    type: DataTypes.STRING,
    comment: 'FK vers companies.id'
  },
  accessory_type: {
    type: DataTypes.STRING,
    comment: 'controller | lightgun | memory_card | peripheral | cable | power_supply | display | storage | audio | other'
  },
  region_code: {
    type: DataTypes.STRING(5),
    comment: 'JP | US | EU | WW | AU'
  },
  release_year: {
    type: DataTypes.INTEGER
  },
  description: {
    type: DataTypes.TEXT
  },
  slug: {
    type: DataTypes.STRING
  },
  source_confidence: {
    type: DataTypes.FLOAT,
    defaultValue: 0.5
  }
}, {
  tableName: 'accessories',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
})

module.exports = Accessory
