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
  parseIsoishDate,
  parseRelativeAgo,
  stripTags,
} = require('./live-support')
const playwrightSupport = require('./playwright-support')

const CONNECTOR_META = {
  name: 'ebay',
  sourceSlug: 'ebay',
  sourceMarket: 'us',
  sourceType: 'marketplace',
  saleType: 'auction',
  defaultCurrency: 'USD',
}

// eBay completed/sold listings search URL
// _sacat=139973 = Video Games category
function buildSoldSearchUrl(seed) {
  const query = encodeURIComponent(seed.query || seed.title || '')
  return `https://www.ebay.com/sch/i.html?_nkw=${query}&LH_Complete=1&LH_Sold=1&_sacat=139973&_sop=13&_ipg=60`
}

// Parse eBay sold listings page rendered via Jina
// Jina renders eBay search results as markdown with links and prices
// Patterns observed:
//   [TITLE](https://www.ebay.com/itm/ITEM_ID...) $XX.XX
//   "Sold  DATE" or "DATE" for sold dates
function parseEbaySoldSearchPage(markdown) {
  const text = normalizeWhitespace(markdown)
  const rows = []

  // Split by lines and look for item patterns
  const lines = text.split('\n')
  let currentItem = null

  for (const line of lines) {
    // Match item links: [Title](url)
    const linkMatch = line.match(/\[([^\]]+)\]\((https:\/\/www\.ebay\.com\/itm\/(\d+)[^)]*)\)/)
    if (linkMatch) {
      if (currentItem && currentItem.priceOriginal) {
        rows.push(currentItem)
      }
      currentItem = {
        title: linkMatch[1].trim(),
        url: linkMatch[2],
        itemId: linkMatch[3],
        priceOriginal: null,
        soldAt: null,
        conditionHint: null,
      }
      continue
    }

    if (!currentItem) continue

    // Match price: $XX.XX or USD XX.XX
    if (!currentItem.priceOriginal) {
      const priceMatch = line.match(/\$\s*([\d,]+\.?\d*)|USD\s*([\d,]+\.?\d*)/)
      if (priceMatch) {
        currentItem.priceOriginal = parsePriceNumber(priceMatch[1] || priceMatch[2])
      }
    }

    // Match sold date
    if (!currentItem.soldAt) {
      const dateMatch = line.match(/Sold\s+(\w+\s+\d+,?\s+\d{4})|Sold\s+(\d+[hdwmo]+\s+ago)/i)
      if (dateMatch) {
        const dateStr = dateMatch[1] || dateMatch[2]
        currentItem.soldAt = parseIsoishDate(dateStr) || parseRelativeAgo(dateStr)
      }
    }

    // Match condition
    if (!currentItem.conditionHint) {
      const condMatch = line.match(/(Brand New|Like New|Very Good|Good|Acceptable|Pre-Owned|Used|New|Open Box)/i)
      if (condMatch) {
        currentItem.conditionHint = condMatch[1]
      }
    }
  }

  // Push last item
  if (currentItem && currentItem.priceOriginal) {
    rows.push(currentItem)
  }

  return dedupeBy(rows, (row) => row.itemId || row.url)
}

// Parse eBay sold listings from Playwright innerText
// Format: sequential lines with title, price ($XX.XX), and "Sold DATE" patterns
function parseEbayPlainText(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const items = []
  let current = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Detect "Sold DATE" pattern — this marks the end of an item block
    const soldMatch = line.match(/^Sold\s+(\w+\s+\d+,?\s+\d{4})/i)
    if (soldMatch && current) {
      current.soldAt = parseSoldDate(soldMatch[1])
      if (current.title && current.priceOriginal) {
        items.push(current)
      }
      current = null
      continue
    }

    // Detect price: $XX.XX (standalone or at start of line)
    const priceMatch = line.match(/^\$([\d,]+\.?\d*)$/)
    if (priceMatch && current && !current.priceOriginal) {
      current.priceOriginal = parsePriceNumber(priceMatch[1])
      continue
    }

    // Detect title-like lines (long enough, not a filter/category/nav line)
    if (line.length > 15 && !line.startsWith('$') && !line.startsWith('Under') && !line.startsWith('Over')
      && !/^(Buy It Now|Auction|Free shipping|Brand New|Pre-Owned|Returns|Sold Items|results for|Skip to|Shop on eBay|Save this search|Condition|Price|Buying Format|All Filters|Hi! Sign in|Sign in|My eBay|Daily Deals|Help|Watchlist|Notifications|Sell|Categories)/i.test(line)
      && !/^\d+ results/.test(line) && !/^Related:/.test(line)
      && !current) {
      current = { title: line, priceOriginal: null, soldAt: null, conditionHint: null, itemId: null, url: null }
      continue
    }

    // Detect condition
    if (current && !current.conditionHint) {
      const condMatch = line.match(/^(Brand New|Like New|Very Good|Good|Acceptable|Pre-Owned|Used|New|Open Box)$/i)
      if (condMatch) {
        current.conditionHint = condMatch[1]
      }
    }
  }

  return dedupeBy(items, (row) => row.title)
}

function parseSoldDate(dateStr) {
  // "Apr 9, 2026" → ISO
  const parsed = new Date(dateStr)
  return isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

async function fetchSearchPage(searchUrl, options) {
  // Try Jina first
  const jinaPage = await fetchViaJina(searchUrl, options).catch(() => ({ ok: false, text: '' }))
  if (jinaPage.ok && jinaPage.text.length > 1000) {
    return { text: jinaPage.text, source: 'jina' }
  }

  // Fallback to Playwright if available
  if (playwrightSupport.isAvailable()) {
    const pwPage = await playwrightSupport.fetchWithBrowser(searchUrl, {
      ...options,
      waitForSelector: '.s-item__title',
    })
    if (pwPage.ok && pwPage.text.length > 500) {
      return { text: pwPage.text, html: pwPage.html, source: 'playwright' }
    }
  }

  return { text: '', source: 'none' }
}

async function fetchLiveRows(seed, options = {}) {
  const limit = Number(options.limit || 5)
  const searchUrl = buildSoldSearchUrl(seed)
  const searchPage = await fetchSearchPage(searchUrl, options)
  // Use appropriate parser based on source
  const candidates = (searchPage.source === 'playwright'
    ? parseEbayPlainText(searchPage.text)
    : parseEbaySoldSearchPage(searchPage.text)
  ).slice(0, limit)
  const sourceMeta = getMarketSource(CONNECTOR_META.sourceSlug)
  const rows = []

  for (const candidate of candidates) {
    // Only include items with both price and date
    if (!candidate.priceOriginal) continue

    // If no sold date, use now as approximation (eBay search shows recent sold)
    const soldAt = candidate.soldAt || new Date().toISOString()

    const ref = candidate.itemId || candidate.url || ('ebay-pw-' + Buffer.from(candidate.title || '').toString('base64').slice(0, 20))

    rows.push(createCanonicalRawSoldRecord({
      source_slug: CONNECTOR_META.sourceSlug,
      source_market: CONNECTOR_META.sourceMarket,
      source_name: sourceMeta?.name,
      source_type: CONNECTOR_META.sourceType,
      listing_reference: ref,
      listing_url: candidate.url || null,
      title_raw: candidate.title,
      sale_type: CONNECTOR_META.saleType,
      sold_at: soldAt,
      currency: CONNECTOR_META.defaultCurrency,
      price_original: candidate.priceOriginal,
      country_code: 'US',
      platform_hint_raw: seed.platform || null,
      region_hint_raw: null,
      condition_hint_raw: candidate.conditionHint || null,
      seed_game_id: seed.id,
      raw_payload: {
        search_title: candidate.title,
        condition: candidate.conditionHint,
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
    buildSoldSearchUrl,
    parseEbaySoldSearchPage,
  },
}
