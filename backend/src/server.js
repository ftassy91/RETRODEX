const path = require("path");
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { sequelize, storagePath, databaseMode, databaseTarget } = require("./database");
const Game = require("./models/Game");
const CollectionItem = require("./models/CollectionItem");
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

// --- Mount routes ---
app.use(gamesRoutes);
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
