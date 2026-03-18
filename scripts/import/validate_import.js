#!/usr/bin/env node
"use strict";

const { getImportStats, validateGames } = require("./import-module");

function main() {
  const validation = validateGames();
  const stats = getImportStats();
  const pass = (
    validation.total >= 507 &&
    validation.missing_title === 0 &&
    validation.missing_genre === 0 &&
    validation.missing_summary === 0 &&
    validation.duplicates === 0 &&
    stats.genre_pct === 100 &&
    stats.summary_pct === 100 &&
    stats.price_pct === 100
  );

  console.log(`Total games: ${validation.total}`);
  console.log(`Genre coverage: ${stats.genre_pct}%`);
  console.log(`Summary coverage: ${stats.summary_pct}%`);
  console.log(`Price coverage: ${stats.price_pct}%`);
  console.log(`Duplicates: ${validation.duplicates}`);
  console.log(`Status: ${pass ? "PASS" : "FAIL"}`);

  if (!pass) {
    process.exit(1);
  }
}

main();
