const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const GameGenre = sequelize.define(
  "GameGenre",
  {
    gameId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
      references: {
        model: "games",
        key: "id",
      },
    },
    genreId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
      references: {
        model: "genres",
        key: "id",
      },
    },
  },
  {
    tableName: "game_genres",
    timestamps: false,
  }
);

module.exports = GameGenre;
