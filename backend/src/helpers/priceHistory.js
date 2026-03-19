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
  const labels = buildMonthLabels(12);
  const history = generateHistory(currentPrice, gameId, "mint", labels);
  return computeHistoryTrend(history);
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

module.exports = {
  buildPriceHistoryPayload,
  computePriceTrend,
  withGameTrend,
};
