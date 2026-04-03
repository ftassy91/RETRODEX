const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const GameCredit = sequelize.define(
  "GameCredit",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    gameId: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: "game_id",
    },
    creditedEntityId: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: "credited_entity_id",
    },
    creditedEntityType: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: "credited_entity_type",
      validate: {
        isIn: [["person", "company"]],
      },
    },
    role: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    billingOrder: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "billing_order",
    },
    sourceRecordId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "source_record_id",
    },
    confidence: {
      type: DataTypes.REAL,
      defaultValue: 0.5,
    },
    isInferred: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_inferred",
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
  },
  {
    tableName: "game_credits",
    timestamps: false,
    underscored: false,
  }
);

module.exports = GameCredit;
