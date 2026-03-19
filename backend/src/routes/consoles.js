const { Router } = require("express");
const Game = require("../models/Game");
const { handleAsync } = require("../helpers/query");

const router = Router();

router.get("/api/consoles", handleAsync(async (_req, res) => {
  const games = await Game.findAll({
    attributes: ["console"],
    order: [["console", "ASC"], ["title", "ASC"]],
  });

  const counts = new Map();
  for (const game of games) {
    counts.set(game.console, (counts.get(game.console) || 0) + 1);
  }

  res.json({
    items: Array.from(counts.entries()).map(([name, gamesCount]) => ({
      name,
      gamesCount,
    })),
  });
}));

module.exports = router;
