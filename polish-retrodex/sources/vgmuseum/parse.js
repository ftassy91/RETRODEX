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

function buildPatternList(patterns = []) {
  return (Array.isArray(patterns) ? patterns : [])
    .map((pattern) => {
      try {
        return new RegExp(pattern, "i");
      } catch (_error) {
        return null;
      }
    })
    .filter(Boolean);
}

function shouldSkipRipsRecord(titleRaw, assetLabel, sectionConfig) {
  const title = normalizeWhitespace(titleRaw).toLowerCase();
  const label = normalizeWhitespace(assetLabel).toLowerCase();

  if (!title || !label) {
    return true;
  }

  const excludedTitlePatterns = buildPatternList(sectionConfig.exclude_title_patterns);
  const excludedLabelPatterns = buildPatternList(sectionConfig.exclude_label_patterns);

  if (excludedTitlePatterns.some((pattern) => pattern.test(titleRaw))) {
    return true;
  }

  if (excludedLabelPatterns.some((pattern) => pattern.test(assetLabel))) {
    return true;
  }

  if (/\bmap\b/i.test(assetLabel)) {
    return true;
  }

  if (/\bstill rips\b/i.test(assetLabel)) {
    return true;
  }

  return false;
}

function deriveRipsSubtype(assetLabel, fallbackSubtype) {
  const normalized = normalizeWhitespace(assetLabel).toLowerCase();

  if (normalized.includes("monster chart")) return "monster_chart";
  if (normalized.includes("character rip")) return "character_rips";
  if (normalized.includes("assorted sprites")) return "assorted_sprites";
  if (normalized.includes("various poses")) return "character_pose_sheet";
  if (normalized.includes("posing")) return "character_pose";
  if (normalized.includes("walking")) return "animation_frame";
  if (normalized.includes("intro")) return "system_sprite";

  return fallbackSubtype || "sprite_rip";
}

function parseRipsList(entryHtml, entryUrl, sectionConfig) {
  const records = [];
  const paragraphPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;

  for (const paragraphMatch of entryHtml.matchAll(paragraphPattern)) {
    const paragraphHtml = paragraphMatch[1];
    const lines = paragraphHtml
      .split(/<br\s*\/?>/i)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      const anchorMatch = line.match(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!anchorMatch) {
        continue;
      }

      const href = anchorMatch[1];
      if (/^(mailto:|https?:\/\/(?!www\.vgmuseum\.com))/i.test(href)) {
        continue;
      }

      const assetLabel = normalizeWhitespace(anchorMatch[2].replace(/<[^>]+>/g, ""));
      const titleRaw = normalizeWhitespace(
        line
          .slice(0, anchorMatch.index)
          .replace(/<[^>]+>/g, "")
          .replace(/[:\-–\s]+$/g, "")
      );

      if (shouldSkipRipsRecord(titleRaw, assetLabel, sectionConfig)) {
        continue;
      }

      const detailUrl = absolutizeUrl(entryUrl, href);
      if (!detailUrl) {
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
          asset_label: assetLabel,
        },
        source_context: {
          section_key: sectionConfig.section_key,
          section_label: sectionConfig.label,
          parser: sectionConfig.parser,
          asset_label: assetLabel,
        },
        asset_type_guess: sectionConfig.asset_type,
        asset_subtype: deriveRipsSubtype(assetLabel, sectionConfig.asset_subtype),
      });
    }
  }

  return {
    records,
  };
}

module.exports = {
  parseFramesetGamepics,
  parseRipsList,
  parseSimpleList,
};
