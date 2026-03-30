"use strict";

const path = require("path");

const sourcesConfig = require("../config/sources.json");
const { normalizePlatform } = require("../core/normalize-platforms");
const {
  OUTPUT_FILES,
  appendJsonl,
  appendPipelineLog,
  buildScopedId,
  createRunId,
  ensureBaseDirs,
  loadConfig,
  nowIso,
  parseArgs,
  readCheckpoint,
  readJsonl,
  relativeToProject,
  writeCheckpoint,
  writeJson,
} = require("../core/shared");

const SOURCE_MODULES = {
  pixel_warehouse: require("../sources/pixel_warehouse/discover"),
  vgmaps: require("../sources/vgmaps/discover"),
  vgmuseum: require("../sources/vgmuseum/discover"),
};

function buildDedupeKey(record) {
  return [
    record.source_name,
    record.record_url || "",
    record.detail_url || "",
    record.title_raw || "",
    record.platform_raw || "",
  ].join("::");
}

async function runDiscover(options = {}) {
  ensureBaseDirs();
  const args = options.args || parseArgs(process.argv.slice(2));
  const profiles = loadConfig("stages.json");
  const profileName = options.profile || args.profile || null;
  const profile = profileName ? profiles?.[profileName] || {} : {};
  const runId = options.runId || args["run-id"] || createRunId("prd");
  const requestedSource = options.source || args.source || null;
  const requestedSources = requestedSource
    ? [requestedSource]
    : Object.keys(profile.discover || SOURCE_MODULES);

  const existingRows = readJsonl(OUTPUT_FILES.source_records);
  const existingRowByKey = new Map(existingRows.map((row) => [buildDedupeKey(row), row]));
  const currentRunKeys = new Set();
  const newRows = [];
  const summary = [];

  for (const sourceName of requestedSources) {
    const sourceModule = SOURCE_MODULES[sourceName];
    const sourceConfig = sourcesConfig[sourceName];
    if (!sourceModule || !sourceConfig) {
      appendPipelineLog("error", "discover", `Unknown source "${sourceName}".`);
      continue;
    }

    const profileConfig = profile.discover?.[sourceName] || {};
    const scopes = options.scopes
      || (args.scope ? [args.scope] : null)
      || profileConfig.scopes
      || [];
    const limit = Number.parseInt(options.limit || args.limit || profileConfig.limit || sourceConfig.default_page_limit || 0, 10) || 0;
    const checkpoint = args.resume || options.resume
      ? readCheckpoint("discover", sourceName)
      : {};

    try {
      appendPipelineLog("info", "discover", `Starting discover for ${sourceName}.`, { runId, scopes, limit });
      const result = await sourceModule.discover({
        config: sourceConfig,
        scopes,
        limit,
        checkpoint,
      });

      let inserted = 0;
      let duplicates = 0;

      for (const partial of result.records) {
        const dedupeKey = buildDedupeKey({ ...partial, source_name: sourceName });
        if (currentRunKeys.has(dedupeKey)) {
          duplicates += 1;
          continue;
        }

        const createdAt = nowIso();
        const existingRow = existingRowByKey.get(dedupeKey);
        const row = existingRow ? {
          ...existingRow,
          run_id: runId,
          stage: "discover",
          schema_version: "polish-retrodex.source_records.v2",
          created_at: createdAt,
          last_seen_at: createdAt,
          status: "duplicate",
          raw_payload_json: partial.raw_payload_json || existingRow.raw_payload_json || {},
          source_context: partial.source_context || existingRow.source_context || {},
          content_type: partial.content_type || existingRow.content_type || "source_record",
          variant_label: partial.variant_label || existingRow.variant_label || null,
          contributor_raw: partial.contributor_raw || existingRow.contributor_raw || null,
          preview_url_raw: partial.preview_url_raw || existingRow.preview_url_raw || null,
          asset_type_guess: partial.asset_type_guess || existingRow.asset_type_guess || null,
          asset_subtype: partial.asset_subtype || existingRow.asset_subtype || null,
        } : {
          run_id: runId,
          stage: "discover",
          schema_version: "polish-retrodex.source_records.v2",
          created_at: createdAt,
          source_record_id: buildScopedId("src", [sourceName, partial.detail_url || partial.record_url || partial.title_raw, partial.platform_raw]),
          source_name: sourceName,
          source_type: sourceConfig.source_type,
          content_type: partial.content_type || "source_record",
          title_raw: partial.title_raw,
          platform_raw: normalizePlatform(partial.platform_raw).normalized || partial.platform_raw,
          variant_label: partial.variant_label || null,
          record_url: partial.record_url,
          detail_url: partial.detail_url,
          contributor_raw: partial.contributor_raw || null,
          preview_url_raw: partial.preview_url_raw || null,
          raw_payload_json: partial.raw_payload_json || {},
          first_seen_at: createdAt,
          last_seen_at: createdAt,
          discovery_stage: "index",
          status: "discovered",
          source_context: partial.source_context || {},
          asset_type_guess: partial.asset_type_guess || null,
          asset_subtype: partial.asset_subtype || null,
        };

        currentRunKeys.add(dedupeKey);
        newRows.push(row);
        if (existingRow) {
          duplicates += 1;
        } else {
          inserted += 1;
          existingRowByKey.set(dedupeKey, row);
        }
      }

      writeCheckpoint("discover", sourceName, {
        run_id: runId,
        stats: result.stats,
        ...result.checkpoint,
      });

      summary.push({
        source: sourceName,
        inserted,
        duplicates,
        stats: result.stats,
        scopes,
      });
      appendPipelineLog("info", "discover", `Completed discover for ${sourceName}.`, { runId, inserted, duplicates });
    } catch (error) {
      appendPipelineLog("error", "discover", `Discover failed for ${sourceName}: ${error.message}`, { runId });
      summary.push({
        source: sourceName,
        inserted: 0,
        duplicates: 0,
        error: error.message,
      });
    }
  }

  appendJsonl(OUTPUT_FILES.source_records, newRows);

  const reportPath = path.join(path.dirname(OUTPUT_FILES.source_records), `discover_report_${runId}.json`);
  writeJson(reportPath, {
    run_id: runId,
    generated_at: nowIso(),
    output_file: relativeToProject(OUTPUT_FILES.source_records),
    inserted: newRows.length,
    summary,
  });

  return {
    runId,
    inserted: newRows.length,
    outputFile: OUTPUT_FILES.source_records,
    reportPath,
    summary,
  };
}

if (require.main === module) {
  runDiscover().then((result) => {
    console.log(JSON.stringify({
      ok: true,
      run_id: result.runId,
      inserted: result.inserted,
      output_file: relativeToProject(result.outputFile),
      report: relativeToProject(result.reportPath),
    }, null, 2));
  }).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  runDiscover,
};
