"use strict";

const { fetchText } = require("../../core/shared");
const { parseFramesetGamepics, parseRipsList, parseScansPage, parseSimpleList } = require("./parse");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RATE_LIMIT_MS = 1000;

function scopeToSectionKeys(scopes, config) {
  const explicit = (scopes || [])
    .filter((scope) => scope.startsWith("section:"))
    .map((scope) => scope.slice("section:".length));

  if (explicit.length) {
    return explicit;
  }

  return Object.keys(config.sections || {});
}

async function discover({ config, scopes = [] }) {
  const sectionKeys = scopeToSectionKeys(scopes, config);
  const discovered = [];
  const parsedSections = [];

  for (const sectionKey of sectionKeys) {
    const sectionConfig = config.sections?.[sectionKey];
    if (!sectionConfig) {
      continue;
    }

    await sleep(RATE_LIMIT_MS);
    const entry = await fetchText(sectionConfig.entry_url, { timeoutMs: 30000 });
    if (!entry.ok) {
      throw new Error(`VGMuseum section ${sectionKey} failed with status ${entry.status}.`);
    }

    if (sectionConfig.parser === "frameset_gamepics") {
      const frameMatch = entry.text.match(/<frame\s+src="([^"]+)"[^>]*name="b"/i);
      if (!frameMatch) {
        throw new Error(`VGMuseum section ${sectionKey} has no frame "b".`);
      }
      const listUrl = new URL(frameMatch[1], entry.url).toString();
      await sleep(RATE_LIMIT_MS);
      const list = await fetchText(listUrl, { timeoutMs: 30000 });
      if (!list.ok) {
        throw new Error(`VGMuseum section list ${listUrl} failed with status ${list.status}.`);
      }

      const parsed = parseFramesetGamepics(entry.text, entry.url, list.text, list.url, { ...sectionConfig, section_key: sectionKey });
      discovered.push(...parsed.records);
      parsedSections.push({
        key: sectionKey,
        parser: sectionConfig.parser,
        entry_url: entry.url,
        list_url: list.url,
        records: parsed.records.length,
      });
      continue;
    }

    if (sectionConfig.parser === "simple_list") {
      const parsed = parseSimpleList(entry.text, entry.url, { ...sectionConfig, section_key: sectionKey });
      discovered.push(...parsed.records);
      parsedSections.push({
        key: sectionKey,
        parser: sectionConfig.parser,
        entry_url: entry.url,
        records: parsed.records.length,
      });
    }

    if (sectionConfig.parser === "scans_page") {
      const parsed = parseScansPage(entry.text, entry.url, { ...sectionConfig, section_key: sectionKey });
      discovered.push(...parsed.records);
      parsedSections.push({
        key: sectionKey,
        parser: sectionConfig.parser,
        entry_url: entry.url,
        records: parsed.records.length,
      });
    }

    if (sectionConfig.parser === "rips_list") {
      const parsed = parseRipsList(entry.text, entry.url, { ...sectionConfig, section_key: sectionKey });
      discovered.push(...parsed.records);
      parsedSections.push({
        key: sectionKey,
        parser: sectionConfig.parser,
        entry_url: entry.url,
        records: parsed.records.length,
      });
    }
  }

  return {
    records: discovered,
    checkpoint: {
      parsed_sections: parsedSections,
    },
    stats: {
      sections: parsedSections.length,
      total_records: discovered.length,
    },
  };
}

module.exports = {
  discover,
};
