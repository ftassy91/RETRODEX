'use strict'
const { DataTypes } = require('sequelize')
const { sequelize } = require('../database')

const Region = sequelize.define('Region', {
  code: {
    type: DataTypes.STRING(5),
    primaryKey: true,
    comment: 'JP | US | EU | WW | AU'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'regions',
  timestamps: false
})

module.exports = Region
