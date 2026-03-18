const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const CollectionItem = sequelize.define(
  "CollectionItem",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    gameId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    condition: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "collection_items",
  }
);

module.exports = CollectionItem;
