"use strict";

const rootNotionConfig = require("../../scripts/sync/notion.config.js");

module.exports = {
  root: rootNotionConfig,
  syncGatePath: "scripts/sync/sync-gate.js",
  targets: [
    "PRD Sources",
    "PRD Ingestion Runs",
    "PRD Review Queue",
    "PRD Assets Ready",
    "PRD Coverage Dashboard",
  ],
  sourceTypes: {
    pixel_warehouse: "catalog_seed",
    vgmaps: "external_map_index",
    vgmuseum: "external_asset_archive",
  },
  defaultPriority: {
    pixel_warehouse: "medium",
    vgmaps: "high",
    vgmuseum: "high",
  },
};
