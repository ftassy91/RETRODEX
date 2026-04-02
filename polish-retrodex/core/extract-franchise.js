"use strict";

const { normalizeWhitespace } = require("./shared");

const REGION_MATCHERS = [
  { pattern: /\b\(j\)|\bjpn\b|\bjapan\b/i, region: "JP" },
  { pattern: /\b\(u\)|\busa\b|\bus\b/i, region: "US" },
  { pattern: /\b\(e\)|\beu\b|\beurope\b/i, region: "EU" },
  { pattern: /\bworldwide\b|\bww\b/i, region: "WW" },
];

function extractFranchiseHints(rawTitle) {
  const title = normalizeWhitespace(rawTitle);
  const notes = [];
  const episodeMatch = title.match(/\b([0-9]{1,2})\b/);
  const romanEpisodeMatch = title.match(/\b(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b/i);
  const region = REGION_MATCHERS.find((entry) => entry.pattern.test(title))?.region || null;
  const edition = /\b(beta|prototype|demo|unlicensed|director'?s cut|special edition)\b/i.exec(title)?.[1] || null;

  let franchise = title;
  franchise = franchise
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\b(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b/gi, " ")
    .replace(/[:\-].*$/, " ")
    .replace(/\b(beta|prototype|demo|unlicensed|director'?s cut|special edition)\b/gi, " ");
  franchise = normalizeWhitespace(franchise);

  if (franchise && franchise !== title) {
    notes.push("derived franchise hint from title");
  }
  if (region) {
    notes.push(`detected region ${region}`);
  }
  if (edition) {
    notes.push(`detected edition hint ${edition}`);
  }

  return {
    franchise_normalized: franchise || null,
    episode_hint: episodeMatch?.[1] || romanEpisodeMatch?.[1]?.toUpperCase() || null,
    region_hint: region,
    edition_hint: edition,
    notes,
  };
}

module.exports = {
  extractFranchiseHints,
};
