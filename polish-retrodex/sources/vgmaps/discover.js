"use strict";

const { normalizePlatform } = require("../../core/normalize-platforms");
const { fetchText } = require("../../core/shared");
const { extractSections, parseSection } = require("./parse");

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
  const discovered = selected.flatMap((section) => parseSection(section, response.url));

  return {
    records: discovered,
    checkpoint: {
      atlas_url: response.url,
      selected_sections: selected.map((section) => section.anchor),
    },
    stats: {
      total_sections: sections.length,
      selected_sections: selected.length,
      total_records: discovered.length,
    },
  };
}

module.exports = {
  discover,
};
