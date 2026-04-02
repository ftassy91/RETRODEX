"use strict";

const cheerio = require("cheerio");

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

function normalizePlatformLabel(label) {
  return normalizeWhitespace(
    String(label || "")
      .replace(/^\[[\s]*/g, "")
      .replace(/\s*\]$/g, "")
      .replace(/\([^)]*\)/g, "")
      .trim(),
  );
}

function extractContributor(cell) {
  return normalizeWhitespace(cell.text()) || null;
}

function extractGameTitleFromBlock(table) {
  const rows = table.find("tr");
  const titleRow = rows.eq(1);
  const raw = normalizeWhitespace(titleRow.find("td").first().text());
  return raw.replace(/\s+maps$/i, "").trim();
}

function buildReviewRequired(gameTitle, variantLabel) {
  return /\b(unlicensed|prototype|unmarked)\b/i.test(String(gameTitle || ""))
    || /\b(unlicensed|prototype|unmarked)\b/i.test(String(variantLabel || ""));
}

function parsePlatformPage(html, pageUrl, section) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const records = [];
  const platformRaw = normalizePlatformLabel(section.label);

  $("table[border]").each((_, tableEl) => {
    const table = $(tableEl);
    const anchorEl = table.find("tr").first().find("a[name]").first();
    const blockAnchor = normalizeWhitespace(anchorEl.attr("name"));
    if (!blockAnchor) {
      return;
    }

    const gameTitle = extractGameTitleFromBlock(table);
    if (!gameTitle) {
      return;
    }

    const copyrightText = normalizeWhitespace(table.find("tr").eq(1).find("td").eq(1).text());

    table.find("tr").slice(2).each((__, rowEl) => {
      const cells = $(rowEl).find("td");
      if (cells.length < 6) {
        return;
      }

      const anchors = cells.find("a[href]");
      const assetAnchor = anchors
        .toArray()
        .map((anchor) => $(anchor))
        .find((anchor) => /\.(png|gif|jpg|jpeg)$/i.test(String(anchor.attr("href") || "")));

      if (!assetAnchor) {
        return;
      }

      const assetHref = assetAnchor.attr("href");
      const assetUrl = absolutizeUrl(pageUrl, assetHref);
      if (!assetUrl) {
        return;
      }

      const firstCellText = normalizeWhitespace(cells.eq(0).text());
      const secondCellText = normalizeWhitespace(cells.eq(1).text());
      const anchorText = normalizeWhitespace(assetAnchor.text());
      const variantLabel = secondCellText || anchorText || firstCellText;
      const dimensions = normalizeWhitespace(cells.eq(2).text());
      const fileSize = normalizeWhitespace(`${cells.eq(3).text()} ${cells.eq(4).text()}`);
      const format = normalizeWhitespace(cells.eq(5).text());
      const ripMethod = normalizeWhitespace(cells.eq(6).text());
      const contributor = extractContributor(cells.eq(7));
      const reviewRequired = buildReviewRequired(gameTitle, variantLabel);

      records.push({
        title_raw: gameTitle,
        platform_raw: platformRaw,
        record_url: `${pageUrl}#${blockAnchor}`,
        detail_url: assetUrl,
        content_type: "game_map_asset",
        variant_label: variantLabel || null,
        contributor_raw: contributor,
        preview_url_raw: assetUrl,
        raw_payload_json: {
          atlas_anchor: section.anchor,
          block_anchor: blockAnchor,
          block_title: gameTitle,
          variant_label: variantLabel || null,
          dimensions,
          file_size: fileSize || null,
          format: format || null,
          rip_method: ripMethod || null,
          contributor: contributor || null,
        },
        source_context: {
          atlas_anchor: section.anchor,
          atlas_label: section.label,
          source_section: "platform_page",
          block_anchor: blockAnchor,
          block_title: gameTitle,
          block_copyright: copyrightText || null,
          variant_label: variantLabel || null,
          dimensions: dimensions || null,
          file_size: fileSize || null,
          format: format || null,
          rip_method: ripMethod || null,
          contributor: contributor || null,
          review_required: reviewRequired,
        },
        asset_type_guess: "map",
        asset_subtype: "atlas_map",
      });
    });
  });

  return records;
}

module.exports = {
  extractSections,
  parsePlatformPage,
};
