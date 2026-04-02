"use strict";

const { extractFranchiseHints } = require("./extract-franchise");
const { normalizePlatform } = require("./normalize-platforms");
const { normalizeTitle } = require("./normalize-titles");
const {
  computeAliasScore,
  computeContextScore,
  computePlatformScore,
  computeTitleScore,
} = require("./score-matches");
const { buildScopedId, loadCanonicalGames, nowIso } = require("./shared");

function prepareCanonicalGame(game) {
  const title = normalizeTitle(game.title || game.name || game.slug || game.id || "");
  const platform = normalizePlatform(game.console || game.platform || "");
  const hints = extractFranchiseHints(game.title || game.name || "");
  return {
    ...game,
    title_normalized: title.normalized,
    platform_normalized: platform.normalized,
    franchise_normalized: hints.franchise_normalized,
  };
}

function prepareCanonicalCorpus() {
  return loadCanonicalGames()
    .map((game) => prepareCanonicalGame(game))
    .filter((game) => game.id && game.title_normalized);
}

function isAssetLabelOnly(titleNormalized) {
  return new Set([
    "manual",
    "front",
    "back",
    "cart",
    "maps",
    "map",
    "screens",
    "screen",
    "screenshots",
    "screenshot",
    "gamepics",
    "miscellaneous",
    "missions",
    "areas",
    "area",
    "ending",
    "endings",
  ]).has(String(titleNormalized || "").trim().toLowerCase());
}

function getEligibilityFailure(sourceRecord) {
  if (!sourceRecord.title_normalized) {
    return "Missing normalized title.";
  }

  if (!sourceRecord.platform_normalized) {
    return "Missing normalized platform.";
  }

  if (isAssetLabelOnly(sourceRecord.title_normalized)) {
    return "Rejected asset-label-only title.";
  }

  if (sourceRecord.source_context?.review_rejected === true) {
    return "Rejected by source-specific filtering.";
  }

  if (/\bseries\b/i.test(String(sourceRecord.title_raw || "")) && sourceRecord.source_name === "vgmuseum") {
    return "Rejected ambiguous series-level title.";
  }

  return null;
}

function scoreCandidate(sourceRecord, game) {
  const titleScore = computeTitleScore(sourceRecord.title_normalized, game.title_normalized);
  const platformScore = computePlatformScore(sourceRecord.platform_normalized, game.platform_normalized);
  const aliasScore = computeAliasScore(sourceRecord, game);
  const contextScore = computeContextScore(sourceRecord, game);
  const matchScore = titleScore + platformScore + aliasScore + contextScore;

  let matchStatus = "rejected";
  if (matchScore >= 90) {
    matchStatus = "auto_matched";
  } else if (matchScore >= 75) {
    matchStatus = "needs_review";
  }

  return {
    game_id: game.id,
    title_score: titleScore,
    platform_score: platformScore,
    alias_score: aliasScore,
    context_score: contextScore,
    match_score: matchScore,
    match_status: matchStatus,
    match_reason: `${sourceRecord.title_normalized} -> ${game.title_normalized} (${matchScore}/100)`,
    review_required: matchStatus === "needs_review",
  };
}

function matchSourceRecord(sourceRecord, corpus) {
  const eligibilityFailure = getEligibilityFailure(sourceRecord);
  if (eligibilityFailure) {
    return {
      match_id: buildScopedId("match", [sourceRecord.source_record_id, "ineligible"]),
      source_record_id: sourceRecord.source_record_id,
      game_id: null,
      match_score: 0,
      match_status: "rejected",
      match_reason: eligibilityFailure,
      title_score: 0,
      platform_score: 0,
      alias_score: 0,
      context_score: 0,
      review_required: false,
      scored_at: nowIso(),
      candidates: [],
    };
  }

  const ranked = corpus
    .map((game) => scoreCandidate(sourceRecord, game))
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 5);

  const best = ranked[0] || null;
  if (!best) {
    return {
      match_id: buildScopedId("match", [sourceRecord.source_record_id, "none"]),
      source_record_id: sourceRecord.source_record_id,
      game_id: null,
      match_score: 0,
      match_status: "rejected",
      match_reason: "No canonical candidate available.",
      title_score: 0,
      platform_score: 0,
      alias_score: 0,
      context_score: 0,
      review_required: false,
      scored_at: nowIso(),
      candidates: [],
    };
  }

  return {
    match_id: buildScopedId("match", [sourceRecord.source_record_id, best.game_id || "none"]),
    source_record_id: sourceRecord.source_record_id,
    game_id: best.game_id,
    match_score: best.match_score,
    match_status: best.match_status,
    match_reason: best.match_reason,
    title_score: best.title_score,
    platform_score: best.platform_score,
    alias_score: best.alias_score,
    context_score: best.context_score,
    review_required: best.review_required,
    scored_at: nowIso(),
    candidates: ranked,
  };
}

module.exports = {
  matchSourceRecord,
  prepareCanonicalCorpus,
};
