"use strict";

const sourcesConfig = require("../config/sources.json");

function validateAsset(record, match, health) {
  const sourceConfig = sourcesConfig[record.source_name] || {};
  const defaults = sourceConfig.asset_defaults || {};
  const assetType = record.asset_type_guess || null;
  const sourceAllowedTypes = new Set(sourceConfig.allowed_asset_types || sourceConfig.ui_allowed_types || []);
  const assetTypeAllowed = assetType ? sourceAllowedTypes.has(assetType) : false;

  let licenseStatus = defaults.license_status || "needs_review";
  let uiAllowed = Boolean(defaults.ui_allowed && assetTypeAllowed);
  const notes = [];

  if (record.source_name === "pixel_warehouse") {
    licenseStatus = "blocked";
    uiAllowed = false;
    notes.push("catalog seed only");
  }

  if (health.healthcheck_status !== "ok" && health.healthcheck_status !== "redirected") {
    notes.push(`healthcheck ${health.healthcheck_status}`);
    uiAllowed = false;
  }

  if (!match || !["auto_matched", "approved"].includes(match.match_status)) {
    notes.push("match not publishable");
    uiAllowed = false;
  }

  if (!assetTypeAllowed) {
    notes.push("asset type not allowed for UI");
    uiAllowed = false;
  }

  return {
    asset_type: assetType,
    asset_subtype: record.asset_subtype || null,
    license_status: licenseStatus,
    ui_allowed: uiAllowed,
    notes,
  };
}

module.exports = {
  validateAsset,
};
