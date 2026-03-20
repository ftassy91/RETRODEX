'use strict'

const { DataTypes } = require('sequelize')
const { sequelize } = require('../database')

const Franchise = sequelize.define('Franchise', {
  id:           { type: DataTypes.STRING, primaryKey: true },
  name:         { type: DataTypes.STRING, allowNull: false },
  slug:         { type: DataTypes.STRING, allowNull: false, unique: true },
  description:  { type: DataTypes.TEXT },
  first_game:   { type: DataTypes.INTEGER },
  last_game:    { type: DataTypes.INTEGER },
  developer:    { type: DataTypes.STRING },
  publisher:    { type: DataTypes.STRING },
  genres:       { type: DataTypes.TEXT },
  platforms:    { type: DataTypes.TEXT },
  timeline:     { type: DataTypes.TEXT },
  team_changes: { type: DataTypes.TEXT },
  trivia:       { type: DataTypes.TEXT },
  legacy:       { type: DataTypes.TEXT },
}, { tableName: 'franchises', timestamps: true })

module.exports = Franchise
