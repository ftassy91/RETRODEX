const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const PriceSummary = sequelize.define(
  "PriceSummary",
  {
    gameId: {
      type: DataTypes.TEXT,
      primaryKey: true,
      field: "game_id",
    },
    loosePriceP50: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "loose_price_p50",
    },
    loosePriceP25: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "loose_price_p25",
    },
    loosePriceP75: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "loose_price_p75",
    },
    looseSampleCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: "loose_sample_count",
    },
    cibPriceP50: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "cib_price_p50",
    },
    cibPriceP25: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "cib_price_p25",
    },
    cibPriceP75: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "cib_price_p75",
    },
    cibSampleCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: "cib_sample_count",
    },
    mintPriceP50: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "mint_price_p50",
    },
    mintPriceP25: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "mint_price_p25",
    },
    mintPriceP75: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "mint_price_p75",
    },
    mintSampleCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: "mint_sample_count",
    },
    trend90d: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "trend_90d",
    },
    lastObservedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "last_observed_at",
    },
    confidenceScore: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: "confidence_score",
    },
    computedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "computed_at",
    },
  },
  {
    tableName: "price_summary",
    timestamps: false,
    underscored: false,
  }
);

module.exports = PriceSummary;
