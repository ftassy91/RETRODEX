const { Router } = require("express");
const Game = require("../models/Game");
const CollectionItem = require("../models/CollectionItem");
const { handleAsync } = require("../helpers/query");

const router = Router();

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

// --- Simple routes (/collection) ---

router.get("/collection", handleAsync(async (_req, res) => {
  const items = await CollectionItem.findAll({ order: [["gameId", "ASC"]] });
  return res.json(items);
}));

router.post("/collection", handleAsync(async (req, res) => {
  const payload = normalizeCollectionPayload(req.body);

  if (!payload.gameId) {
    return res.status(400).json({ ok: false, error: "gameId is required" });
  }

  const game = await Game.findByPk(payload.gameId);

  if (!game) {
    return res.status(404).json({ ok: false, error: "Game not found" });
  }

  const existing = await CollectionItem.findByPk(payload.gameId);
  if (existing) {
    return res.status(409).json({ ok: false, error: "Game is already in your collection" });
  }

  const item = await CollectionItem.create(payload);
  return res.status(201).json(item);
}));

router.delete("/collection/:id", handleAsync(async (req, res) => {
  const item = await CollectionItem.findByPk(req.params.id);

  if (!item) {
    return res.status(404).json({ ok: false, error: "Collection item not found" });
  }

  await item.destroy();
  return res.json({ ok: true, deletedId: item.id });
}));

// --- API routes (/api/collection, includes game data) ---

router.get("/api/collection", handleAsync(async (_req, res) => {
  const items = await CollectionItem.findAll({
    include: [{
      model: Game,
      as: "game",
      attributes: ["title", "console", "loosePrice", "mintPrice"],
    }],
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

router.post("/api/collection", handleAsync(async (req, res) => {
  const payload = normalizeCollectionPayload(req.body);

  if (!payload.gameId) {
    return res.status(400).json({ ok: false, error: "gameId is required" });
  }

  const game = await Game.findByPk(payload.gameId);

  if (!game) {
    return res.status(404).json({ ok: false, error: "Game not found" });
  }

  const existing = await CollectionItem.findByPk(payload.gameId);
  if (existing) {
    return res.status(409).json({ ok: false, error: "Game is already in your collection" });
  }

  const item = await CollectionItem.create(payload);

  return res.status(201).json({ ok: true, item });
}));

router.delete("/api/collection/:id", handleAsync(async (req, res) => {
  const item = await CollectionItem.findByPk(req.params.id);

  if (!item) {
    return res.status(404).json({ ok: false, error: "Collection item not found" });
  }

  await item.destroy();

  return res.json({ ok: true, deletedId: item.id });
}));

module.exports = router;
