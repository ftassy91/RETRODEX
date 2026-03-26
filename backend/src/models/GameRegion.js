const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const GameRegion = sequelize.define(
  "GameRegion",
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
    regionCode: {
      type: DataTypes.STRING(5),
      allowNull: false,
      primaryKey: true,
      references: {
        model: "regions",
        key: "code",
      },
    },
  },
  {
    tableName: "game_regions",
    timestamps: false,
    underscored: false,
  }
);

module.exports = GameRegion;
