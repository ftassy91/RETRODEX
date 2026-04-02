"use strict";

const { normalizeWhitespace } = require("./shared");

const ROMAN_MAP = {
  i: "1",
  ii: "2",
  iii: "3",
  iv: "4",
  v: "5",
  vi: "6",
  vii: "7",
  viii: "8",
  ix: "9",
  x: "10",
};

const NOISY_SUFFIXES = [
  /\bfull map\b/gi,
  /\bmap\b/gi,
  /\bsprite sheet\b/gi,
  /\bmanual\b/gi,
  /\bscan(s)?\b/gi,
  /\bending(s)?\b/gi,
  /\bscreenshot(s)?\b/gi,
  /\bgamepics\b/gi,
];

const TITLE_ALIAS_MAP = new Map([
  ["akumajo dracula x chi no rondo", "castlevania rondo of blood"],
  ["akumajo dracula 10 chi no rondo", "castlevania rondo of blood"],
  ["dracula x chi no rondo", "castlevania rondo of blood"],
  ["earthbound the war against giygas", "earthbound"],
  ["final fantasy 3", "final fantasy 6"],
]);

function normalizeRomanToken(token) {
  const compact = token.toLowerCase().replace(/\./g, "");
  return ROMAN_MAP[compact] || compact;
}

function normalizeTitle(rawTitle) {
  const notes = [];
  let working = normalizeWhitespace(rawTitle)
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, "\"")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const beforeSuffix = working;
  for (const pattern of NOISY_SUFFIXES) {
    working = working.replace(pattern, " ");
  }
  if (working !== beforeSuffix) {
    notes.push("stripped noisy suffix");
  }

  const beforePunctuation = working;
  working = working
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s:-]/g, " ")
    .replace(/[:\-]+/g, " ")
    .replace(/\bthe\b/g, "the")
    .replace(/\b(a|an)\b/g, "$1");
  if (working !== beforePunctuation) {
    notes.push("collapsed punctuation");
  }

  const tokens = normalizeWhitespace(working)
    .split(" ")
    .filter(Boolean)
    .map((token) => normalizeRomanToken(token));
  const normalized = tokens.join(" ");
  const aliased = TITLE_ALIAS_MAP.get(normalized) || normalized;

  if (aliased !== normalized) {
    notes.push(`applied title alias "${normalized}" -> "${aliased}"`);
  }

  if (aliased !== normalizeWhitespace(rawTitle).toLowerCase()) {
    notes.push("applied deterministic title normalization");
  }

  return {
    normalized: aliased,
    notes,
  };
}

module.exports = {
  normalizeTitle,
};
