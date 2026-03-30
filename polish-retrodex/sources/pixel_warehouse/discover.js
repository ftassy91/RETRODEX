"use strict";

const { normalizePlatform } = require("../../core/normalize-platforms");
const {
  fetchText,
  normalizeWhitespace,
} = require("../../core/shared");
const { parseGameListPage } = require("./parse");

function buildPageUrl(indexUrl, pageNumber) {
  if (pageNumber <= 1) {
    return indexUrl;
  }
  return new URL(String(pageNumber), indexUrl).toString();
}

function buildScopeSet(scopes) {
  return new Set(
    (scopes || [])
      .filter((scope) => scope.startsWith("platform:"))
      .map((scope) => normalizePlatform(scope.slice("platform:".length)).normalized),
  );
}

async function discover({ config, scopes = [], limit = 0, checkpoint = {} }) {
  const scopeSet = buildScopeSet(scopes);
  const firstPage = checkpoint.last_page ? checkpoint.last_page + 1 : 1;
  const bootstrap = await fetchText(buildPageUrl(config.index_url, 1));
  if (!bootstrap.ok) {
    throw new Error(`Pixel Warehouse bootstrap failed with status ${bootstrap.status}.`);
  }

  const bootstrapParsed = parseGameListPage(bootstrap.text, bootstrap.url);
  const maxPages = limit > 0 ? Math.min(limit, bootstrapParsed.pagination_pages) : bootstrapParsed.pagination_pages;
  const discovered = [];

  for (let page = firstPage; page <= maxPages; page += 1) {
    const response = page === 1 ? bootstrap : await fetchText(buildPageUrl(config.index_url, page));
    if (!response.ok) {
      throw new Error(`Pixel Warehouse page ${page} failed with status ${response.status}.`);
    }

    const parsed = parseGameListPage(response.text, response.url);
    for (const record of parsed.records) {
      const platformCanonical = normalizePlatform(record.platform_raw).normalized;
      if (scopeSet.size && !scopeSet.has(platformCanonical)) {
        continue;
      }

      discovered.push({
        ...record,
        platform_raw: normalizeWhitespace(record.platform_raw),
      });
    }
  }

  return {
    records: discovered,
    checkpoint: {
      last_page: maxPages,
      total_pages: maxPages,
    },
    stats: {
      fetched_pages: Math.max(0, maxPages - firstPage + 1),
      total_records: discovered.length,
      platform_filters: [...scopeSet],
    },
  };
}

module.exports = {
  discover,
};
