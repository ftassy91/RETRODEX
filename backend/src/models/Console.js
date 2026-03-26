const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const Console = sequelize.define(
  "Console",
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    manufacturer: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    generation: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    releaseYear: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {
    tableName: "consoles",
    timestamps: false,
    underscored: false,
  }
);

module.exports = Console;
