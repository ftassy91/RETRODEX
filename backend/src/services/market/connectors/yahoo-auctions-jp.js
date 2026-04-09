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
  parseJapaneseDateTime,
  parsePriceNumber,
} = require('./live-support')

const CONNECTOR_META = {
  name: 'yahoo_auctions_jp',
  sourceSlug: 'yahoo_auctions_jp',
  sourceMarket: 'jp',
  sourceType: 'marketplace',
  saleType: 'auction',
  defaultCurrency: 'JPY',
}

function buildClosedSearchUrl(seed) {
  const query = encodeURIComponent(seed.query || seed.title || '')
  return `https://auctions.yahoo.co.jp/closedsearch/closedsearch?p=${query}&fixed=0&auccat=27727&b=1`
}

// Jina proxy renders Yahoo listing as image-link markdown:
//   [![Image N: TITLE](img_url)](https://auctions.yahoo.co.jp/jp/auction/ID) score% region
// Price is NOT present in the search listing — extracted from the detail page instead.
function parseYahooClosedSearchPage(markdown) {
  const text = normalizeWhitespace(markdown)
  const rows = []

  // Match image-links pointing to auction detail pages
  const RE = /\[!\[Image \d+: ([^\]]*)\]\([^)]+\)\]\((https:\/\/auctions\.yahoo\.co\.jp\/jp\/auction\/([a-z0-9]+))[^)]*\)/gi
  let match
  while ((match = RE.exec(text)) !== null) {
    rows.push({
      title: match[1].trim(),
      url: match[2],
      auctionId: match[3],
      priceOriginal: null, // resolved from detail page
    })
  }

  return dedupeBy(rows, (row) => row.url)
}

// Parse a Yahoo auction detail page rendered via Jina proxy.
// Jina injects a metadata header: "Title: ...\n\nURL Source: ...\n\nMarkdown Content:\n"
// The actual auction starts with "このオークションは終了しています".
//
// Price patterns observed on ended lots:
//   "即決 444 円（税0円）"                  → immediate-buy price
//   "落札価格 X 円"                         → won price for bid auctions
//   "現在の価格 X 円"                       → current/final price
//   "| 開始時の価格 | 444 円（税0円） |"    → start price (= BIN when 即決)
// End-time pattern:
//   "| 終了日時 | 2026年4月8日（水）23時25分 |"
function parseYahooAuctionPage(markdown) {
  const text = normalizeWhitespace(markdown)

  // Confirm lot is ended
  const isEnded = /このオークションは終了しています/.test(text)
  if (!isEnded) {
    return { title: null, soldAt: null, priceOriginal: null, conditionHint: null, description: null }
  }

  // Title: second non-empty line after "このオークションは終了しています"
  const titleMatch = text.match(/このオークションは終了しています\n\n([^\n]+)/)

  // End date/time (sold_at)
  const endMatch = text.match(/\|\s*終了日時\s*\|\s*([^\n|]+)\s*\|/)

  // Price: try in priority order
  // 1. 落札価格 (won price — true auctions)
  // 2. 即決 X 円 (immediate buy)
  // 3. 開始時の価格 (start = BIN price when item sold at BIN with no bids)
  const pricePatterns = [
    /落札価格\s+([\d,]+)\s*円/,
    /即決\s+([\d,]+)\s*円/,
    /\|\s*開始時の価格\s*\|\s*([\d,]+)\s*円/,
  ]
  let priceOriginal = null
  for (const pattern of pricePatterns) {
    const m = text.match(pattern)
    if (m) {
      priceOriginal = parsePriceNumber(m[1])
      break
    }
  }

  // Condition
  const conditionMatch = text.match(/\*\s+(新品|未使用|未使用に近い|目立った傷や汚れなし|やや傷や汚れあり|傷や汚れあり|全体的に状態が悪い)/)

  // Description
  const descriptionMatch = text.match(/## 商品説明\n\n([\s\S]*?)\n\n(?:残り時間|送料、商品の受け取りについて|##)/)

  return {
    title: titleMatch ? titleMatch[1].trim() : null,
    soldAt: endMatch ? parseJapaneseDateTime(endMatch[1]) : null,
    priceOriginal,
    conditionHint: conditionMatch ? conditionMatch[1].trim() : null,
    description: descriptionMatch ? descriptionMatch[1].trim() : null,
  }
}

async function fetchLiveRows(seed, options = {}) {
  const searchPage = await fetchViaJina(buildClosedSearchUrl(seed), options)
  const candidates = parseYahooClosedSearchPage(searchPage.text).slice(0, Number(options.limit || 5))
  const sourceMeta = getMarketSource(CONNECTOR_META.sourceSlug)
  const rows = []

  for (const candidate of candidates) {
    const detailPage = await fetchViaJina(candidate.url, options)
    const parsed = parseYahooAuctionPage(detailPage.text)
    // Both soldAt AND priceOriginal must be resolved from the detail page
    if (!parsed.soldAt || !parsed.priceOriginal) {
      continue
    }

    rows.push(createCanonicalRawSoldRecord({
      source_slug: CONNECTOR_META.sourceSlug,
      source_market: CONNECTOR_META.sourceMarket,
      source_name: sourceMeta?.name,
      source_type: CONNECTOR_META.sourceType,
      listing_reference: candidate.auctionId || (candidate.url.match(/\/auction\/([a-z0-9]+)/i) || [])[1] || candidate.url,
      listing_url: candidate.url,
      title_raw: parsed.title || candidate.title,
      sale_type: CONNECTOR_META.saleType,
      sold_at: parsed.soldAt,
      currency: CONNECTOR_META.defaultCurrency,
      price_original: parsed.priceOriginal,
      country_code: 'JP',
      platform_hint_raw: seed.platform || null,
      region_hint_raw: 'NTSC-J',
      condition_hint_raw: parsed.conditionHint || null,
      seed_game_id: seed.id,
      raw_payload: {
        search_title: candidate.title,
        description: parsed.description,
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
    buildClosedSearchUrl,
    parseYahooAuctionPage,
    parseYahooClosedSearchPage,
  },
}
