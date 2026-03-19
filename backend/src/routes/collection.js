const { Router } = require("express");
const Game = require("../models/Game");
const CollectionItem = require("../models/CollectionItem");
const { handleAsync } = require("../helpers/query");

const router = Router();

const VALID_COLLECTION_CONDITIONS = new Set(["Loose", "CIB", "Mint"]);

function normalizeCollectionCondition(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "Loose";
  }

  const upper = raw.toUpperCase();
  if (upper === "LOOSE") return "Loose";
  if (upper === "CIB") return "CIB";
  if (upper === "MINT") return "Mint";
  return null;
}

function normalizeCollectionPayload(body) {
  const gameId = String(body?.gameId ?? "").trim();
  const condition = normalizeCollectionCondition(body?.condition);
  const notes = String(body?.notes ?? "").trim();

  return {
    gameId,
    condition,
    notes: notes || null,
  };
}

function serializeCollectionItem(item) {
  const condition = normalizeCollectionCondition(item?.condition) || "Loose";

  return {
    id: item?.gameId,
    gameId: item?.gameId,
    condition,
    notes: item?.notes || null,
    addedAt: item?.addedAt || null,
    game: item?.game ? {
      id: item.game.id,
      title: item.game.title,
      console: item.game.console,
      platform: item.game.console,
      year: item.game.year,
      image: item.game.image || null,
      rarity: item.game.rarity,
      loosePrice: item.game.loosePrice,
      cibPrice: item.game.cibPrice,
      mintPrice: item.game.mintPrice,
    } : null,
  };
}

const GAME_INCLUDE = [{
  model: Game,
  as: "game",
  attributes: ["id", "title", "console", "year", "rarity", "loosePrice", "cibPrice", "mintPrice"],
}];

async function listCollectionItems() {
  const items = await CollectionItem.findAll({
    include: GAME_INCLUDE,
    order: [["gameId", "ASC"]],
  });

  return items
    .map(serializeCollectionItem)
    .sort((left, right) => String(left.game?.title || left.gameId || "").localeCompare(String(right.game?.title || right.gameId || "")));
}

// --- Simple routes (/collection) ---

router.get("/collection", handleAsync(async (_req, res) => {
  const items = await listCollectionItems();
  return res.json(items);
}));

router.post("/collection", handleAsync(async (req, res) => {
  const payload = normalizeCollectionPayload(req.body);

  if (!payload.gameId) {
    return res.status(400).json({ ok: false, error: "gameId is required" });
  }

  if (!VALID_COLLECTION_CONDITIONS.has(payload.condition)) {
    return res.status(400).json({ ok: false, error: "condition must be one of Loose, CIB or Mint" });
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
  const created = await CollectionItem.findByPk(item.gameId, { include: GAME_INCLUDE });
  return res.status(201).json(serializeCollectionItem(created));
}));

router.delete("/collection/:id", handleAsync(async (req, res) => {
  const item = await CollectionItem.findByPk(req.params.id);

  if (!item) {
    return res.status(404).json({ ok: false, error: "Collection item not found" });
  }

  await item.destroy();
  return res.json({ ok: true, deletedId: item.gameId });
}));

// --- API routes (/api/collection, includes game data) ---

router.get("/api/collection", handleAsync(async (_req, res) => {
  const items = await listCollectionItems();

  return res.json({
    items,
    total: items.length,
  });
}));

router.post("/api/collection", handleAsync(async (req, res) => {
  const payload = normalizeCollectionPayload(req.body);

  if (!payload.gameId) {
    return res.status(400).json({ ok: false, error: "gameId is required" });
  }

  if (!VALID_COLLECTION_CONDITIONS.has(payload.condition)) {
    return res.status(400).json({ ok: false, error: "condition must be one of Loose, CIB or Mint" });
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
  const created = await CollectionItem.findByPk(item.gameId, { include: GAME_INCLUDE });

  return res.status(201).json({
    ok: true,
    item: serializeCollectionItem(created),
  });
}));

router.delete("/api/collection/:id", handleAsync(async (req, res) => {
  const item = await CollectionItem.findByPk(req.params.id);

  if (!item) {
    return res.status(404).json({ ok: false, error: "Collection item not found" });
  }

  await item.destroy();

  return res.json({ ok: true, deletedId: item.gameId });
}));

module.exports = router;
