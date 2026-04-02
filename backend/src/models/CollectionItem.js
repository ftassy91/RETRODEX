const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const CollectionItem = sequelize.define(
  "CollectionItem",
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: "id",
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "local",
      field: "user_id",
    },
    userSession: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "local",
      field: "user_session",
    },
    gameId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "game_id",
    },
    addedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
      field: "added_at",
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
    purchase_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "purchase_date",
    },
    personal_note: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "personal_note",
    },
    price_threshold: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "price_threshold",
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "updated_at",
    },
  },
  {
    tableName: "collection_items",
    timestamps: false,
    underscored: false,
  }
);

module.exports = CollectionItem;
