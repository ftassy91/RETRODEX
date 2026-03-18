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
    loosePrice: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    cibPrice: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    mintPrice: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
  },
  {
    tableName: "games",
  }
);

module.exports = Game;

