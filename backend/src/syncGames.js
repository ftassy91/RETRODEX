const { databaseMode, sequelize } = require("./database");
const Game = require("./models/Game");
const { loadPrototypeData } = require("./loadPrototypeData");

async function syncGamesFromPrototype(options = {}) {
  const force = options.force === true;
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
