const path = require("path");
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Op } = require("sequelize");

const { sequelize, storagePath, databaseMode, databaseTarget } = require("./database");
const Game = require("./models/Game");
const CollectionItem = require("./models/CollectionItem");
const Accessory = require("./models/Accessory");
const CommunityReport = require("../models/CommunityReport");
const RetrodexIndex = require("../models/RetrodexIndex");
const { syncGamesFromPrototype } = require("./syncGames");
const { handleAsync } = require("./helpers/query");

const baseRetrodexIndexSync = RetrodexIndex.sync.bind(RetrodexIndex);
RetrodexIndex.sync = (options = {}) => baseRetrodexIndexSync({
  ...options,
  alter: false,
}).catch(() => {});

// --- Model associations ---
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

// --- Route modules ---
const gamesRoutes = require("./routes/games");
const collectionRoutes = require("./routes/collection");
const consolesRoutes = require("./routes/consoles");
const statsRoutes = require("./routes/stats");
const syncRoutes = require("./routes/sync");

// --- App setup ---
const app = express();

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : "*",
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// --- Root / health ---
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

function parseItemsLimit(value, defaultValue = 20, maxValue = 100) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }
  return Math.min(parsed, maxValue);
}

function parseItemsOffset(value, defaultValue = 0) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return defaultValue;
  }
  return parsed;
}

function buildItemsWhere(query = {}) {
  const where = {};
  const titleQuery = String(query.q || "").trim();
  const platform = String(query.platform || "").trim();
  const rarity = String(query.rarity || "").trim();
  const type = String(query.type || "").trim();

  if (titleQuery) {
    where.title = {
      [Op.like]: `%${titleQuery}%`,
    };
  }

  if (platform) {
    where.console = platform;
  }

  if (rarity) {
    where.rarity = rarity;
  }

  if (type) {
    where.type = type;
  }

  return where;
}

function toItemPayload(game) {
  return {
    id: game.id,
    title: game.title,
    platform: game.console,
    year: game.year,
    genre: game.genre,
    rarity: game.rarity,
    type: game.type || "game",
    slug: game.slug || null,
    loosePrice: game.loosePrice,
    cibPrice: game.cibPrice,
    mintPrice: game.mintPrice,
  };
}

function toConsolePayload(game, gamesCount = 0) {
  return {
    id: game.id,
    title: game.title,
    platform: game.console,
    year: game.year,
    slug: game.slug || null,
    gamesCount,
  };
}

function normalizeOwnedCondition(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "cib") return "CIB";
  if (raw === "mint") return "Mint";
  return "Loose";
}

function toPriceNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getItemConditionValue(item) {
  const condition = normalizeOwnedCondition(item?.condition);
  const game = item?.game;

  if (!game) {
    return 0;
  }

  if (condition === "CIB") {
    return toPriceNumber(game.cibPrice);
  }

  if (condition === "Mint") {
    return toPriceNumber(game.mintPrice);
  }

  return toPriceNumber(game.loosePrice);
}

// --- Mount routes ---
app.use(gamesRoutes);
app.get("/api/items", handleAsync(async (req, res) => {
  const where = buildItemsWhere(req.query);
  const limit = parseItemsLimit(req.query.limit, 20, 100);
  const offset = parseItemsOffset(req.query.offset, 0);

  const total = await Game.count({ where });
  const items = await Game.findAll({
    where,
    order: [["title", "ASC"]],
    limit,
    offset,
  });

  res.json({
    ok: true,
    items: items.map(toItemPayload),
    total,
    limit,
    offset,
  });
}));
app.get("/api/items/:id", handleAsync(async (req, res) => {
  const lookup = String(req.params.id || "").trim();
  const item = await Game.findOne({
    where: {
      [Op.or]: [
        { id: lookup },
        { slug: lookup },
      ],
    },
  });

  if (!item) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }

  return res.json({
    ok: true,
    item: toItemPayload(item),
  });
}));
app.get("/api/consoles", handleAsync(async (_req, res) => {
  const consoles = await Game.findAll({
    where: { type: "console" },
    order: [["year", "ASC"], ["title", "ASC"]],
  });

  const counts = await Game.findAll({
    attributes: ["console"],
    where: {
      type: "game",
      console: {
        [Op.in]: consoles.map((item) => item.console),
      },
    },
  });

  const gamesByPlatform = new Map();
  for (const game of counts) {
    gamesByPlatform.set(game.console, (gamesByPlatform.get(game.console) || 0) + 1);
  }

  res.json({
    ok: true,
    consoles: consoles.map((item) => toConsolePayload(item, gamesByPlatform.get(item.console) || 0)),
    count: consoles.length,
  });
}));
app.get("/api/consoles/:id", handleAsync(async (req, res) => {
  const lookup = String(req.params.id || "").trim();
  const consoleItem = await Game.findOne({
    where: {
      type: "console",
      [Op.or]: [
        { id: lookup },
        { slug: lookup },
      ],
    },
  });

  if (!consoleItem) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }

  const games = await Game.findAll({
    where: {
      type: "game",
      console: consoleItem.console,
    },
    order: [["title", "ASC"]],
    limit: 20,
  });

  const accessories = await Accessory.findAll({
    where: {
      console_id: consoleItem.id,
    },
    order: [["name", "ASC"]],
    limit: 10,
  });

  return res.json({
    ok: true,
    console: toConsolePayload(consoleItem, games.length),
    games: games.map(toItemPayload),
    accessories: accessories.map((item) => ({
      id: item.id,
      name: item.name,
      accessory_type: item.accessory_type || null,
      slug: item.slug || null,
    })),
  });
}));
app.get("/api/accessories/types", handleAsync(async (_req, res) => {
  const accessories = await Accessory.findAll({
    attributes: ["accessory_type"],
    order: [["accessory_type", "ASC"]],
  });

  const types = Array.from(new Set(
    accessories
      .map((item) => item.accessory_type)
      .filter(Boolean)
  ));

  res.json({
    ok: true,
    types,
  });
}));
app.get("/api/accessories", handleAsync(async (_req, res) => {
  const accessories = await Accessory.findAll({
    order: [["name", "ASC"]],
  });

  const consoleIds = Array.from(new Set(
    accessories
      .map((item) => item.console_id)
      .filter(Boolean)
  ));

  const consoles = consoleIds.length
    ? await Game.findAll({
      attributes: ["id", "title"],
      where: {
        id: {
          [Op.in]: consoleIds,
        },
      },
    })
    : [];

  const consoleTitles = new Map(consoles.map((item) => [item.id, item.title]));

  res.json({
    ok: true,
    accessories: accessories.map((item) => ({
      id: item.id,
      name: item.name,
      console_id: item.console_id || null,
      console_title: item.console_id ? consoleTitles.get(item.console_id) || null : null,
      accessory_type: item.accessory_type || null,
      release_year: item.release_year || null,
      slug: item.slug || null,
    })),
    count: accessories.length,
  });
}));
app.get("/api/index/:id", handleAsync(async (req, res) => {
  const indexEntries = await RetrodexIndex.findAll({
    where: {
      item_id: req.params.id,
    },
    order: [["condition", "ASC"]],
  });

  res.json({
    ok: true,
    item_id: req.params.id,
    index: indexEntries.map((entry) => ({
      condition: entry.condition,
      index_value: entry.index_value,
      range_low: entry.range_low,
      range_high: entry.range_high,
      confidence_pct: entry.confidence_pct,
      trend: entry.trend,
      sources_editorial: entry.sources_editorial,
      last_sale_date: entry.last_sale_date,
    })),
  });
}));
app.post("/api/reports", handleAsync(async (req, res) => {
  const { item_id, condition, reported_price, context, date_estimated, text_raw } = req.body || {};
  const normalizedItemId = String(item_id || "").trim();
  const allowedConditions = ["Loose", "CIB", "Mint"];
  const normalizedPrice = Number(reported_price);
  const normalizedDate = date_estimated == null || date_estimated === "" ? null : String(date_estimated).trim();

  if (!normalizedItemId) {
    return res.status(400).json({
      ok: false,
      error: "item_id requis",
    });
  }

  if (!allowedConditions.includes(condition)) {
    return res.status(400).json({
      ok: false,
      error: "condition invalide: Loose, CIB ou Mint attendu",
    });
  }

  if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
    return res.status(400).json({
      ok: false,
      error: "reported_price doit être supérieur à 0",
    });
  }

  if (normalizedDate && !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    return res.status(400).json({
      ok: false,
      error: "date_estimated doit être au format YYYY-MM-DD ou null",
    });
  }

  const newReport = await CommunityReport.create({
    item_id: normalizedItemId,
    condition,
    reported_price: normalizedPrice,
    context: context || "autre",
    date_estimated: normalizedDate,
    sale_title: text_raw || null,
    user_id: "anonymous",
    user_trust_score: 0.40,
    is_editorial: false,
    report_confidence_score: 0.50,
  });

  return res.json({
    ok: true,
    id: newReport.id,
  });
}));
app.get("/api/collection/public", handleAsync(async (_req, res) => {
  const items = await CollectionItem.findAll({
    where: {
      list_type: "for_sale",
    },
    include: [{
      model: Game,
      as: "game",
      attributes: ["id", "title", "console", "year", "rarity"],
    }],
    order: [["gameId", "ASC"]],
  });

  const serializedItems = items
    .map((item) => ({
      id: item.gameId,
      gameId: item.gameId,
      condition: item.condition || "Loose",
      notes: item.notes || null,
      list_type: item.list_type || "for_sale",
      price_paid: item.price_paid ?? null,
      addedAt: item.addedAt || null,
      game: item.game ? {
        id: item.game.id,
        title: item.game.title,
        platform: item.game.console,
        console: item.game.console,
        year: item.game.year,
        rarity: item.game.rarity,
      } : null,
    }))
    .sort((left, right) => String(left.game?.title || left.gameId || "").localeCompare(String(right.game?.title || right.gameId || "")));

  res.json({
    ok: true,
    items: serializedItems,
    count: serializedItems.length,
  });
}));
app.use(collectionRoutes);
app.get("/api/collection/stats", handleAsync(async (_req, res) => {
  const items = await CollectionItem.findAll({
    where: {
      list_type: "owned",
    },
    include: [{
      model: Game,
      as: "game",
      attributes: ["id", "title", "console", "rarity", "loosePrice", "cibPrice", "mintPrice"],
    }],
    order: [["gameId", "ASC"]],
  });

  const ownedItems = items.filter((item) => item.game);
  const byPlatformMap = new Map();

  let totalLoose = 0;
  let totalCib = 0;
  let totalMint = 0;

  for (const item of ownedItems) {
    const platform = item.game.console || "Unknown";
    const condition = normalizeOwnedCondition(item.condition);
    const resolvedValue = getItemConditionValue(item);

    if (condition === "CIB") {
      totalCib += resolvedValue;
    } else if (condition === "Mint") {
      totalMint += resolvedValue;
    } else {
      totalLoose += resolvedValue;
    }

    if (!byPlatformMap.has(platform)) {
      byPlatformMap.set(platform, {
        platform,
        count: 0,
        total_loose: 0,
      });
    }

    const bucket = byPlatformMap.get(platform);
    bucket.count += 1;
    bucket.total_loose += resolvedValue;
  }

  const by_platform = Array.from(byPlatformMap.values())
    .map((entry) => ({
      platform: entry.platform,
      count: entry.count,
      total_loose: Math.round(entry.total_loose * 100) / 100,
    }))
    .sort((left, right) => left.platform.localeCompare(right.platform));

  const top5 = ownedItems
    .slice()
    .sort((left, right) => toPriceNumber(right.game?.loosePrice) - toPriceNumber(left.game?.loosePrice))
    .slice(0, 5)
    .map((item) => ({
      id: item.game.id,
      title: item.game.title,
      platform: item.game.console,
      loosePrice: toPriceNumber(item.game.loosePrice),
      rarity: item.game.rarity,
    }));

  res.json({
    ok: true,
    count: ownedItems.length,
    total_loose: Math.round(totalLoose * 100) / 100,
    total_cib: Math.round(totalCib * 100) / 100,
    total_mint: Math.round(totalMint * 100) / 100,
    confidence: "mixed",
    by_platform,
    top5,
  });
}));
app.use(consolesRoutes);
app.use(statsRoutes);
app.use(syncRoutes);

// --- Error handler ---
app.use((error, req, res, _next) => {
  console.error(`RetroDex backend request failed: ${req.method} ${req.originalUrl}`, error);

  if (res.headersSent) {
    return;
  }

  res.status(500).json({
    ok: false,
    error: "Internal server error",
  });
});

// --- Startup ---
async function startServer(portOverride) {
  await syncGamesFromPrototype();

  const PORT = Number(portOverride || process.env.PORT || 3000);

  return app.listen(PORT, () => {
    console.log(`RetroDex backend running on http://localhost:${PORT}`);
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
