"use strict";

const { normalizePlatform } = require("../../core/normalize-platforms");
const { absolutizeUrl, fetchText } = require("../../core/shared");
const { extractSections, parsePlatformPage } = require("./parse");

function sectionMatchesScope(section, scopePlatforms) {
  const normalizedSection = normalizePlatform(
    section.label
      .replace(/\[[^\]]+\]/g, "")
      .replace(/\([^)]*\)/g, "")
      .trim(),
  ).normalized;
  return !scopePlatforms.size || scopePlatforms.has(normalizedSection);
}

async function discover({ config, scopes = [] }) {
  const scopePlatforms = new Set(
    (scopes || [])
      .filter((scope) => scope.startsWith("platform:"))
      .map((scope) => normalizePlatform(scope.slice("platform:".length)).normalized),
  );

  const response = await fetchText(config.atlas_url, { timeoutMs: 30000 });
  if (!response.ok) {
    throw new Error(`VGMaps atlas failed with status ${response.status}.`);
  }

  const sections = extractSections(response.text);
  const selected = sections.filter((section) => sectionMatchesScope(section, scopePlatforms));
  const discovered = [];
  const parsedSections = [];

  for (const section of selected) {
    const platformUrl = absolutizeUrl(response.url, section.index_href);
    if (!platformUrl) {
      continue;
    }

    const platformResponse = await fetchText(platformUrl, { timeoutMs: 30000 });
    if (!platformResponse.ok) {
      throw new Error(`VGMaps platform page ${platformUrl} failed with status ${platformResponse.status}.`);
    }

    const sectionRecords = parsePlatformPage(platformResponse.text, platformResponse.url, section);
    discovered.push(...sectionRecords);
    parsedSections.push({
      anchor: section.anchor,
      label: section.label,
      platform_url: platformResponse.url,
      records: sectionRecords.length,
    });
  }

  return {
    records: discovered,
    checkpoint: {
      atlas_url: response.url,
      selected_sections: parsedSections,
    },
    stats: {
      total_sections: sections.length,
      selected_sections: selected.length,
      parsed_platform_pages: parsedSections.length,
      total_records: discovered.length,
    },
  };
}

module.exports = {
  discover,
};
