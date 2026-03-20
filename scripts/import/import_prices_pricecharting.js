"use strict";

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_DB_PATH = path.join(ROOT, "backend", "storage", "retrodex.sqlite");
const API_BASE_URL = "https://www.pricecharting.com/api";
const REQUEST_DELAY_MS = 1100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadEnvFiles() {
  const env = {};
  const envPaths = [
    path.join(ROOT, ".env"),
    path.join(ROOT, "backend", ".env"),
  ];

  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) {
      continue;
    }

    const lines = fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim().replace(/^"(.*)"$/, "$1");
      if (key && !(key in env)) {
        env[key] = value;
      }
    }
  }

  return env;
}

function getEnv(name, envCache) {
  return process.env[name] || envCache[name] || "";
}

function getDatabasePath(envCache) {
  const configuredPath = getEnv("RETRODEX_SQLITE_PATH", envCache) || DEFAULT_DB_PATH;
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(ROOT, configuredPath);
}

function getApiKey(envCache) {
  return getEnv("PRICECHARTING_API_KEY", envCache).trim();
}

function openDatabase(dbPath, options = {}) {
  return new DatabaseSync(dbPath, options);
}

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    dryRun: args.has("--dry-run"),
    resume: args.has("--resume"),
  };
}

function formatPrice(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `$${number.toFixed(2)}` : "n/a";
}

function centsToDollars(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }
  return Number((number / 100).toFixed(2));
}

function escapeQueryPart(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function buildQuery(game) {
  return `${escapeQueryPart(game.title)} ${escapeQueryPart(game.platform)}`.trim();
}

function normalizeProductsPayload(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.products)) {
    return payload.products;
  }

  if (Array.isArray(payload?.results)) {
    return payload.results;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
}

function extractPrices(product) {
  const loosePrice = centsToDollars(product?.["loose-price"] ?? product?.loose_price ?? product?.loosePrice);
  const cibPrice = centsToDollars(product?.["cib-price"] ?? product?.cib_price ?? product?.cibPrice);
  const mintRaw =
    product?.["sealed-price"] ??
    product?.sealed_price ??
    product?.sealedPrice ??
    product?.["new-price"] ??
    product?.new_price ??
    product?.newPrice ??
    product?.["complete-price"] ??
    product?.complete_price ??
    product?.completePrice;
  const mintPrice = centsToDollars(mintRaw);

  return {
    loosePrice,
    cibPrice,
    mintPrice,
  };
}

function hasAtLeastOnePrice(prices) {
  return [prices.loosePrice, prices.cibPrice, prices.mintPrice].some((value) => Number.isFinite(value));
}

function createRateLimitedRequester(apiKey) {
  let lastRequestAt = 0;

  return async function requestJson(url) {
    const now = Date.now();
    const elapsed = now - lastRequestAt;
    if (elapsed < REQUEST_DELAY_MS) {
      await sleep(REQUEST_DELAY_MS - elapsed);
    }

    const requestUrl = new URL(url);
    requestUrl.searchParams.set("t", apiKey);

    const response = await fetch(requestUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `Token ${apiKey}`,
      },
    });

    lastRequestAt = Date.now();

    if (!response.ok) {
      throw new Error(`API error ${response.status}`);
    }

    const payload = await response.json();
    if (payload?.error) {
      throw new Error(`API error ${payload.error}`);
    }

    return payload;
  };
}

async function fetchBestMatch(game, requestJson) {
  const query = buildQuery(game);
  const searchUrl = new URL(`${API_BASE_URL}/products`);
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("status", "price");

  const searchPayload = await requestJson(searchUrl);
  const products = normalizeProductsPayload(searchPayload);
  if (!products.length) {
    return null;
  }

  const firstProduct = products[0];
  const directPrices = extractPrices(firstProduct);
  if (hasAtLeastOnePrice(directPrices)) {
    return {
      product: firstProduct,
      prices: directPrices,
    };
  }

  const productId = firstProduct.id || firstProduct.productId || firstProduct.product_id;
  if (!productId) {
    return null;
  }

  const detailUrl = new URL(`${API_BASE_URL}/product`);
  detailUrl.searchParams.set("id", String(productId));

  const detailPayload = await requestJson(detailUrl);
  const prices = extractPrices(detailPayload);
  if (!hasAtLeastOnePrice(prices)) {
    return null;
  }

  return {
    product: detailPayload,
    prices,
  };
}

function selectGames(db, options) {
  const baseSql = `
    SELECT
      id,
      title,
      console AS platform,
      loose_price AS loosePrice,
      cib_price AS cibPrice,
      mint_price AS mintPrice
    FROM games
    WHERE mint_price IS NULL
    ORDER BY title ASC
  `;

  if (options.dryRun) {
    return db.prepare(`${baseSql} LIMIT 5`).all();
  }

  return db.prepare(baseSql).all();
}

function updateGamePrices(db, gameId, prices) {
  db.prepare(`
    UPDATE games
    SET loose_price = ?, cib_price = ?, mint_price = ?
    WHERE id = ?
  `).run(
    prices.loosePrice,
    prices.cibPrice,
    prices.mintPrice,
    gameId,
  );
}

function verify(db) {
  const countRow = db.prepare(`
    SELECT COUNT(*) AS count
    FROM games
    WHERE mint_price > 0
  `).get();

  const statsRow = db.prepare(`
    SELECT
      MIN(mint_price) AS minMint,
      MAX(mint_price) AS maxMint,
      AVG(mint_price) AS avgMint
    FROM games
    WHERE mint_price > 0
  `).get();

  const topFive = db.prepare(`
    SELECT title, mint_price AS mintPrice
    FROM games
    WHERE mint_price > 0
    ORDER BY mint_price DESC, title ASC
    LIMIT 5
  `).all();

  console.log("");
  console.log("[VERIFY] COUNT mintPrice > 0:", countRow.count);
  console.log(
    "[VERIFY] MIN/MAX/AVG Mint:",
    `${formatPrice(statsRow.minMint)} / ${formatPrice(statsRow.maxMint)} / ${formatPrice(statsRow.avgMint)}`
  );
  console.log("[VERIFY] TOP 5 MINT:");
  topFive.forEach((row, index) => {
    console.log(`  ${index + 1}. ${row.title} — ${formatPrice(row.mintPrice)}`);
  });
}

async function main() {
  const options = parseArgs(process.argv);
  const envCache = loadEnvFiles();
  const apiKey = getApiKey(envCache);
  const dbPath = getDatabasePath(envCache);

  if (!apiKey) {
    throw new Error("PRICECHARTING_API_KEY is missing. Set it in the environment or in .env.");
  }

  const db = openDatabase(dbPath);
  const games = selectGames(db, options);
  const requestJson = createRateLimitedRequester(apiKey);

  console.log(`Using DB: ${dbPath}`);
  console.log(`Mode: ${options.dryRun ? "dry-run" : options.resume ? "resume" : "full import"}`);
  console.log(`Games to process: ${games.length}`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const game of games) {
    try {
      const match = await fetchBestMatch(game, requestJson);
      if (!match) {
        skipped += 1;
        console.log(`[SKIP] ${game.title} — no match found`);
        continue;
      }

      const prices = match.prices;
      if (!hasAtLeastOnePrice(prices)) {
        skipped += 1;
        console.log(`[SKIP] ${game.title} — no usable price found`);
        continue;
      }

      if (!options.dryRun) {
        updateGamePrices(db, game.id, prices);
      }

      updated += 1;
      console.log(
        `[OK]  ${game.title} — Loose: ${formatPrice(prices.loosePrice)} / CIB: ${formatPrice(prices.cibPrice)} / Mint: ${formatPrice(prices.mintPrice)}`
      );
    } catch (error) {
      errors += 1;
      console.log(`[ERR] ${game.title} — ${error.message}`);
    }
  }

  console.log("");
  console.log(`Total: ${games.length} | Mis à jour: ${updated} | Skip: ${skipped} | Erreurs: ${errors}`);

  if (!options.dryRun) {
    verify(db);
  }
}

main().catch((error) => {
  console.error(`[FATAL] ${error.message}`);
  process.exit(1);
});
