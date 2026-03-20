'use strict'

const { DataTypes, Op } = require('sequelize')
const sequelize = require('../config/database')

const CommunityReport = sequelize.define('CommunityReport', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  item_id: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Game slug linked to Games.id'
  },
  item_type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'game'
  },
  user_id: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'retrodex_editorial for curated data, user slug otherwise'
  },
  reported_price: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'USD'
  },
  condition: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['Loose', 'CIB', 'Mint', 'Unknown']]
    }
  },
  context: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'ebay_sold / brocante / vinted / leboncoin / autre'
  },
  sale_title: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Raw listing title'
  },
  date_estimated: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Sale date'
  },
  source_url: {
    type: DataTypes.STRING,
    allowNull: true
  },
  user_trust_score: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0.95,
    comment: '0.95 for editorial, 0.4-0.9 for community'
  },
  report_confidence_score: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0.85,
    comment: 'Confidence score for this individual report'
  },
  is_editorial: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'true for RetroDex curated sales'
  },
  editorial_excluded: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'true when the sale was intentionally excluded'
  },
  editorial_note: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Reason for exclusion or editorial decision'
  }
}, {
  tableName: 'community_reports',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    { fields: ['item_id', 'condition'] },
    { fields: ['user_id'] },
    { fields: ['date_estimated'] }
  ]
})

module.exports = CommunityReport

