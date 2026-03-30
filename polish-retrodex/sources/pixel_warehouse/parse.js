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

module.exports = {
  parseGameListPage,
};
