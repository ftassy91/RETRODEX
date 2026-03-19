const { Router } = require("express");
const Game = require("../models/Game");
const CollectionItem = require("../models/CollectionItem");
const { handleAsync } = require("../helpers/query");

const router = Router();

router.get("/api/stats", handleAsync(async (_req, res) => {
  const [games, collectionItems] = await Promise.all([
    Game.findAll({
      attributes: ["id", "console", "metascore", "loosePrice", "cibPrice", "mintPrice"],
      order: [["console", "ASC"], ["title", "ASC"]],
    }),
    CollectionItem.findAll({ order: [["gameId", "ASC"]] }),
  ]);

  const gamesById = new Map(games.map((game) => [game.id, game]));
  const collectionByConsole = new Map();
  const catalogueByConsole = new Map();
  let pricedGames = 0;
  let metascoreSum = 0;
  let metascoreCount = 0;

  for (const game of games) {
    const consoleName = game.console || "Unknown";
    catalogueByConsole.set(consoleName, (catalogueByConsole.get(consoleName) || 0) + 1);

    if ([game.loosePrice, game.cibPrice, game.mintPrice].some((price) => Number(price) > 0)) {
      pricedGames += 1;
    }

    if (Number.isFinite(Number(game.metascore))) {
      metascoreSum += Number(game.metascore);
      metascoreCount += 1;
    }
  }

  for (const item of collectionItems) {
    const game = gamesById.get(item.gameId);
    const consoleName = game?.console || "Unknown";
    collectionByConsole.set(consoleName, (collectionByConsole.get(consoleName) || 0) + 1);
  }

  return res.json({
    ok: true,
    totals: {
      games: games.length,
      consoles: catalogueByConsole.size,
      pricedGames,
      averageMetascore: metascoreCount ? Number((metascoreSum / metascoreCount).toFixed(1)) : 0,
    },
    topConsoles: Array.from(catalogueByConsole.entries())
      .map(([name, gamesCount]) => ({ name, gamesCount }))
      .sort((left, right) => right.gamesCount - left.gamesCount || left.name.localeCompare(right.name)),
  });
}));

module.exports = router;
