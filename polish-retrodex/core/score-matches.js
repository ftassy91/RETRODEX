"use strict";

function levenshtein(a, b) {
  const aa = String(a || "");
  const bb = String(b || "");
  const matrix = Array.from({ length: aa.length + 1 }, () => Array(bb.length + 1).fill(0));

  for (let i = 0; i <= aa.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= bb.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= aa.length; i += 1) {
    for (let j = 1; j <= bb.length; j += 1) {
      const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[aa.length][bb.length];
}

function normalizedLevenshtein(a, b) {
  const longest = Math.max(String(a || "").length, String(b || "").length);
  if (!longest) {
    return 1;
  }
  return 1 - (levenshtein(a, b) / longest);
}

function tokenSimilarity(a, b) {
  const tokensA = new Set(String(a || "").split(" ").filter(Boolean));
  const tokensB = new Set(String(b || "").split(" ").filter(Boolean));
  if (!tokensA.size && !tokensB.size) {
    return 1;
  }
  const intersection = [...tokensA].filter((token) => tokensB.has(token)).length;
  const union = new Set([...tokensA, ...tokensB]).size || 1;
  return intersection / union;
}

function computeTitleScore(sourceTitle, gameTitle) {
  const tokenScore = tokenSimilarity(sourceTitle, gameTitle);
  const levenshteinScore = normalizedLevenshtein(sourceTitle, gameTitle);
  return Math.round(60 * ((0.7 * tokenScore) + (0.3 * levenshteinScore)));
}

function computePlatformScore(sourcePlatform, gamePlatform) {
  if (!sourcePlatform || !gamePlatform) {
    return 0;
  }
  if (sourcePlatform === gamePlatform) {
    return 25;
  }

  const families = [
    ["Game Boy", "Game Boy Color"],
    ["Mega Drive", "Genesis"],
    ["PC", "IBM PC"],
  ];

  const sameFamily = families.some((family) => family.includes(sourcePlatform) && family.includes(gamePlatform));
  return sameFamily ? 20 : 0;
}

function computeAliasScore(sourceRecord, game) {
  let score = 0;
  if (
    sourceRecord.franchise_normalized
    && game.franchise_normalized
    && sourceRecord.franchise_normalized === game.franchise_normalized
  ) {
    score += 5;
  }

  if (
    sourceRecord.edition_hint
    && game.title_normalized
    && game.title_normalized.includes(String(sourceRecord.edition_hint).toLowerCase())
  ) {
    score += 3;
  }

  if (
    sourceRecord.region_hint
    && typeof game.title === "string"
    && game.title.toLowerCase().includes(String(sourceRecord.region_hint).toLowerCase())
  ) {
    score += 2;
  }

  return Math.min(score, 10);
}

function computeContextScore(sourceRecord, game) {
  let score = 0;
  const context = JSON.stringify(sourceRecord.source_context || {}).toLowerCase();
  const contentType = String(sourceRecord.content_type || sourceRecord.content_type_normalized || "").toLowerCase();
  const assetType = String(
    sourceRecord.asset_type_guess
    || sourceRecord.asset_type
    || sourceRecord.source_context?.asset_type
    || ""
  ).toLowerCase();

  if (sourceRecord.source_name === "vgmaps" && (contentType === "game_map_asset" || context.includes("map"))) {
    score += 5;
  } else if (
    sourceRecord.source_name === "vgmuseum"
    && (context.includes("ending") || ["sprite_sheet", "scan", "screenshot", "manual"].includes(assetType))
  ) {
    score += assetType === "scan" || assetType === "screenshot" ? 3 : 5;
  } else if (sourceRecord.source_name === "pixel_warehouse") {
    score += 3;
  }

  if (
    sourceRecord.platform_normalized
    && game.console
    && String(game.console).toLowerCase().includes(String(sourceRecord.platform_normalized).toLowerCase())
  ) {
    score = Math.max(score, 4);
  }

  return Math.min(score, 5);
}

module.exports = {
  computeAliasScore,
  computeContextScore,
  computePlatformScore,
  computeTitleScore,
  normalizedLevenshtein,
  tokenSimilarity,
};
