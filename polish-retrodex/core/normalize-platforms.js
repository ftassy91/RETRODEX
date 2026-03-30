"use strict";

const aliases = require("../config/platform-aliases.json");
const { normalizeWhitespace } = require("./shared");

const PLATFORM_FAMILIES = [
  ["Game Boy", "Game Boy Color", "Game Boy Advance"],
  ["Mega Drive", "Genesis", "Sega CD", "Sega 32X"],
  ["NES", "Famicom", "Famicom Disk System"],
  ["SNES", "Super NES"],
  ["PC", "IBM PC"],
  ["PlayStation", "PlayStation 2", "PlayStation Portable"],
];

function resolveFamily(canonical) {
  const family = PLATFORM_FAMILIES.find((group) => group.includes(canonical));
  return family ? family[0] : canonical;
}

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
    family: resolveFamily(canonical),
    notes,
  };
}

module.exports = {
  normalizePlatform,
};
