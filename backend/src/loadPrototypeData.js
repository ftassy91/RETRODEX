const fs = require("fs");
const path = require("path");

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadPrototypeData() {
  const projectRoot = path.resolve(__dirname, "..", "..");
  const dataRoot = path.join(projectRoot, "prototype_v2", "data");

  const catalog = readJsonFile(path.join(dataRoot, "catalog.json"));
  const entries = readJsonFile(path.join(dataRoot, "entries.json"));
  const prices = readJsonFile(path.join(dataRoot, "prices.json"));

  const priceByGameId = new Map(prices.map((item) => [item.game, item]));

  return catalog.map((game) => {
    const editorial = entries[game.id] || {};
    const story = editorial.story || {};
    const pricing = priceByGameId.get(game.id) || {};

    return {
      id: game.id,
      title: game.title,
      console: game.console,
      year: game.year ?? null,
      developer: game.developer ?? null,
      genre: editorial.genre ?? null,
      metascore: game.metascore ?? null,
      rarity: game.rarity ?? null,
      summary: editorial.summary ?? story.synopsis ?? null,
      loosePrice: pricing.loose ?? null,
      cibPrice: pricing.cib ?? null,
      mintPrice: pricing.mint ?? null,
    };
  });
}

module.exports = {
  loadPrototypeData,
};

