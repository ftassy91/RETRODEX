const fs = require("fs/promises");
const path = require("path");

const LOOKUP_TABLES = require("../../data/lookup_tables.json");

const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";
const TWITCH_OAUTH_ENDPOINT = "https://id.twitch.tv/oauth2/token";
const IGDB_GAMES_ENDPOINT = "https://api.igdb.com/v4/games";
const WIKIDATA_RATE_LIMIT_MS = 1500;

let lastWikidataRequestAt = 0;
let igdbTokenCache = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function slugify(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getPlatformName(platformName) {
  const normalized = normalizeText(platformName);
  return LOOKUP_TABLES.platform_aliases[normalized] || normalized;
}

function getWikidataPlatformId(platformName) {
  const canonical = getPlatformName(platformName);
  return LOOKUP_TABLES.wikidata_platform_ids[canonical] || null;
}

function getIgdbPlatformId(platformName) {
  const canonical = getPlatformName(platformName);
  return LOOKUP_TABLES.igdb_platform_ids[canonical] || null;
}

async function waitForWikidataSlot() {
  const now = Date.now();
  const remaining = WIKIDATA_RATE_LIMIT_MS - (now - lastWikidataRequestAt);
  if (remaining > 0) {
    await sleep(remaining);
  }
  lastWikidataRequestAt = Date.now();
}

function extractWikidataValue(binding, key) {
  return binding?.[key]?.value ?? null;
}

function extractIgdbDeveloper(game) {
  const companies = Array.isArray(game?.involved_companies) ? game.involved_companies : [];
  const developer = companies.find((company) => company?.developer && company?.company?.name);
  return developer?.company?.name || null;
}

function extractIgdbGenre(game) {
  const genres = Array.isArray(game?.genres) ? game.genres : [];
  return genres.find((genre) => normalizeText(genre?.name))?.name || null;
}

function extractIgdbYear(game) {
  const releaseDates = Array.isArray(game?.release_dates) ? game.release_dates : [];
  const value = releaseDates.find((releaseDate) => Number.isFinite(releaseDate?.y))?.y;
  return Number.isFinite(value) ? value : null;
}

function extractIgdbCoverUrl(game) {
  const url = normalizeText(game?.cover?.url);
  if (!url) {
    return null;
  }
  if (url.startsWith("//")) {
    return `https:${url}`;
  }
  return url;
}

async function fetchFromWikidata(platformName, limit = 25, offset = 0) {
  const canonicalPlatform = getPlatformName(platformName);
  const platformId = getWikidataPlatformId(canonicalPlatform);

  if (!platformId) {
    console.warn(`[fetch_raw] No Wikidata platform id found for "${platformName}"`);
    return [];
  }

  await waitForWikidataSlot();

  const sparql = `
SELECT ?game ?gameLabel ?year ?devLabel ?genreLabel WHERE {
  ?game wdt:P31 wd:Q7889 .
  ?game wdt:P400 wd:${platformId} .
  OPTIONAL { ?game wdt:P577 ?date . BIND(YEAR(?date) AS ?year) }
  OPTIONAL { ?game wdt:P178 ?dev }
  OPTIONAL { ?game wdt:P136 ?genre }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
}
LIMIT ${Number(limit) || 25}
OFFSET ${Number(offset) || 0}
  `.trim();

  const url = new URL(WIKIDATA_ENDPOINT);
  url.searchParams.set("query", sparql);
  url.searchParams.set("format", "json");

  const response = await fetch(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "RetroDex/1.0 (retrogaming database)",
    },
  });

  if (!response.ok) {
    throw new Error(`Wikidata request failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const bindings = Array.isArray(payload?.results?.bindings) ? payload.results.bindings : [];

  return bindings.map((binding) => ({
    name: extractWikidataValue(binding, "gameLabel"),
    platform: canonicalPlatform,
    year: extractWikidataValue(binding, "year") ? Number(extractWikidataValue(binding, "year")) : null,
    developer: extractWikidataValue(binding, "devLabel"),
    genre: extractWikidataValue(binding, "genreLabel"),
    _source: "wikidata",
  }));
}

async function getIgdbAccessToken() {
  const clientId = normalizeText(process.env.IGDB_CLIENT_ID);
  const clientSecret = normalizeText(process.env.IGDB_CLIENT_SECRET);

  if (!clientId || !clientSecret) {
    console.warn("[fetch_raw] IGDB credentials missing: set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET");
    return null;
  }

  if (igdbTokenCache && igdbTokenCache.expiresAt > Date.now() + 60_000) {
    return igdbTokenCache;
  }

  const oauthUrl = new URL(TWITCH_OAUTH_ENDPOINT);
  oauthUrl.searchParams.set("client_id", clientId);
  oauthUrl.searchParams.set("client_secret", clientSecret);
  oauthUrl.searchParams.set("grant_type", "client_credentials");

  const response = await fetch(oauthUrl, { method: "POST" });
  if (!response.ok) {
    throw new Error(`IGDB OAuth failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  igdbTokenCache = {
    clientId,
    accessToken: payload.access_token,
    expiresAt: Date.now() + (Number(payload.expires_in) || 0) * 1000,
  };

  return igdbTokenCache;
}

async function fetchFromIGDB(platformName, limit = 25, offset = 0) {
  const canonicalPlatform = getPlatformName(platformName);
  const platformId = getIgdbPlatformId(canonicalPlatform);

  if (!platformId) {
    console.warn(`[fetch_raw] No IGDB platform id found for "${platformName}"`);
    return [];
  }

  const token = await getIgdbAccessToken();
  if (!token) {
    return [];
  }

  const query = [
    "fields name,release_dates.y,involved_companies.company.name,involved_companies.developer,genres.name,summary,cover.url;",
    `where platforms = (${platformId});`,
    `limit ${Number(limit) || 25};`,
    `offset ${Number(offset) || 0};`,
  ].join(" ");

  const response = await fetch(IGDB_GAMES_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Client-ID": token.clientId,
      Authorization: `Bearer ${token.accessToken}`,
    },
    body: query,
  });

  if (!response.ok) {
    throw new Error(`IGDB request failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const games = Array.isArray(payload) ? payload : [];

  return games.map((game) => ({
    name: normalizeText(game?.name),
    platform: canonicalPlatform,
    year: extractIgdbYear(game),
    developer: extractIgdbDeveloper(game),
    genre: extractIgdbGenre(game),
    summary: normalizeText(game?.summary) || null,
    cover_url: extractIgdbCoverUrl(game),
    _source: "igdb",
  }));
}

async function saveRaw(records, entityType) {
  const normalizedEntityType = slugify(entityType) || "records";
  const targetDir = path.join(__dirname, "..", "..", "data", "raw", normalizedEntityType);
  await fs.mkdir(targetDir, { recursive: true });

  let saved = 0;
  let skipped = 0;

  for (const record of Array.isArray(records) ? records : []) {
    const slug = slugify(`${record?.name || ""} ${record?.platform || ""}`);
    if (!slug) {
      skipped += 1;
      continue;
    }

    const filePath = path.join(targetDir, `${slug}.json`);
    await fs.writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    saved += 1;
  }

  return { saved, skipped };
}

module.exports = {
  fetchFromWikidata,
  fetchFromIGDB,
  saveRaw,
};

if (require.main === module) {
  const lt = require("../../data/lookup_tables.json");
  console.log("[TEST] Platforms disponibles:", lt.platforms.slice(0, 3));
  console.log("[TEST] fetch_raw.js chargé correctement");
}
