const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const CollectionItem = sequelize.define(
  "CollectionItem",
  {
    gameId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
      field: "gameId",
    },
    addedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "addedAt",
    },
    condition: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "Loose",
      field: "condition",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
      field: "notes",
    },
    list_type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "owned",
      validate: {
        isIn: [["owned", "wanted", "for_sale"]],
      },
      field: "list_type",
    },
    price_paid: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "price_paid",
    },
  },
  {
    tableName: "collection_items",
    timestamps: false,
    underscored: false,
  }
);

module.exports = CollectionItem;
