"use strict";

const { buildScopedId, nowIso } = require("./shared");

function publishAsset(record, match, validation, health) {
  return {
    asset_id: buildScopedId("asset", [record.source_record_id, match.game_id, record.record_url || record.detail_url || "no-url"]),
    game_id: match.game_id,
    source_name: record.source_name,
    asset_type: validation.asset_type,
    asset_subtype: validation.asset_subtype,
    title: record.title_raw,
    external_url: record.detail_url || record.record_url,
    preview_url: record.record_url || record.detail_url,
    license_status: validation.license_status,
    ui_allowed: validation.ui_allowed,
    source_record_id: record.source_record_id,
    notes: validation.notes,
    healthcheck_status: health.healthcheck_status || "unchecked",
    published_at: nowIso(),
  };
}

module.exports = {
  publishAsset,
};
