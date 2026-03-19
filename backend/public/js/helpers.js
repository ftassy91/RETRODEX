(function attachRetroDexHelpers(globalScope) {
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

  function computeTrend(gameId, currentPrice, priceType) {
    const type = String(priceType || "mint");
    let seed = hashSeed(`${gameId}${type}`);
    let price = Math.max(1, Math.round(Number(currentPrice) || 0));

    for (let index = 0; index < 12; index += 1) {
      seed = nextSeed(seed);
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

  globalScope.computeTrend = computeTrend;
})(typeof window !== "undefined" ? window : globalThis);
