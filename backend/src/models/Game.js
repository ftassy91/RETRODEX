const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const Game = sequelize.define(
  "Game",
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    console: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    developer: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    genre: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    metascore: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    rarity: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    type: {
      type: DataTypes.STRING,
      defaultValue: "game",
      comment: "game | console | accessory | ost | collector_edition",
    },
    slug: {
      type: DataTypes.STRING,
      comment: "URL-friendly unique identifier",
    },
    source_confidence: {
      type: DataTypes.FLOAT,
      defaultValue: 0.5,
      comment: "0.0 à 1.0 — fiabilité de la source",
    },
    loosePrice: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "loose_price",
    },
    cibPrice: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "cib_price",
    },
    mintPrice: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "mint_price",
    },
  },
  {
    tableName: "games",
    timestamps: false,
    underscored: false,
  }
);

module.exports = Game;
