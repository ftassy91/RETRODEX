const { DataTypes, QueryTypes } = require("sequelize");
const { databaseMode, postgresSchema, sequelize } = require("./database");
const Game = require("./models/Game");
const CollectionItem = require("./models/CollectionItem");
const { loadPrototypeData } = require("./loadPrototypeData");

async function ensureCollectionItemColumns() {
  const queryInterface = sequelize.getQueryInterface();
  let columns = await queryInterface.describeTable("collection_items").catch(() => null);

  if (!columns) {
    await CollectionItem.sync({ alter: true });
    columns = await queryInterface.describeTable("collection_items");
  }

  const hasIdentityColumns = Boolean(columns.gameId || columns.game_id) && Boolean(columns.addedAt || columns.added_at);
  if (!hasIdentityColumns) {
    const [countRow] = await sequelize.query("SELECT COUNT(*) AS count FROM collection_items", {
      type: QueryTypes.SELECT,
    });
    const rowCount = Number(countRow?.count || 0);

    if (rowCount > 0) {
      throw new Error("collection_items schema is malformed and contains data; manual migration required.");
    }

    await queryInterface.dropTable("collection_items");
    await CollectionItem.sync({ alter: true });
    columns = await queryInterface.describeTable("collection_items");
  }

  await CollectionItem.sync({ alter: true });
  columns = await queryInterface.describeTable("collection_items");

  if (!columns.condition) {
    await queryInterface.addColumn("collection_items", "condition", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "Loose",
    });
  }

  if (!columns.notes) {
    await queryInterface.addColumn("collection_items", "notes", {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    });
  }
}

async function syncGamesFromPrototype(options = {}) {
  const force = options.force === true;

  if (databaseMode === "postgres" && postgresSchema) {
    try {
      await sequelize.createSchema(postgresSchema);
    } catch (error) {
      const code = error?.original?.code || error?.parent?.code || "";
      const message = String(error?.message || "");
      if (code !== "42P06" && !/already exists/i.test(message)) {
        throw error;
      }
    }
  }

  await sequelize.sync({ alter: true });
  await ensureCollectionItemColumns();
  const existing = await Game.count();

  if (existing > 0 && !force) {
    return {
      imported: 0,
      existing,
      skipped: true,
      total: existing,
    };
  }

  const games = loadPrototypeData();

  const transaction = await sequelize.transaction();

  try {
    if (force) {
      await Game.destroy({ where: {}, transaction });
    }

    await Game.bulkCreate(games, { transaction });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  return {
    imported: games.length,
    existing,
    skipped: false,
    total: games.length,
  };
}

module.exports = {
  syncGamesFromPrototype,
};
