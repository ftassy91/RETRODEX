"use strict";

const cheerio = require("cheerio");

const { absolutizeUrl, normalizeWhitespace } = require("../../core/shared");

function parseGameListPage(html, pageUrl) {
  const $ = cheerio.load(html);
  const records = [];
  const paginationPages = Math.max(
    1,
    ...$("ul.pagination a")
      .map((_, anchor) => Number.parseInt($(anchor).text().trim(), 10))
      .get()
      .filter(Number.isFinite),
  );

  $("#listBody tr").each((_, row) => {
    const cells = $(row).find("td");
    const anchor = cells.eq(0).find("a").first();
    const titleRaw = normalizeWhitespace(anchor.text());
    const platformRaw = normalizeWhitespace(cells.eq(1).text());
    const detailUrl = absolutizeUrl(pageUrl, anchor.attr("href"));

    if (!titleRaw || !platformRaw || !detailUrl) {
      return;
    }

    records.push({
      title_raw: titleRaw,
      platform_raw: platformRaw,
      record_url: detailUrl,
      detail_url: detailUrl,
      content_type: "game_listing",
      variant_label: null,
      contributor_raw: null,
      preview_url_raw: null,
      raw_payload_json: {
        title_raw: titleRaw,
        platform_raw: platformRaw,
        page_url: pageUrl,
      },
      source_context: {
        listing_page: pageUrl,
        pagination_pages: paginationPages,
      },
      asset_type_guess: null,
      asset_subtype: null,
    });
  });

  return {
    records,
    pagination_pages: paginationPages,
  };
}

function parseGameDetailPage(html, pageUrl) {
  const $ = cheerio.load(html);
  const titleLine = normalizeWhitespace($(".card-title").first().text());
  const contributors = $("#contributors a")
    .map((_, anchor) => normalizeWhitespace($(anchor).text()))
    .get()
    .filter(Boolean);
  const spriteCount = Number.parseInt(normalizeWhitespace($("#spriteCount").first().text()), 10);
  const zipUrl = absolutizeUrl(pageUrl, $("#download").attr("href"));
  const inlineSpriteCount = $("#spriteArea img").length;

  return {
    title_line: titleLine || null,
    contributor_names: contributors,
    contributor_raw: contributors.length ? contributors.join(", ") : null,
    sprite_count: Number.isFinite(spriteCount) ? spriteCount : inlineSpriteCount || null,
    zip_url: zipUrl || null,
    inline_sprite_count: inlineSpriteCount,
    has_zip_download: Boolean(zipUrl),
  };
}

module.exports = {
  parseGameListPage,
  parseGameDetailPage,
};
