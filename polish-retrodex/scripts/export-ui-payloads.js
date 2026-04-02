"use strict";

const {
  OUTPUT_FILES,
  appendJsonl,
  ensureBaseDirs,
  getLatestRunId,
  nowIso,
  parseArgs,
  readJsonl,
  relativeToProject,
} = require("../core/shared");

function toBucket(assetType) {
  if (assetType === "map") {
    return "maps";
  }
  if (assetType === "manual") {
    return "manuals";
  }
  if (assetType === "sprite_sheet") {
    return "sprites";
  }
  return "assets";
}

async function runUiExport(options = {}) {
  ensureBaseDirs();
  const args = options.args || parseArgs(process.argv.slice(2));
  const runId = options.runId || args["run-id"] || getLatestRunId(OUTPUT_FILES.external_assets);
  if (!runId) {
    throw new Error("No external asset run available for UI export.");
  }

  const existing = new Set(
    readJsonl(OUTPUT_FILES.ui_payloads)
      .filter((row) => row.run_id === runId)
      .map((row) => row.game_id),
  );

  const assets = readJsonl(OUTPUT_FILES.external_assets)
    .filter((row) => row.run_id === runId && row.ui_allowed);

  const grouped = new Map();
  for (const asset of assets) {
    const payload = grouped.get(asset.game_id) || {
      game_id: asset.game_id,
      external_assets: {
        maps: [],
        manuals: [],
        sprites: [],
        assets: [],
      },
    };

    payload.external_assets[toBucket(asset.asset_type)].push({
      source: asset.source_name,
      type: asset.asset_subtype || asset.asset_type,
      url: asset.external_url,
      preview_url: asset.preview_url,
      ui_allowed: asset.ui_allowed,
    });
    grouped.set(asset.game_id, payload);
  }

  const rows = [...grouped.values()]
    .filter((row) => !existing.has(row.game_id))
    .map((row) => ({
      run_id: runId,
      stage: "ui_export",
      schema_version: "polish-retrodex.ui_payloads.v1",
      created_at: nowIso(),
      ...row,
    }));

  appendJsonl(OUTPUT_FILES.ui_payloads, rows);

  return {
    runId,
    inserted: rows.length,
    outputFile: OUTPUT_FILES.ui_payloads,
  };
}

if (require.main === module) {
  runUiExport().then((result) => {
    console.log(JSON.stringify({
      ok: true,
      run_id: result.runId,
      inserted: result.inserted,
      output_file: relativeToProject(result.outputFile),
    }, null, 2));
  }).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  runUiExport,
};
