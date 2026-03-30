"use strict";

const { absolutizeUrl, normalizeWhitespace } = require("../../core/shared");

function extractSections(html) {
  const startPattern = /<A NAME="([^"]+)" HREF="([^"]+index\.htm)">[\s\S]*?<b>\[\s*([^\]]+)\s*\]<\/b>/gi;
  const matches = [...html.matchAll(startPattern)];
  const sections = [];

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const sectionHtml = html.slice(current.index, next ? next.index : html.length);

    sections.push({
      anchor: current[1],
      index_href: current[2],
      label: normalizeWhitespace(current[3]),
      section_html: sectionHtml,
    });
  }

  return sections;
}

function parseSection(section, atlasUrl) {
  const records = [];
  const baseIndex = section.index_href;
  const linkPattern = /<a href="([^"]+index\.htm#[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const platformRaw = normalizeWhitespace(
    section.label
      .replace(/^\[[\s]*/g, "")
      .replace(/\s*\]$/g, "")
      .replace(/\([^)]*\)/g, "")
      .trim(),
  );

  for (const match of section.section_html.matchAll(linkPattern)) {
    const href = match[1];
    if (!href.startsWith(baseIndex)) {
      continue;
    }

    const title = normalizeWhitespace(match[2].replace(/<[^>]+>/g, ""));
    if (!title || title.length <= 1) {
      continue;
    }

    const detailUrl = absolutizeUrl(atlasUrl, href);
    if (!detailUrl) {
      continue;
    }

    records.push({
      title_raw: title,
      platform_raw: platformRaw,
      record_url: detailUrl,
      detail_url: detailUrl,
      raw_payload_json: {
        atlas_anchor: section.anchor,
        atlas_href: href,
        atlas_label: section.label,
      },
      source_context: {
        atlas_anchor: section.anchor,
        atlas_label: section.label,
        source_section: "atlas",
        asset_type: "map",
        asset_subtype: "atlas_map",
      },
      asset_type_guess: "map",
      asset_subtype: "atlas_map",
    });
  }

  return records;
}

module.exports = {
  extractSections,
  parseSection,
};
