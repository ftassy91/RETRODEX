#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_DIR = path.join(ROOT, "data", "manifests");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "local-inventory.json");

const SOURCES = [
  {
    id: "shared-exports",
    label: "Shared exports",
    relativePath: "data/exports",
    recommendation: "integrate_now",
    notes: "Structured exports already close to sandbox import format.",
  },
  {
    id: "shared-assets",
    label: "Shared assets",
    relativePath: "assets",
    recommendation: "integrate_now",
    notes: "Primary local assets bucket for covers, notices, and generated media.",
  },
  {
    id: "runtime-assets",
    label: "Runtime public assets",
    relativePath: "backend/public/assets",
    recommendation: "integrate_now",
    notes: "Keep aligned with the published product surface.",
  },
  {
    id: "legacy-prototype-assets",
    label: "Legacy prototype assets",
    relativePath: "RETRODEXseedV0/prototype_v0/assets",
    recommendation: "cleanup_then_integrate",
    notes: "Useful source material, but requires deduplication and rights review.",
  },
  {
    id: "legacy-notion-exports",
    label: "Legacy Notion exports",
    relativePath: "RETRODEXseedV0/prototype_v0/data/notion_exports",
    recommendation: "cleanup_then_integrate",
    notes: "Structured backlog and sync previews that can feed Polish RetroDex.",
  },
  {
    id: "legacy-datapack",
    label: "Legacy datapack",
    relativePath: "RETRODEXseedV0/prototype_v0/datapack",
    recommendation: "reference_only",
    notes: "Useful for comparison, not for direct publication.",
  },
  {
    id: "workspace-archives",
    label: "Workspace archives",
    relativePath: ".",
    nonRecursive: true,
    fileFilter: (filePath, dirent) => dirent.isFile() && path.extname(filePath).toLowerCase() === ".zip",
    recommendation: "archive_only",
    notes: "Archives and snapshots should be indexed, not treated as live data.",
  },
];

function parseArgs(argv) {
  return argv.reduce((acc, token) => {
    const [rawKey, rawValue] = token.split("=");
    acc[rawKey.replace(/^--/, "")] = rawValue == null ? true : rawValue;
    return acc;
  }, {});
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = Number(bytes || 0);
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function walkDirectory(currentPath, fileFilter, summary, nonRecursive = false) {
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      if (nonRecursive) {
        continue;
      }
      summary.directories += 1;
      walkDirectory(fullPath, fileFilter, summary, nonRecursive);
      continue;
    }

    if (fileFilter && !fileFilter(fullPath, entry)) {
      continue;
    }

    const stats = fs.statSync(fullPath);
    const ext = path.extname(fullPath).toLowerCase() || "[no_ext]";
    summary.files += 1;
    summary.bytes += stats.size;
    summary.byExtension[ext] = (summary.byExtension[ext] || 0) + 1;
    summary.largestFiles.push({
      path: path.relative(ROOT, fullPath),
      bytes: stats.size,
    });
  }
}

function summarizeSource(source) {
  const absolutePath = path.resolve(ROOT, source.relativePath);
  const summary = {
    id: source.id,
    label: source.label,
    path: source.relativePath,
    absolutePath,
    exists: fs.existsSync(absolutePath),
    recommendation: source.recommendation,
    notes: source.notes,
    files: 0,
    directories: 0,
    bytes: 0,
    byExtension: {},
    largestFiles: [],
    topExtensions: [],
    humanSize: "0 B",
  };

  if (!summary.exists) {
    return summary;
  }

  const stats = fs.statSync(absolutePath);
  if (stats.isFile()) {
    const ext = path.extname(absolutePath).toLowerCase() || "[no_ext]";
    summary.files = 1;
    summary.bytes = stats.size;
    summary.byExtension[ext] = 1;
    summary.largestFiles.push({
      path: path.relative(ROOT, absolutePath),
      bytes: stats.size,
    });
    summary.topExtensions = [{ extension: ext, count: 1 }];
    summary.humanSize = formatBytes(summary.bytes);
    return summary;
  }

  walkDirectory(absolutePath, source.fileFilter, summary, source.nonRecursive === true);
  summary.largestFiles = summary.largestFiles
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, 10);
  summary.topExtensions = Object.entries(summary.byExtension)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([extension, count]) => ({ extension, count }));
  summary.humanSize = formatBytes(summary.bytes);
  return summary;
}

function buildManifest(summaries) {
  const totals = summaries.reduce((acc, summary) => {
    if (!summary.exists) {
      acc.missingSources += 1;
      return acc;
    }
    acc.files += summary.files;
    acc.directories += summary.directories;
    acc.bytes += summary.bytes;
    acc.byRecommendation[summary.recommendation] = (acc.byRecommendation[summary.recommendation] || 0) + 1;
    return acc;
  }, {
    files: 0,
    directories: 0,
    bytes: 0,
    missingSources: 0,
    byRecommendation: {},
  });

  return {
    generatedAt: new Date().toISOString(),
    root: ROOT,
    summary: {
      sources: summaries.length,
      missingSources: totals.missingSources,
      files: totals.files,
      directories: totals.directories,
      bytes: totals.bytes,
      humanSize: formatBytes(totals.bytes),
      byRecommendation: totals.byRecommendation,
    },
    sources: summaries,
  };
}

function printTextReport(manifest) {
  console.log("\nRetroDex local inventory");
  console.log("=======================");
  console.log(`Sources     : ${manifest.summary.sources}`);
  console.log(`Files       : ${manifest.summary.files}`);
  console.log(`Directories : ${manifest.summary.directories}`);
  console.log(`Size        : ${manifest.summary.humanSize}`);
  console.log("");

  for (const source of manifest.sources) {
    const status = source.exists ? "OK" : "MISSING";
    const size = source.exists ? source.humanSize : "-";
    console.log(`[${status}] ${source.id} -> ${source.recommendation}`);
    console.log(`  ${source.path}`);
    if (source.exists) {
      console.log(`  ${source.files} files, ${source.directories} dirs, ${size}`);
      const topExtensions = source.topExtensions
        .slice(0, 5)
        .map((entry) => `${entry.extension}:${entry.count}`)
        .join("  ");
      if (topExtensions) {
        console.log(`  ${topExtensions}`);
      }
    }
    console.log(`  ${source.notes}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = buildManifest(SOURCES.map(summarizeSource));

  if (args["no-write"] !== true) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  if (args.json) {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  printTextReport(manifest);
  if (args["no-write"] !== true) {
    console.log(`\nManifest written to ${OUTPUT_PATH}`);
  }
}

main();
