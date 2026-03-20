const path = require("path");
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { sequelize, storagePath, databaseMode, databaseTarget } = require("./database");
const Game = require("./models/Game");
const CollectionItem = require("./models/CollectionItem");
const RetrodexIndex = require("../models/RetrodexIndex");
const { syncGamesFromPrototype } = require("./syncGames");
const { handleAsync } = require("./helpers/query");

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
