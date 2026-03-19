const path = require("path");
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Op, col, fn, where: sqlWhere } = require("sequelize");

const { sequelize, storagePath, databaseMode, databaseTarget } = require("./database");
const Game = require("./models/Game");
const CollectionItem = require("./models/CollectionItem");
const { syncGamesFromPrototype } = require("./syncGames");

CollectionItem.belongsTo(Game, {
  foreignKey: "gameId",
  targetKey: "id",
  as: "game",
});

Game.hasMany(CollectionItem, {
  foreignKey: "gameId",
  sourceKey: "id",
  as: "collectionItems",
});

const app = express();

function handleAsync(handler) {
  return function asyncRoute(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function parseLimit(value, fallback = 20, max = 100) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function buildGameWhere(query) {
  const where = {};
  const filters = [];

  if (query.q) {
    filters.push(
      sqlWhere(fn("LOWER", col("title")), {
        [Op.like]: `%${String(query.q).trim().toLowerCase()}%`,
      })
    );
  }

  if (query.console) {
    where.console = query.console;
  }

  if (filters.length) {
    where[Op.and] = filters;
  }

  return where;
}

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

function normalizeCollectionPayload(body) {
  const gameId = String(body?.gameId ?? "").trim();
  const condition = String(body?.condition ?? "").trim();
  const notes = String(body?.notes ?? "").trim();

  return {
    gameId,
    condition: condition || null,
    notes: notes || null,
  };
}

async function findGameById(id) {
  return Game.findByPk(id);
}

function hashSeed(value) {
  let seed = 0;
  const text = String(value || "");

  for (let index = 0; index < text.length; index += 1) {
    seed = (seed * 31 + text.charCodeAt(index)) | 0;
  }

  return Math.abs(seed);
}

function nextSeed(seed) {
  return Math.imul(seed ^ (seed >>> 16), 0x45d9f3b) | 0;
}

function buildMonthLabels(totalMonths = 12, referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const labels = [];

  for (let offset = totalMonths - 1; offset >= 0; offset -= 1) {
    const current = new Date(Date.UTC(year, month - offset, 1));
    labels.push(`${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  return labels;
}

function generateHistory(currentPrice, gameId, priceType, monthLabels) {
  const safeCurrent = Math.max(1, Math.round(Number(currentPrice) || 0));
  const history = [];
  let seed = hashSeed(`${gameId}${priceType}`);
  let price = safeCurrent;

  history.unshift({
    month: monthLabels[monthLabels.length - 1],
    price: safeCurrent,
  });

  for (let index = monthLabels.length - 2; index >= 0; index -= 1) {
    seed = nextSeed(seed);
    const variation = ((Math.abs(seed) % 11) - 5) / 100;
    price = Math.round(price / (1 + variation));
    history.unshift({
      month: monthLabels[index],
      price: Math.max(1, price),
    });
  }

  return history;
}

function computeHistoryTrend(history) {
  if (!Array.isArray(history) || history.length === 0) {
    return "stable";
  }

  const oldest = Number(history[0]?.price) || 0;
  const current = Number(history[history.length - 1]?.price) || 0;

  if (current > oldest * 1.03) {
    return "up";
  }

  if (current < oldest * 0.97) {
    return "down";
  }

  return "stable";
}

function computePriceTrend(gameId, currentPrice) {
  const priceType = "mint";
  const str = `${gameId}${priceType}`;
  let seed = 0;

  for (let index = 0; index < str.length; index += 1) {
    seed = (seed * 31 + str.charCodeAt(index)) | 0;
  }

  seed = Math.abs(seed);

  let price = Math.max(1, Math.round(Number(currentPrice) || 0));
  for (let index = 0; index < 12; index += 1) {
    seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b) | 0;
    const variation = ((Math.abs(seed) % 11) - 5) / 100;
    price = Math.round(price / (1 + variation));
    price = Math.max(1, price);
  }

  const oldestPrice = price;
  const safeCurrentPrice = Math.max(1, Math.round(Number(currentPrice) || 0));

  if (safeCurrentPrice > oldestPrice * 1.03) {
    return "up";
  }

  if (safeCurrentPrice < oldestPrice * 0.97) {
    return "down";
  }

  return "stable";
}

function withGameTrend(game) {
  const plainGame = typeof game?.toJSON === "function" ? game.toJSON() : game;

  return {
    ...plainGame,
    trend: {
      mint: computePriceTrend(plainGame.id, plainGame.mintPrice),
    },
  };
}

function buildPriceHistoryPayload(game) {
  const monthLabels = buildMonthLabels(12);
  const looseHistory = generateHistory(game.loosePrice, game.id, "loose", monthLabels);
  const cibHistory = generateHistory(game.cibPrice, game.id, "cib", monthLabels);
  const mintHistory = generateHistory(game.mintPrice, game.id, "mint", monthLabels);

  return {
    gameId: game.id,
    title: game.title,
    currentPrices: {
      loose: Number(game.loosePrice) || 0,
      cib: Number(game.cibPrice) || 0,
      mint: Number(game.mintPrice) || 0,
    },
    history: monthLabels.map((month, index) => ({
      month,
      loose: looseHistory[index].price,
      cib: cibHistory[index].price,
      mint: mintHistory[index].price,
    })),
    trend: {
      loose: computeHistoryTrend(looseHistory),
      cib: computeHistoryTrend(cibHistory),
      mint: computeHistoryTrend(mintHistory),
    },
  };
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "RetroDex backend is running.",
    docs: "/home.html",
    consoles: "/consoles.html",
    gamesList: "/games-list.html",
    gameDetailExample: "/game-detail.html?id=tetris-game-boy",
    collection: "/collection.html",
    stats: "/stats.html",
    debug: "/debug.html",
    health: "/api/health",
  });
});

app.get("/api/health", handleAsync(async (_req, res) => {
  const games = await Game.count();

  res.json({
    ok: true,
    backend: "retrodex-express-sequelize",
    database: databaseMode,
    storage: databaseTarget || storagePath,
    games,
  });
}));

app.get("/games", handleAsync(async (req, res) => {
  const where = buildGameWhere(req.query);

  const query = {
    where,
    order: [["title", "ASC"]],
  };

  if (req.query.limit) {
    query.limit = parseLimit(req.query.limit);
  }

  const games = await Game.findAll(query);
  res.json(games);
}));

app.get("/games/:id", handleAsync(async (req, res) => {
  const game = await findGameById(req.params.id);

  if (!game) {
    return res.status(404).json({
      ok: false,
      error: "Game not found",
    });
  }

  return res.json(game);
}));

app.get("/collection", handleAsync(async (_req, res) => {
  const items = await CollectionItem.findAll({
    order: [["gameId", "ASC"]],
  });

  return res.json(items);
}));

app.post("/collection", handleAsync(async (req, res) => {
  const payload = normalizeCollectionPayload(req.body);

  if (!payload.gameId) {
    return res.status(400).json({
      ok: false,
      error: "gameId is required",
    });
  }

  const game = await findGameById(payload.gameId);

  if (!game) {
    return res.status(404).json({
      ok: false,
      error: "Game not found",
    });
  }

  const item = await CollectionItem.create(payload);
  return res.status(201).json(item);
}));

app.delete("/collection/:id", handleAsync(async (req, res) => {
  const item = await CollectionItem.findByPk(req.params.id);

  if (!item) {
    return res.status(404).json({
      ok: false,
      error: "Collection item not found",
    });
  }

  await item.destroy();
  return res.json({
    ok: true,
    deletedId: item.id,
  });
}));

app.get("/api/games", handleAsync(async (req, res) => {
  const limit = parseLimit(req.query.limit, 20, 1000);
  const where = buildGameWhere(req.query);
  const includeTrend = String(req.query.include_trend || "") === "1";

  const total = await Game.count({ where });
  const games = await Game.findAll({
    where,
    order: [["title", "ASC"]],
    limit,
  });

  res.json({
    items: includeTrend ? games.map(withGameTrend) : games,
    returned: games.length,
    total,
  });
}));

app.get("/api/games/random", handleAsync(async (req, res) => {
  const where = buildGameWhere(req.query);

  const count = await Game.count({ where });

  if (count === 0) {
    return res.status(404).json({
      ok: false,
      error: "No game found for the current filter",
    });
  }

  const offset = Math.floor(Math.random() * count);
  const items = await Game.findAll({
    where,
    order: [["title", "ASC"]],
    limit: 1,
    offset,
  });

  return res.json(items[0]);
}));

app.get("/api/games/:id", handleAsync(async (req, res) => {
  const game = await findGameById(req.params.id);

  if (!game) {
    return res.status(404).json({
      ok: false,
      error: "Game not found",
    });
  }

  return res.json(game);
}));

app.get("/api/games/:id/price-history", handleAsync(async (req, res) => {
  const game = await findGameById(req.params.id);

  if (!game) {
    return res.status(404).json({
      ok: false,
      error: "Game not found",
    });
  }

  return res.json(buildPriceHistoryPayload(game));
}));

app.get("/api/games/:id/summary", handleAsync(async (req, res) => {
  const game = await findGameById(req.params.id);

  if (!game) {
    return res.status(404).json({
      ok: false,
      error: "Game not found",
    });
  }

  return res.json({
    ok: true,
    item: toGameSummary(game),
  });
}));

app.get("/api/consoles", handleAsync(async (_req, res) => {
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

app.get("/api/collection", handleAsync(async (_req, res) => {
  const items = await CollectionItem.findAll({
    include: [
      {
        model: Game,
        as: "game",
        attributes: ["title", "console", "loosePrice", "mintPrice"],
      },
    ],
    order: [["gameId", "ASC"]],
  });

  return res.json({
    items: items.map((item) => ({
      id: item.gameId,
      gameId: item.gameId,
      game: item.game ? {
        title: item.game.title,
        console: item.game.console,
        loosePrice: item.game.loosePrice,
        mintPrice: item.game.mintPrice,
      } : null,
    })),
    total: items.length,
  });
}));

app.get("/api/stats", handleAsync(async (_req, res) => {
  const [games, collectionItems] = await Promise.all([
    Game.findAll({
      attributes: ["id", "console", "metascore", "loosePrice", "cibPrice", "mintPrice"],
      order: [["console", "ASC"], ["title", "ASC"]],
    }),
    CollectionItem.findAll({
      order: [["gameId", "ASC"]],
    }),
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

app.post("/api/collection", handleAsync(async (req, res) => {
  const payload = normalizeCollectionPayload(req.body);

  if (!payload.gameId) {
    return res.status(400).json({
      ok: false,
      error: "gameId is required",
    });
  }

  const game = await findGameById(payload.gameId);

  if (!game) {
    return res.status(404).json({
      ok: false,
      error: "Game not found",
    });
  }

  const item = await CollectionItem.create(payload);

  return res.status(201).json({
    ok: true,
    item,
  });
}));

app.delete("/api/collection/:id", handleAsync(async (req, res) => {
  const item = await CollectionItem.findByPk(req.params.id);

  if (!item) {
    return res.status(404).json({
      ok: false,
      error: "Collection item not found",
    });
  }

  await item.destroy();

  return res.json({
    ok: true,
    deletedId: item.id,
  });
}));

app.post("/api/sync", handleAsync(async (_req, res) => {
  const result = await syncGamesFromPrototype({ force: true });

  res.json({
    ok: true,
    ...result,
  });
}));

app.use((error, _req, res, _next) => {
  console.error("RetroDex backend request failed:", error);
  res.status(500).json({
    ok: false,
    error: "Internal server error",
  });
});

async function startServer(portOverride) {
  await syncGamesFromPrototype();

  const port = Number(portOverride || process.env.PORT || 3000);

  return app.listen(port, () => {
    console.log(`RetroDex backend running on http://localhost:${port}`);
  });
}

if (require.main === module) {
  startServer().catch(async (error) => {
    console.error("Unable to start RetroDex backend:", error);
    await sequelize.close();
    process.exit(1);
  });
}

module.exports = {
  app,
  startServer,
};
