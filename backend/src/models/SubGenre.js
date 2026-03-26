const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const SubGenre = sequelize.define(
  "SubGenre",
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
    genreId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "sub_genres",
    timestamps: false,
  }
);

module.exports = SubGenre;
