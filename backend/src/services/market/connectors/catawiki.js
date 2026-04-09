'use strict'

const { createCanonicalRawSoldRecord } = require('../contract')
const { getMarketSource } = require('../source-registry')
const {
  ensureSeed,
  loadFixtureRows,
  mapFixtureRowsToCanonical,
} = require('./base')
const {
  dedupeBy,
  fetchViaJina,
  normalizeWhitespace,
  parsePriceNumber,
  parseRelativeAgo,
} = require('./live-support')

const CONNECTOR_META = {
  name: 'catawiki',
  sourceSlug: 'catawiki',
  sourceMarket: 'eu',
  sourceType: 'auction_house',
  saleType: 'auction',
  defaultCurrency: 'EUR',
}

// Catawiki search page via Jina proxy.
// NOTE: the ?status=sold query param is JavaScript-driven on the Catawiki frontend;
// Jina fetches the server-rendered page which may show all lots (open + recently closed).
// We discover lot IDs here and rely on parseCatawikiLotPage() to skip open lots.
function buildSearchUrl(seed) {
  const q = encodeURIComponent(seed.query || seed.title || '')
  return `https://www.catawiki.com/en/s?q=${q}&status=sold`
}

// Catawiki search page renders image-links:
//   [![Image N](img_url) TITLE STATUS €PRICE TIME_OR_STATUS](https://www.catawiki.com/en/l/LOTID-slug?...)
// We extract lot IDs and canonical URLs (without query params).
function parseSearchPage(markdown) {
  const text = normalizeWhitespace(markdown)
  const rows = []

  // Match image-link blocks pointing to lot detail pages
  const RE = /\[!\[Image \d+\]\([^)]+\)\s+([^\]]*?)\]\((https:\/\/www\.catawiki\.com\/[a-z]{2}\/l\/(\d+)[^)]*)\)/gi
  let match
  while ((match = RE.exec(text)) !== null) {
    const rawTitle = match[1].trim()
    const fullUrl = match[2]
    const lotId = match[3]
    const canonicalUrl = `https://www.catawiki.com/en/l/${lotId}`

    // Skip clearly open lots: search card text contains "days left" / "hours left"
    if (/\d+\s+(?:days?|hours?)\s+left/i.test(rawTitle)) {
      continue
    }

    rows.push({ url: canonicalUrl, lotId, rawTitle: rawTitle.replace(/\s*(Starting bid|Current bid)[^€]*€[\d,.\s]+$/i, '').trim() })
  }

  return dedupeBy(rows, (row) => row.lotId)
}

// Parse a Catawiki lot detail page (sold).
// Expected structure (via Jina proxy, sold lot):
//   # TITLE - auction online Catawiki
//   ...
//   Sold                        ← marker
//   Final bid                   ← marker
//    € 1,900                    ← price
//   3 weeks ago                 ← relative date
function parseCatawikiLotPage(markdown) {
  const text = normalizeWhitespace(markdown)

  // Must contain "Sold" marker
  if (!/\bSold\b/i.test(text)) {
    return null
  }

  const titleMatch = text.match(/#\s+(.+?)\s+-\s+auction online Catawiki/i)

  // "Final bid\n\n € 1,900\n\nX weeks ago" — various whitespace configs
  const soldMatch = (
    text.match(/Final bid\s+€\s*([\d,.]+)\s+(\d+\s*(?:h|d|w|mo|hour|hours|day|days|week|weeks|month|months)\s+ago)/i)
    || text.match(/Final bid\s*\n+\s*€\s*([\d,.]+)\s*\n+\s*(\d+\s*(?:h|d|w|mo|hour|hours|day|days|week|weeks|month|months)\s+ago)/i)
    || text.match(/Final bid\s*\n+\s*([\d,.]+)\s*\n+\s*(\d+\s*(?:h|d|w|mo|hour|hours|day|days|week|weeks|month|months)\s+ago)/i)
  )

  if (!soldMatch) {
    return null
  }

  const descriptionMatch = (
    text.match(/Selected by [^\n]+\n\n([\s\S]*?)\n\nShow all info/i)
    || text.match(/# .+?\n\n[\s\S]*?\n\n([\s\S]*?)\n\nShow all info/i)
  )

  return {
    title: titleMatch ? titleMatch[1].trim() : null,
    priceOriginal: parsePriceNumber(soldMatch[1]),
    soldAt: parseRelativeAgo(soldMatch[2]),
    conditionHint: descriptionMatch ? descriptionMatch[1].trim().slice(0, 200) : null,
    description: descriptionMatch ? descriptionMatch[1].trim() : null,
  }
}

async function fetchLiveRows(seed, options = {}) {
  const searchPage = await fetchViaJina(buildSearchUrl(seed), options)
  const candidates = parseSearchPage(searchPage.text).slice(0, Number(options.limit || 8))
  const sourceMeta = getMarketSource(CONNECTOR_META.sourceSlug)
  const rows = []

  for (const candidate of candidates) {
    const page = await fetchViaJina(candidate.url, options)
    const parsed = parseCatawikiLotPage(page.text)
    if (!parsed || !parsed.priceOriginal || !parsed.soldAt) {
      // Lot still open or not parsable — skip silently
      continue
    }

    rows.push(createCanonicalRawSoldRecord({
      source_slug: CONNECTOR_META.sourceSlug,
      source_market: CONNECTOR_META.sourceMarket,
      source_name: sourceMeta?.name,
      source_type: CONNECTOR_META.sourceType,
      listing_reference: candidate.lotId,
      listing_url: candidate.url,
      title_raw: parsed.title || candidate.rawTitle,
      sale_type: CONNECTOR_META.saleType,
      sold_at: parsed.soldAt,
      currency: CONNECTOR_META.defaultCurrency,
      price_original: parsed.priceOriginal,
      country_code: 'EU',
      platform_hint_raw: seed.platform || null,
      region_hint_raw: 'PAL',
      condition_hint_raw: parsed.conditionHint || null,
      seed_game_id: seed.id,
      raw_payload: {
        search_title: candidate.rawTitle,
        page_excerpt: parsed.description,
        sold_at_precision: 'relative_ago',
      },
    }))
  }

  return rows
}

module.exports = {
  ...CONNECTOR_META,
  async fetchSoldRecords(seedInput = {}, options = {}) {
    const seed = ensureSeed(seedInput)
    const fixtureRows = loadFixtureRows(CONNECTOR_META.sourceSlug, options)
    if (fixtureRows.length) {
      return mapFixtureRowsToCanonical(fixtureRows, CONNECTOR_META, seed)
    }
    return fetchLiveRows(seed, options)
  },
  _internals: {
    buildSearchUrl,
    parseSearchPage,
    parseCatawikiLotPage,
  },
}
