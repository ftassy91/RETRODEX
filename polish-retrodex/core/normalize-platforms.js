"use strict";

const aliases = require("../config/platform-aliases.json");
const { normalizeWhitespace } = require("./shared");

function normalizePlatform(rawPlatform) {
  const raw = normalizeWhitespace(rawPlatform);
  const key = raw.toLowerCase();
  const canonical = aliases[key] || raw;
  const notes = [];

  if (canonical !== raw) {
    notes.push(`mapped alias "${raw}" -> "${canonical}"`);
  }

  return {
    normalized: canonical,
    notes,
  };
}

module.exports = {
  normalizePlatform,
};
