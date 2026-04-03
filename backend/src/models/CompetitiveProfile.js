const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const CompetitiveProfile = sequelize.define(
  "CompetitiveProfile",
  {
    gameId: {
      type: DataTypes.TEXT,
      primaryKey: true,
      field: "game_id",
    },
    isSpeedrunRelevant: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_speedrun_relevant",
    },
    isScoreAttackRelevant: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_score_attack_relevant",
    },
    isAchievementRelevant: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_achievement_relevant",
    },
    sourceName: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "source_name",
    },
    sourceUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "source_url",
    },
    freshnessCheckedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "freshness_checked_at",
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
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "updated_at",
    },
  },
  {
    tableName: "competitive_profiles",
    timestamps: false,
    underscored: false,
  }
);

module.exports = CompetitiveProfile;
