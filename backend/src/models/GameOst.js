const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const GameOst = sequelize.define(
  "GameOst",
  {
    id: {
      type: DataTypes.TEXT,
      primaryKey: true,
    },
    gameId: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: "game_id",
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    trackCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "track_count",
    },
    primaryReleaseDate: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "primary_release_date",
    },
    primaryLabel: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "primary_label",
    },
    sourceRecordId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "source_record_id",
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
  },
  {
    tableName: "game_ost",
    timestamps: false,
    underscored: false,
  }
);

module.exports = GameOst;
