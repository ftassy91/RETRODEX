'use strict'
const { DataTypes } = require('sequelize')
const { sequelize } = require('../database')

const Company = sequelize.define('Company', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    comment: 'slug ex: nintendo, sega, konami'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.STRING,
    comment: 'developer | publisher | both'
  },
  country: {
    type: DataTypes.STRING
  },
  founded_year: {
    type: DataTypes.INTEGER
  }
}, {
  tableName: 'companies',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
})

module.exports = Company
