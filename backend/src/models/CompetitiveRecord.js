const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const CompetitiveRecord = sequelize.define(
  "CompetitiveRecord",
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
    categoryLabel: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: "category_label",
    },
    recordKind: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: "record_kind",
      validate: {
        isIn: [["speedrun", "score", "achievement"]],
      },
    },
    rankPosition: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "rank_position",
    },
    playerHandle: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "player_handle",
    },
    scoreDisplay: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: "score_display",
    },
    scoreRaw: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "score_raw",
    },
    achievedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "achieved_at",
    },
    sourceName: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: "source_name",
    },
    sourceUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "source_url",
    },
    observedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "observed_at",
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
    tableName: "competitive_records",
    timestamps: false,
    underscored: false,
  }
);

module.exports = CompetitiveRecord;
