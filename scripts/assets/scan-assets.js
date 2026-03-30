#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");

const DEFAULT_GAMES_CANDIDATES = [
  path.join(ROOT, "data", "exports", "games_export.json"),
  path.join(ROOT, "frontend", "data", "entries.json"),
  path.join(ROOT, "frontend", "data", "catalog.json"),
  path.join(ROOT, "data", "games.json"),
];

const DEFAULT_ASSET_DIRS = {
  generated_gb: [
    path.join(ROOT, "assets", "generated_gb"),
    path.join(ROOT, "frontend", "assets", "generated_gb"),
    path.join(ROOT, "RETRODEXseedV0", "prototype_v0", "assets", "generated_gb"),
  ],
  covers: [
    path.join(ROOT, "RETRODEXseedV0", "prototype_v0", "assets", "covers"),
  ],
  notices: [
    path.join(ROOT, "assets", "notices"),
    path.join(ROOT, "frontend", "assets", "notices"),
    path.join(ROOT, "RETRODEXseedV0", "prototype_v0", "assets", "notices"),
    path.join(ROOT, "RETRODEXseedV0", "prototype_v0", "assets", "manuals"),
    path.join(ROOT, "backend", "public", "assets", "manuals"),
  ],
};

const DEFAULT_EXTENSIONS = {
  generated_gb: [".png", ".jpg", ".jpeg", ".webp"],
  covers: [".png", ".jpg", ".jpeg", ".webp"],
  notices: [".pdf", ".png", ".jpg", ".jpeg", ".webp"],
};

const STATUS_PRIORITY = {
  approved: 4,
  plain: 3,
  retry: 2,
  reject: 1,
  unknown: 0,
};

function parseArgs(argv) {
  const options = {
    outputJson: false,
    missingOnly: false,
    verbose: false,
    noReport: false,
    gamesFile: null,
    reportFile: path.join(ROOT, "logs", "audit", "asset-scan-report.json"),
    types: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      options.outputJson = true;
      continue;
    }
    if (arg === "--missing-only") {
      options.missingOnly = true;
      continue;
    }
    if (arg === "--verbose") {
      options.verbose = true;
      continue;
    }
    if (arg === "--no-report") {
      options.noReport = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--games") {
      index += 1;
      if (index >= argv.length) {
        fatal("Missing value after --games");
      }
      options.gamesFile = resolveCliPath(argv[index]);
      continue;
    }
    if (arg === "--report") {
      index += 1;
      if (index >= argv.length) {
        fatal("Missing value after --report");
      }
      options.reportFile = resolveCliPath(argv[index]);
      continue;
    }
    if (arg === "--types") {
      index += 1;
      if (index >= argv.length) {
        fatal("Missing value after --types");
      }
      options.types = argv[index]
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      continue;
    }

    fatal(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log("RETRODEX Asset Scanner");
  console.log("");
  console.log("Usage:");
  console.log("  node scan-assets.js [options]");
  console.log("  node scripts/assets/scan-assets.js [options]");
  console.log("");
  console.log("Options:");
  console.log("  --json           Print machine-readable JSON to stdout");
  console.log("  --missing-only   Show only incomplete games");
  console.log("  --verbose        Print incomplete game details in text mode");
  console.log("  --games <path>   Override the games JSON source");
  console.log("  --report <path>  Override the JSON report output file");
  console.log("  --types <list>   Comma-separated asset types to scan");
  console.log("  --no-report      Skip writing the JSON report file");
  console.log("  --help           Show this help");
}

function resolveCliPath(value) {
  if (!value) {
    return value;
  }
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(process.cwd(), value);
}

function resolveGamesFile(explicitPath) {
  if (explicitPath) {
    if (!fs.existsSync(explicitPath)) {
      fatal(`Games file not found: ${explicitPath}`);
    }
    return explicitPath;
  }

  for (const candidate of DEFAULT_GAMES_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  fatal(`No games JSON found. Checked: ${DEFAULT_GAMES_CANDIDATES.join(", ")}`);
}

function loadGames(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));

  if (Array.isArray(raw)) {
    return raw;
  }
  if (Array.isArray(raw.games)) {
    return raw.games;
  }
  if (Array.isArray(raw.data)) {
    return raw.data;
  }
  if (Array.isArray(raw.results)) {
    return raw.results;
  }
  if (raw.entries && Array.isArray(raw.entries)) {
    return raw.entries;
  }
  if (raw.entries && typeof raw.entries === "object") {
    return Object.values(raw.entries);
  }

  const firstArray = Object.values(raw).find(Array.isArray);
  if (firstArray) {
    return firstArray;
  }

  fatal(`Unsupported games JSON shape in ${filePath}`);
}

function getAssetTypes(selectedTypes) {
  const allTypes = Object.keys(DEFAULT_ASSET_DIRS);
  if (!selectedTypes || !selectedTypes.length) {
    return allTypes;
  }

  const invalid = selectedTypes.filter((type) => !allTypes.includes(type));
  if (invalid.length) {
    fatal(`Unsupported asset type(s): ${invalid.join(", ")}`);
  }

  return selectedTypes;
}

function scanAssetType(typeName, directories, extensions) {
  const index = new Map();
  const info = {
    type: typeName,
    directories: directories.slice(),
    foundDirectories: [],
    missingDirectories: [],
    scannedFiles: 0,
    uniqueKeys: 0,
  };

  for (const directory of directories) {
    if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
      info.missingDirectories.push(directory);
      continue;
    }

    info.foundDirectories.push(directory);
    walkFiles(directory, (fullPath, relativePath) => {
      const ext = path.extname(fullPath).toLowerCase();
      if (!extensions.includes(ext)) {
        return;
      }

      const parsed = path.parse(fullPath);
      const rawBase = parsed.name;
      const key = normalizeKey(rawBase);
      if (!key) {
        return;
      }

      const entry = {
        key,
        status: detectStatus(rawBase),
        filename: parsed.base,
        basename: rawBase,
        ext,
        fullPath,
        relativePath,
        mtimeMs: safeMtime(fullPath),
      };

      if (!index.has(key)) {
        index.set(key, []);
      }
      index.get(key).push(entry);
      info.scannedFiles += 1;
    });
  }

  info.uniqueKeys = index.size;
  return { info, index };
}

function walkFiles(rootDir, visit) {
  const pending = [rootDir];
  while (pending.length) {
    const current = pending.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      visit(fullPath, path.relative(rootDir, fullPath));
    }
  }
}

function detectStatus(baseName) {
  const lower = String(baseName || "").toLowerCase();
  if (lower.startsWith("approved__")) {
    return "approved";
  }
  if (lower.startsWith("retry__")) {
    return "retry";
  }
  if (lower.startsWith("reject__")) {
    return "reject";
  }
  return "plain";
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(approved|retry|reject)__+/i, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeMtime(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function firstPresent(object, keys, fallback) {
  for (const key of keys) {
    const value = object[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return fallback;
}

function buildCandidateKeys(game) {
  const id = firstPresent(game, ["id", "slug", "game_id", "canonical_id"], "");
  const name = firstPresent(game, ["title", "name", "game"], "");
  const consoleName = firstPresent(game, ["console", "platform", "system"], "");
  const idKey = normalizeKey(id);
  const nameKey = normalizeKey(name);
  const consoleKey = normalizeKey(consoleName);

  const candidates = new Set();
  if (idKey) {
    candidates.add(idKey);
  }
  if (nameKey) {
    candidates.add(nameKey);
  }
  if (name && consoleName && consoleKey && !nameKey.endsWith(consoleKey)) {
    candidates.add(normalizeKey(`${name}-${consoleName}`));
    candidates.add(normalizeKey(`${name} ${consoleName}`));
  }
  if (id && consoleName && consoleKey && idKey && !idKey.endsWith(consoleKey)) {
    candidates.add(normalizeKey(`${id}-${consoleName}`));
  }

  return [...candidates];
}

function chooseBest(entries) {
  if (!entries || !entries.length) {
    return null;
  }

  const sorted = entries.slice().sort((left, right) => {
    const leftPriority = STATUS_PRIORITY[left.status] ?? STATUS_PRIORITY.unknown;
    const rightPriority = STATUS_PRIORITY[right.status] ?? STATUS_PRIORITY.unknown;
    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }
    if (left.mtimeMs !== right.mtimeMs) {
      return right.mtimeMs - left.mtimeMs;
    }
    if (left.relativePath.length !== right.relativePath.length) {
      return left.relativePath.length - right.relativePath.length;
    }
    return left.fullPath.localeCompare(right.fullPath);
  });

  return {
    best: sorted[0],
    alternates: sorted.slice(1),
  };
}

function matchAsset(game, assetIndex) {
  const candidateKeys = buildCandidateKeys(game);
  for (const candidateKey of candidateKeys) {
    if (!assetIndex.has(candidateKey)) {
      continue;
    }
    const selection = chooseBest(assetIndex.get(candidateKey));
    if (selection) {
      return {
        candidateKey,
        ...selection,
      };
    }
  }
  return null;
}

function mapResults(games, assetCatalogs, assetTypes) {
  return games.map((game) => {
    const id = firstPresent(game, ["id", "slug", "game_id", "canonical_id"], null);
    const name = firstPresent(game, ["title", "name", "game"], "(unnamed)");
    const consoleName = firstPresent(game, ["console", "platform", "system"], "unknown");
    const assets = {};

    for (const type of assetTypes) {
      const match = matchAsset(game, assetCatalogs[type].index);
      assets[type] = match
        ? {
            present: true,
            candidateKey: match.candidateKey,
            file: match.best.filename,
            path: match.best.fullPath,
            relativePath: match.best.relativePath,
            status: match.best.status,
            alternates: match.alternates.length,
          }
        : {
            present: false,
            candidateKey: null,
            file: null,
            path: null,
            relativePath: null,
            status: null,
            alternates: 0,
          };
    }

    const assetValues = Object.values(assets);
    const complete = assetValues.every((asset) => asset.present);
    const partial = !complete && assetValues.some((asset) => asset.present);
    const missing = assetValues.every((asset) => !asset.present);

    return {
      id,
      name,
      console: consoleName,
      candidateKeys: buildCandidateKeys(game),
      assets,
      complete,
      partial,
      missing,
    };
  });
}

function buildSummary(results, assetCatalogs, assetTypes, gamesFile) {
  const total = results.length;
  const complete = results.filter((row) => row.complete).length;
  const partial = results.filter((row) => row.partial).length;
  const missing = results.filter((row) => row.missing).length;

  const byConsole = {};
  for (const result of results) {
    const consoleName = result.console || "unknown";
    if (!byConsole[consoleName]) {
      byConsole[consoleName] = { total: 0, complete: 0, partial: 0, missing: 0 };
    }
    byConsole[consoleName].total += 1;
    if (result.complete) {
      byConsole[consoleName].complete += 1;
    } else if (result.partial) {
      byConsole[consoleName].partial += 1;
    } else {
      byConsole[consoleName].missing += 1;
    }
  }

  const byType = {};
  for (const type of assetTypes) {
    const present = results.filter((row) => row.assets[type] && row.assets[type].present).length;
    const duplicates = results.filter((row) => row.assets[type] && row.assets[type].alternates > 0).length;
    byType[type] = {
      present,
      missing: total - present,
      duplicates,
      scannedFiles: assetCatalogs[type].info.scannedFiles,
      uniqueKeys: assetCatalogs[type].info.uniqueKeys,
      foundDirectories: assetCatalogs[type].info.foundDirectories,
      missingDirectories: assetCatalogs[type].info.missingDirectories,
    };
  }

  return {
    scannedAt: new Date().toISOString(),
    gamesFile,
    total,
    complete,
    partial,
    missing,
    byType,
    byConsole,
  };
}

function buildOutput(gamesFile, results, summary, options) {
  const filteredResults = options.missingOnly ? results.filter((row) => !row.complete) : results;
  const incomplete = results
    .filter((row) => !row.complete)
    .map((row) => ({
      id: row.id,
      name: row.name,
      console: row.console,
      missing: Object.entries(row.assets)
        .filter(([, asset]) => !asset.present)
        .map(([type]) => type),
    }));

  return {
    scannedAt: summary.scannedAt,
    gamesFile,
    summary,
    results: filteredResults,
    incomplete,
  };
}

function printText(output, assetTypes, options) {
  const summary = output.summary;
  console.log("");
  console.log("RETRODEX Asset Scanner");
  console.log(`Games file: ${output.gamesFile}`);
  console.log(`Games loaded: ${summary.total}`);

  for (const type of assetTypes) {
    const typeSummary = summary.byType[type];
    console.log(
      `${pad(type, 12)} files=${String(typeSummary.scannedFiles).padStart(5)} keys=${String(typeSummary.uniqueKeys).padStart(5)} dirs=${typeSummary.foundDirectories.length}`,
    );
    for (const missingDirectory of typeSummary.missingDirectories) {
      console.log(`  warn: missing directory ignored: ${missingDirectory}`);
    }
  }

  console.log("");
  console.log("----------------------------------------");
  console.log("SUMMARY");
  console.log("----------------------------------------");
  console.log(`Total games : ${summary.total}`);
  console.log(`Complete    : ${padNumber(summary.complete)} (${pct(summary.complete, summary.total)})`);
  console.log(`Partial     : ${padNumber(summary.partial)} (${pct(summary.partial, summary.total)})`);
  console.log(`Missing     : ${padNumber(summary.missing)} (${pct(summary.missing, summary.total)})`);

  console.log("");
  console.log("BY ASSET TYPE");
  for (const type of assetTypes) {
    const typeSummary = summary.byType[type];
    const bar = progressBar(typeSummary.present, summary.total, 20);
    const duplicateNote = typeSummary.duplicates ? ` dup=${typeSummary.duplicates}` : "";
    console.log(
      `${pad(type, 12)} ${bar} ${typeSummary.present}/${summary.total} (${pct(typeSummary.present, summary.total)})${duplicateNote}`,
    );
  }

  console.log("");
  console.log("BY CONSOLE");
  const consoleRows = Object.entries(summary.byConsole).sort((left, right) => right[1].total - left[1].total);
  for (const [consoleName, stats] of consoleRows) {
    const bar = progressBar(stats.complete, stats.total, 15);
    console.log(
      `${pad(consoleName, 30)} ${bar} ${stats.complete}/${stats.total} complete partial=${stats.partial} missing=${stats.missing}`,
    );
  }

  const incomplete = output.results.filter((row) => !row.complete);
  if (incomplete.length && (options.verbose || options.missingOnly)) {
    console.log("");
    console.log("----------------------------------------");
    console.log(`INCOMPLETE GAMES (${incomplete.length})`);
    console.log("----------------------------------------");
    for (const result of incomplete) {
      const flags = assetTypes
        .map((type) => `${result.assets[type].present ? "OK" : "MISS"} ${type}`)
        .join("  ");
      console.log(
        `[${String(result.id ?? "").padEnd(42)}] ${pad(result.name, 42)} ${pad(result.console, 24)} ${flags}`,
      );
    }
  } else if (incomplete.length && !options.outputJson) {
    console.log("");
    console.log(`Run with --missing-only or --verbose to list the ${incomplete.length} incomplete games.`);
  }
}

function writeReport(reportFile, output) {
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, JSON.stringify(output, null, 2));
}

function progressBar(value, total, width) {
  const filled = total ? Math.round((value / total) * width) : 0;
  return `[${"#".repeat(filled)}${"-".repeat(Math.max(0, width - filled))}]`;
}

function pct(value, total) {
  return total ? `${Math.round((value / total) * 100)}%` : "0%";
}

function pad(value, width) {
  return String(value || "").slice(0, width).padEnd(width);
}

function padNumber(value) {
  return String(value).padStart(5);
}

function fatal(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return;
  }

  const gamesFile = resolveGamesFile(options.gamesFile);
  const games = loadGames(gamesFile);
  if (!games.length) {
    fatal(`No games found in ${gamesFile}`);
  }

  const assetTypes = getAssetTypes(options.types);
  const assetCatalogs = {};
  for (const type of assetTypes) {
    assetCatalogs[type] = scanAssetType(type, DEFAULT_ASSET_DIRS[type], DEFAULT_EXTENSIONS[type] || [".png"]);
  }

  const results = mapResults(games, assetCatalogs, assetTypes);
  const summary = buildSummary(results, assetCatalogs, assetTypes, gamesFile);
  const output = buildOutput(gamesFile, results, summary, options);

  if (options.outputJson) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return;
  }

  printText(output, assetTypes, options);
  if (!options.noReport) {
    writeReport(options.reportFile, output);
    console.log("");
    console.log(`Report written: ${options.reportFile}`);
  }
  console.log("");
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
  normalizeKey,
  buildCandidateKeys,
};
