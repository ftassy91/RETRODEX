const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const Genre = sequelize.define(
  "Genre",
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
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {
    tableName: "genres",
    timestamps: false,
  }
);

module.exports = Genre;
