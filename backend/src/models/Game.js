const { DataTypes } = require("sequelize");
const { sequelize } = require("../database");

const Game = sequelize.define(
  "Game",
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: { msg: "Title cannot be empty" },
      },
    },
    console: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: { msg: "Console cannot be empty" },
      },
    },
    // FK — replaces console STRING in Sprint 1
    consoleId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        isInt: { msg: "Year must be an integer" },
        min: { args: [1970], msg: "Year must be 1970 or later" },
        max: { args: [2010], msg: "Year must be 2010 or earlier" },
      },
    },
    developer: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    developerId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "// FK → companies.id",
    },
    publisherId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "// FK → companies.id",
    },
    genre: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    metascore: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    rarity: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    synopsis: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tagline: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cover_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    franch_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    dev_anecdotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    dev_team: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cheat_codes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    type: {
      type: DataTypes.STRING,
      defaultValue: "game",
      comment: "game | console | accessory | ost | collector_edition",
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      comment: "auto-generated from title + id on first save",
    },
    source_confidence: {
      type: DataTypes.FLOAT,
      defaultValue: 0.5,
      comment: "0.0 à 1.0 — fiabilité de la source",
    },
    loosePrice: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "loose_price",
    },
    cibPrice: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "cib_price",
    },
    mintPrice: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: "mint_price",
    },
    coverImage: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "URL or local path to cover image",
    },
    releaseDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "Precise release date — more specific than year",
    },
    barcode: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Physical barcode for collection scanning",
    },
    // Enrichment - Sprint 5 & 6
    lore: { type: DataTypes.TEXT, allowNull: true },
    gameplay_description: { type: DataTypes.TEXT, allowNull: true },
    characters: { type: DataTypes.TEXT, allowNull: true },
    versions: { type: DataTypes.TEXT, allowNull: true },
    manual_url: { type: DataTypes.TEXT, allowNull: true },
    youtube_id: { type: DataTypes.TEXT, allowNull: true },
    youtube_verified: { type: DataTypes.BOOLEAN, allowNull: true },
    archive_id: { type: DataTypes.TEXT, allowNull: true },
    archive_verified: { type: DataTypes.BOOLEAN, allowNull: true },
    ost_composers: { type: DataTypes.TEXT, allowNull: true },
    ost_notable_tracks: { type: DataTypes.TEXT, allowNull: true },
    avg_duration_main: { type: DataTypes.FLOAT, allowNull: true },
    avg_duration_complete: { type: DataTypes.FLOAT, allowNull: true },
    speedrun_wr: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: "games",
    timestamps: false,
    underscored: false,
  }
);

Game.addHook("beforeCreate", (game) => {
  if (!game.slug) {
    const base = game.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    game.slug = `${base}-${game.id}`;
  }
});

module.exports = Game;
