'use strict'

const { createCanonicalRawSoldRecord } = require('../contract')
const { getMarketSource } = require('../source-registry')
const {
  ensureSeed,
  loadFixtureRows,
  mapFixtureRowsToCanonical,
} = require('./base')
const {
  fetchText,
  fetchViaJina,
  normalizeWhitespace,
  parseIsoishDate,
  parsePriceNumber,
} = require('./live-support')

const CONNECTOR_META = {
  name: 'mercari_us',
  sourceSlug: 'mercari_us',
  sourceMarket: 'us',
  sourceType: 'marketplace',
  saleType: 'fixed_price_sold',
  defaultCurrency: 'USD',
}

// Mercari US search is protected by bot detection (Cloudflare / in-house) that
// returns 403 to both direct fetch and Jina proxy. No reliable server-rendered
// search endpoint is currently accessible without a headless browser session.
//
// Discovery strategy: parse Mercari item URLs from Bing HTML snippets, then
// fetch each item page via Jina. If Bing returns no links, we return [] and
// the caller falls back to fixtures.
//
// Item detail pages ARE accessible via Jina for sold items.
// Format (sold): "SOLD OUT\n\nItem sold\n\n### TITLE\n\n$XX.XX\n\n..."

function buildItemUrl(itemId) {
  return `https://www.mercari.com/us/item/${itemId}/`
}

// Attempt to discover sold Mercari US item IDs from Bing HTML results.
async function discoverFromBing(seed, options = {}) {
  const query = `mercari.com/us/item ${seed.query || seed.title || ''} sold`
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`
  const page = await fetchText(url, options)
  const text = String(page.text || '')
  const matches = [...text.matchAll(/https?:\/\/www\.mercari\.com\/us\/item\/(m\d{8,})/gi)]
  const seen = new Set()
  const results = []
  for (const match of matches) {
    const itemId = match[1]
    if (!seen.has(itemId)) {
      seen.add(itemId)
      results.push({ itemId, href: buildItemUrl(itemId) })
    }
  }
  return results
}

// Parse a Mercari US item detail page fetched via Jina proxy (sold items only).
// Structure observed on sold items:
//   SOLD OUT
//   Item sold
//   ### TITLE
//   CONDITION | CATEGORY
//   $XX.XX
//   Posted MM/DD/YY
function parseMercariItemPage(markdown) {
  const text = normalizeWhitespace(markdown)

  const isSold = /SOLD\s*OUT/i.test(text) && /Item\s+sold/i.test(text)
  if (!isSold) {
    return null
  }

  // Title: first heading after "Item sold"
  const titleMatch = text.match(/Item\s+sold\s*\n+\s*#+\s*(.+?)\n/)
  // Price: first $ amount after Item sold block
  const priceMatch = text.match(/Item\s+sold[\s\S]{0,200}\$\s*(\d[\d,.]*)/i)
  // Posted date: MM/DD/YY format
  const postedMatch = text.match(/Posted\s+(\d{2}\/\d{2}\/\d{2})/i)
  // Condition hint: line between title and price
  const conditionMatch = text.match(/Item\s+sold\s*\n+\s*#+\s*.+?\n+([^\n$#]+?)(?:\n|\$)/i)

  if (!priceMatch) {
    return null
  }

  return {
    title: titleMatch ? titleMatch[1].trim() : null,
    priceOriginal: parsePriceNumber(priceMatch[1]),
    postedAt: postedMatch ? parseIsoishDate(postedMatch[1]) : null,
    conditionHint: conditionMatch ? conditionMatch[1].trim() : null,
  }
}

async function fetchLiveRows(seed, options = {}) {
  // Step 1: discover item IDs via Bing
  let candidates = []
  try {
    candidates = await discoverFromBing(seed, options)
  } catch (_err) {
    // Discovery failure — fall through to empty result
  }

  if (!candidates.length) {
    // Mercari's antibot blocks all known server-side approaches.
    // Return empty array; caller falls back to fixtures if configured.
    return []
  }

  const sourceMeta = getMarketSource(CONNECTOR_META.sourceSlug)
  const rows = []
  const limit = Number(options.limit || 5)

  for (const candidate of candidates.slice(0, limit)) {
    let page
    try {
      page = await fetchViaJina(candidate.href, options)
    } catch (_err) {
      continue
    }

    const parsed = parseMercariItemPage(page.text)
    if (!parsed || !parsed.priceOriginal || !parsed.postedAt) {
      continue
    }

    rows.push(createCanonicalRawSoldRecord({
      source_slug: CONNECTOR_META.sourceSlug,
      source_market: CONNECTOR_META.sourceMarket,
      source_name: sourceMeta?.name,
      source_type: CONNECTOR_META.sourceType,
      listing_reference: candidate.itemId,
      listing_url: candidate.href,
      title_raw: parsed.title,
      sale_type: CONNECTOR_META.saleType,
      sold_at: parsed.postedAt,
      currency: CONNECTOR_META.defaultCurrency,
      price_original: parsed.priceOriginal,
      country_code: 'US',
      platform_hint_raw: seed.platform || null,
      region_hint_raw: 'NTSC-U',
      condition_hint_raw: parsed.conditionHint || null,
      seed_game_id: seed.id,
      raw_payload: {
        sold_at_precision: 'posted_date',
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
    buildItemUrl,
    discoverFromBing,
    parseMercariItemPage,
  },
}
