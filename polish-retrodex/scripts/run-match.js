"use strict";

const path = require("path");

const { matchSourceRecord, prepareCanonicalCorpus } = require("../core/match-games");
const {
  OUTPUT_FILES,
  appendJsonl,
  appendPipelineLog,
  ensureBaseDirs,
  getLatestRunId,
  nowIso,
  parseArgs,
  readJsonl,
  relativeToProject,
  writeJson,
} = require("../core/shared");

async function runMatch(options = {}) {
  ensureBaseDirs();
  const args = options.args || parseArgs(process.argv.slice(2));
  const runId = options.runId || args["run-id"] || getLatestRunId(OUTPUT_FILES.normalized_records);
  if (!runId) {
    throw new Error("No normalized run available for matching.");
  }

  const normalizedRows = readJsonl(OUTPUT_FILES.normalized_records).filter((row) => row.run_id === runId);
  const existing = new Set(
    readJsonl(OUTPUT_FILES.match_candidates)
      .filter((row) => row.run_id === runId)
      .map((row) => row.source_record_id),
  );

  const corpus = prepareCanonicalCorpus();
  const matchRows = [];

  for (const row of normalizedRows) {
    if ((args.resume || options.resume) && existing.has(row.source_record_id)) {
      continue;
    }

    const match = matchSourceRecord(row, corpus);
    matchRows.push({
      run_id: runId,
      stage: "match",
      schema_version: "polish-retrodex.game_matches.v1",
      created_at: nowIso(),
      source_name: row.source_name,
      ...match,
    });
  }

  appendJsonl(OUTPUT_FILES.match_candidates, matchRows);
  appendPipelineLog("info", "match", "Matching completed.", { runId, inserted: matchRows.length });

  const counters = matchRows.reduce((acc, row) => {
    acc[row.match_status] = (acc[row.match_status] || 0) + 1;
    return acc;
  }, {});

  const reportPath = path.join(path.dirname(OUTPUT_FILES.match_candidates), `match_report_${runId}.json`);
  writeJson(reportPath, {
    run_id: runId,
    generated_at: nowIso(),
    canonical_games: corpus.length,
    matched_records: matchRows.length,
    status_breakdown: counters,
    samples: matchRows.slice(0, 25),
  });

  return {
    runId,
    inserted: matchRows.length,
    outputFile: OUTPUT_FILES.match_candidates,
    reportPath,
    counters,
  };
}

if (require.main === module) {
  runMatch().then((result) => {
    console.log(JSON.stringify({
      ok: true,
      run_id: result.runId,
      inserted: result.inserted,
      status_breakdown: result.counters,
      output_file: relativeToProject(result.outputFile),
      report: relativeToProject(result.reportPath),
    }, null, 2));
  }).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  runMatch,
};
