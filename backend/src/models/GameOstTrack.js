const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const GameOstTrack = sequelize.define(
  "GameOstTrack",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    ostId: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: "ost_id",
    },
    trackNumber: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "track_number",
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    composerPersonId: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "composer_person_id",
    },
    durationSeconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "duration_seconds",
    },
    sourceRecordId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "source_record_id",
    },
    confidence: {
      type: DataTypes.FLOAT,
      defaultValue: 0.5,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
  },
  {
    tableName: "game_ost_tracks",
    timestamps: false,
    underscored: false,
  }
);

module.exports = GameOstTrack;
