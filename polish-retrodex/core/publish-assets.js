"use strict";

const { buildScopedId, nowIso } = require("./shared");

function buildAssetTitle(record) {
  const variant = String(record.variant_label || "").trim();
  const rawTitle = String(record.title_raw || "").trim();
  if (!variant) {
    return rawTitle;
  }

  if (
    /^\((manual|front|back|cart)\)$/i.test(variant)
    || /^(manual|front|back|cart)$/i.test(variant)
    || normalizeForCompare(variant) === normalizeForCompare(rawTitle)
    || normalizeForCompare(variant).includes(normalizeForCompare(rawTitle))
  ) {
    return rawTitle;
  }

  return `${rawTitle} - ${variant}`;
}

function normalizeForCompare(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function publishAsset(record, match, validation, health) {
  return {
    asset_id: buildScopedId("asset", [record.source_record_id, match.game_id, record.record_url || record.detail_url || "no-url"]),
    game_id: match.game_id,
    source_name: record.source_name,
    asset_type: validation.asset_type,
    asset_subtype: validation.asset_subtype,
    title: buildAssetTitle(record),
    external_url: record.detail_url || record.record_url,
    preview_url: record.preview_url_raw || record.detail_url || record.record_url,
    license_status: validation.license_status,
    ui_allowed: validation.ui_allowed,
    source_record_id: record.source_record_id,
    content_type: record.content_type || null,
    variant_label: record.variant_label || null,
    contributor_raw: record.contributor_raw || null,
    source_page_url: record.record_url || null,
    source_context: record.source_context || {},
    notes: validation.notes,
    healthcheck_status: health.healthcheck_status || "unchecked",
    published_at: nowIso(),
  };
}

module.exports = {
  publishAsset,
};
