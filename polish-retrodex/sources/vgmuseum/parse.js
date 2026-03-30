"use strict";

const cheerio = require("cheerio");

const { absolutizeUrl, normalizeWhitespace } = require("../../core/shared");

function parseFramesetGamepics(entryHtml, entryUrl, listHtml, listUrl, sectionConfig) {
  const $entry = cheerio.load(entryHtml);
  const frameSrc = $entry("frame[name='b']").attr("src");
  if (!frameSrc) {
    throw new Error(`No content frame found for ${entryUrl}.`);
  }

  const records = [];
  const linkPattern = /<li>[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of listHtml.matchAll(linkPattern)) {
    const detailUrl = absolutizeUrl(listUrl, match[1]);
    const titleRaw = normalizeWhitespace(match[2].replace(/<[^>]+>/g, ""));
    if (!detailUrl || !titleRaw) {
      continue;
    }

    records.push({
      title_raw: titleRaw,
      platform_raw: sectionConfig.platform_raw,
      record_url: detailUrl,
      detail_url: detailUrl,
      raw_payload_json: {
        entry_url: entryUrl,
        list_url: listUrl,
        frame_src: frameSrc,
      },
      source_context: {
        section_key: sectionConfig.section_key,
        section_label: sectionConfig.label,
        parser: sectionConfig.parser,
      },
      asset_type_guess: sectionConfig.asset_type,
      asset_subtype: sectionConfig.asset_subtype,
    });
  }

  return {
    records,
    frame_src: frameSrc,
  };
}

function parseSimpleList(entryHtml, entryUrl, sectionConfig) {
  const records = [];
  const linkPattern = /<a href="([^"]*\.htm[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of entryHtml.matchAll(linkPattern)) {
    const href = match[1];
    if (/^(mailto:|https?:\/\/)/i.test(href)) {
      continue;
    }
    if (!/^[a-z0-9/_-]+\.htm$/i.test(href)) {
      continue;
    }

    const detailUrl = absolutizeUrl(entryUrl, href);
    const titleRaw = normalizeWhitespace(match[2].replace(/<[^>]+>/g, ""));
    if (!detailUrl || !titleRaw || titleRaw.length <= 1) {
      continue;
    }

    records.push({
      title_raw: titleRaw,
      platform_raw: sectionConfig.platform_raw,
      record_url: detailUrl,
      detail_url: detailUrl,
      raw_payload_json: {
        entry_url: entryUrl,
        href,
      },
      source_context: {
        section_key: sectionConfig.section_key,
        section_label: sectionConfig.label,
        parser: sectionConfig.parser,
      },
      asset_type_guess: sectionConfig.asset_type,
      asset_subtype: sectionConfig.asset_subtype,
    });
  }

  return {
    records,
  };
}

module.exports = {
  parseFramesetGamepics,
  parseSimpleList,
};
