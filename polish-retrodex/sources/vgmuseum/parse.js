"use strict";

const cheerio = require("cheerio");

const { absolutizeUrl, normalizeWhitespace } = require("../../core/shared");

const SCAN_SUFFIX_PATTERN = /\s*\((manual|front|back|cart|scan)\)\s*$/i;

function stripAssetMarkers(title) {
  return normalizeWhitespace(String(title || "").replace(SCAN_SUFFIX_PATTERN, ""));
}

function parseContributorFromLine(line) {
  const contributorMatch = line.match(/-+\s*Contributed by\s*(?:<[^>]+>)*([^<\-]+)(?:<\/[^>]+>)*?/i);
  return normalizeWhitespace(contributorMatch?.[1] || "");
}

function hasReviewVariantFlag(...values) {
  return values.some((value) => /\b(unlicensed|prototype|unmarked)\b/i.test(String(value || "")));
}

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
      content_type: "screenshot_link",
      variant_label: null,
      contributor_raw: null,
      preview_url_raw: detailUrl,
      raw_payload_json: {
        entry_url: entryUrl,
        list_url: listUrl,
        frame_src: frameSrc,
      },
      source_context: {
        section_key: sectionConfig.section_key,
        section_label: sectionConfig.label,
        parser: sectionConfig.parser,
        source_section: "screenshots",
        review_required: true,
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
      content_type: sectionConfig.asset_type === "ending" ? "ending_link" : "asset_link",
      variant_label: null,
      contributor_raw: null,
      preview_url_raw: detailUrl,
      raw_payload_json: {
        entry_url: entryUrl,
        href,
      },
      source_context: {
        section_key: sectionConfig.section_key,
        section_label: sectionConfig.label,
        parser: sectionConfig.parser,
        source_section: sectionConfig.section_key,
        review_required: Boolean(sectionConfig.review_only),
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

function isStructuredSpriteSheet(assetLabel, href, subtype) {
  const label = normalizeWhitespace(assetLabel).toLowerCase();
  const normalizedHref = String(href || "").trim().toLowerCase();

  if (["monster_chart", "character_rips", "assorted_sprites", "character_pose_sheet"].includes(subtype)) {
    return true;
  }

  if (/\.(htm|html)$/i.test(normalizedHref)) {
    return true;
  }

  return /\b(sheet|sprites|chart)\b/i.test(label);
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

       const assetSubtype = deriveRipsSubtype(assetLabel, sectionConfig.asset_subtype);
       if (!isStructuredSpriteSheet(assetLabel, href, assetSubtype)) {
         continue;
       }
       if (/\bseries\b/i.test(titleRaw)) {
         continue;
       }

      const detailUrl = absolutizeUrl(entryUrl, href);
      if (!detailUrl) {
        continue;
      }

      const contributorRaw = parseContributorFromLine(line);
      const reviewRequired = Boolean(sectionConfig.review_only || hasReviewVariantFlag(titleRaw, assetLabel));

      records.push({
        title_raw: titleRaw,
        platform_raw: sectionConfig.platform_raw,
        record_url: entryUrl,
        detail_url: detailUrl,
        content_type: "sprite_sheet_link",
        variant_label: assetLabel,
        contributor_raw: contributorRaw || null,
        preview_url_raw: detailUrl,
        raw_payload_json: {
          entry_url: entryUrl,
          href,
          asset_label: assetLabel,
          contributor_raw: contributorRaw || null,
        },
        source_context: {
          section_key: sectionConfig.section_key,
          section_label: sectionConfig.label,
          parser: sectionConfig.parser,
          asset_label: assetLabel,
          contributor: contributorRaw || null,
          source_section: "rips",
          review_required: reviewRequired,
        },
        asset_type_guess: sectionConfig.asset_type,
        asset_subtype: assetSubtype,
      });
    }
  }

  return {
    records,
  };
}

function detectScanSubtype(label, href) {
  const normalizedLabel = normalizeWhitespace(label).toLowerCase();
  const normalizedHref = String(href || "").toLowerCase();

  if (normalizedLabel.includes("(manual)")) return { assetType: "manual", assetSubtype: "manual" };
  if (normalizedLabel.includes("(front)")) return { assetType: "scan", assetSubtype: "box_front" };
  if (normalizedLabel.includes("(back)")) return { assetType: "scan", assetSubtype: "box_back" };
  if (normalizedLabel.includes("(cart)")) return { assetType: "scan", assetSubtype: "cart_scan" };
  if (normalizedLabel.includes("(scan)")) return { assetType: "scan", assetSubtype: "scan" };
  if (normalizedHref.includes("/carts/")) return { assetType: "scan", assetSubtype: "cart_scan" };

  return null;
}

function parseScansPage(entryHtml, entryUrl, sectionConfig) {
  const records = [];
  const lines = entryHtml
    .split(/<br\s*\/?>/i)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (!/\((manual|front|back|cart|scan)\)/i.test(line) && !/\/carts\//i.test(line)) {
      continue;
    }

    const anchors = [...line.matchAll(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    if (!anchors.length) {
      continue;
    }

    let baseTitle = "";
    for (const anchor of anchors) {
      const href = anchor[1];
      if (/^(mailto:|https?:\/\/(?!www\.vgmuseum\.com))/i.test(href)) {
        continue;
      }

      const anchorText = normalizeWhitespace(anchor[2].replace(/<[^>]+>/g, ""));
      const typeMeta = detectScanSubtype(anchorText, href);
      if (!typeMeta) {
        continue;
      }

      const detailUrl = absolutizeUrl(entryUrl, href);
      if (!detailUrl) {
        continue;
      }

      const titleCandidate = stripAssetMarkers(anchorText);
      if (titleCandidate) {
        baseTitle = titleCandidate;
      }

      if (!baseTitle) {
        continue;
      }

      const reviewRequired = typeMeta.assetType !== "manual" || Boolean(sectionConfig.review_only);

      records.push({
        title_raw: baseTitle,
        platform_raw: sectionConfig.platform_raw,
        record_url: entryUrl,
        detail_url: detailUrl,
        content_type: typeMeta.assetType === "manual" ? "manual_link" : "scan_link",
        variant_label: anchorText,
        contributor_raw: null,
        preview_url_raw: detailUrl,
        raw_payload_json: {
          entry_url: entryUrl,
          href,
          asset_label: anchorText,
        },
        source_context: {
          section_key: sectionConfig.section_key,
          section_label: sectionConfig.label,
          parser: sectionConfig.parser,
          source_section: "scans",
          review_required: reviewRequired,
        },
        asset_type_guess: typeMeta.assetType,
        asset_subtype: typeMeta.assetSubtype,
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
  parseScansPage,
  parseSimpleList,
};
