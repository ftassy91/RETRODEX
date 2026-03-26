'use strict'
const { DataTypes } = require('sequelize')
const { sequelize } = require('../database')

const MarketplaceListing = sequelize.define(
  'MarketplaceListing',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    gameId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    sellerId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'username or user identifier, no full auth required',
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'EUR',
    },
    condition: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: {
          args: [['mint', 'very_good', 'good', 'fair', 'poor', 'incomplete']],
          msg: 'invalid condition',
        },
      },
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'active',
      validate: {
        isIn: {
          args: [['active', 'sold', 'removed']],
          msg: 'invalid status',
        },
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: 'marketplace_listings',
    timestamps: true,
    underscored: false,
  }
)

module.exports = MarketplaceListing
