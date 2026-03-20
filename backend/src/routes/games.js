const { Router } = require("express");
const Game = require("../models/Game");
const { handleAsync, parseLimit, buildGameWhere } = require("../helpers/query");
const { withGameTrend, buildPriceHistoryPayload } = require("../helpers/priceHistory");

const router = Router();

function toGameSummary(game) {
  return {
    id: game.id,
    title: game.title,
    console: game.console,
    year: game.year,
    genre: game.genre,
    developer: game.developer,
    metascore: game.metascore,
    rarity: game.rarity,
    summary: game.summary,
    prices: {
      loose: game.loosePrice,
      cib: game.cibPrice,
      mint: game.mintPrice,
    },
  };
}

async function findGameById(id) {
  return Game.findByPk(id);
}

// --- Simple routes (/games) ---

router.get("/games", handleAsync(async (req, res) => {
  const where = buildGameWhere(req.query);
  const query = { where, order: [["title", "ASC"]] };

  if (req.query.limit) {
    query.limit = parseLimit(req.query.limit);
  }

  const games = await Game.findAll(query);
  res.json(games);
}));

router.get("/games/:id", handleAsync(async (req, res) => {
  const game = await findGameById(req.params.id);

  if (!game) {
    return res.status(404).json({ ok: false, error: "Game not found" });
  }

  return res.json(game);
}));

// --- API routes (/api/games) ---

router.get("/api/games", handleAsync(async (req, res) => {
  const limit = parseLimit(req.query.limit, 20, 1000);
  const where = buildGameWhere(req.query);
  const includeTrend = String(req.query.include_trend || "") === "1";

  const total = await Game.count({ where });
  const games = await Game.findAll({ where, order: [["title", "ASC"]], limit });

  res.json({
    items: includeTrend ? games.map(withGameTrend) : games,
    returned: games.length,
    total,
  });
}));

router.get("/api/games/random", handleAsync(async (req, res) => {
  const where = buildGameWhere(req.query);
  const count = await Game.count({ where });

  if (count === 0) {
    return res.status(404).json({ ok: false, error: "No game found for the current filter" });
  }

  const offset = Math.floor(Math.random() * count);
  const items = await Game.findAll({ where, order: [["title", "ASC"]], limit: 1, offset });

  if (!items.length) {
    return res.status(404).json({ ok: false, error: "No game found for the current filter" });
  }

  return res.json(items[0]);
}));

router.get("/api/games/:id", handleAsync(async (req, res) => {
  const game = await findGameById(req.params.id);

  if (!game) {
    return res.status(404).json({ ok: false, error: "Game not found" });
  }

  return res.json(game);
}));

router.get("/api/games/:id/price-history", handleAsync(async (req, res) => {
  const game = await findGameById(req.params.id);

  if (!game) {
    return res.status(404).json({ ok: false, error: "Game not found" });
  }

  return res.json(buildPriceHistoryPayload(game));
}));

router.get("/api/games/:id/summary", handleAsync(async (req, res) => {
  const game = await findGameById(req.params.id);

  if (!game) {
    return res.status(404).json({ ok: false, error: "Game not found" });
  }

  return res.json({ ok: true, item: toGameSummary(game) });
}));

module.exports = router;
