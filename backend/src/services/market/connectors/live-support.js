'use strict'

function htmlDecode(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&#x2F;/gi, '/')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
}

function stripTags(value) {
  return htmlDecode(String(value || ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parsePriceNumber(value) {
  const text = String(value || '').replace(/[^\d.,-]/g, '').trim()
  if (!text) {
    return null
  }

  const commaCount = (text.match(/,/g) || []).length
  const dotCount = (text.match(/\./g) || []).length
  let normalized = text

  if (commaCount && dotCount) {
    normalized = text.replace(/,/g, '')
  } else if (commaCount && !dotCount) {
    normalized = commaCount === 1 && /,\d{2}$/.test(text)
      ? text.replace(',', '.')
      : text.replace(/,/g, '')
  }

  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : null
}

function dedupeBy(rows = [], keyFn) {
  const seen = new Set()
  const output = []
  for (const row of rows) {
    const key = keyFn(row)
    if (!key || seen.has(key)) {
      continue
    }
    seen.add(key)
    output.push(row)
  }
  return output
}

async function fetchText(url, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 30000)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': options.userAgent || 'Mozilla/5.0 (compatible; RetroDexMarketBot/0.1; +https://retrodex.app)',
        'accept-language': options.acceptLanguage || 'en-US,en;q=0.9',
        ...(options.headers || {}),
      },
    })

    const text = await response.text()
    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      text,
    }
  } finally {
    clearTimeout(timer)
  }
}

function buildJinaProxyUrl(targetUrl) {
  return `https://r.jina.ai/http://${String(targetUrl || '').replace(/^https?:\/\//i, '')}`
}

async function fetchViaJina(targetUrl, options = {}) {
  return fetchText(buildJinaProxyUrl(targetUrl), {
    ...options,
    headers: {
      'x-no-cache': 'true',
      ...(options.headers || {}),
    },
  })
}

function decodeDuckDuckGoHref(href) {
  const raw = String(href || '').trim()
  if (!raw) {
    return null
  }

  const prefixed = raw.startsWith('//') ? `https:${raw}` : raw
  try {
    const url = new URL(prefixed)
    const uddg = url.searchParams.get('uddg')
    return uddg ? decodeURIComponent(uddg) : prefixed
  } catch (_error) {
    return htmlDecode(prefixed)
  }
}

async function fetchDuckDuckGoHtml(query, options = {}) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(String(query || '').trim())}`
  return fetchText(url, options)
}

function parseDuckDuckGoHtmlResults(html) {
  const text = String(html || '')
  const results = []
  const blocks = text.split('<div class="links_main').slice(1)

  for (const block of blocks) {
    const hrefMatch = block.match(/class="result__a" href="([^"]+)"/i)
    const titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/i)
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i)
    const visibleUrlMatch = block.match(/class="result__url"[^>]*>([\s\S]*?)<\/a>/i)
    const dateMatch = block.match(/<span>&nbsp;\s*&nbsp;\s*([^<]+)<\/span>/i)

    if (!hrefMatch || !titleMatch) {
      continue
    }

    results.push({
      href: decodeDuckDuckGoHref(hrefMatch[1]),
      title: stripTags(titleMatch[1]),
      snippet: stripTags(snippetMatch ? snippetMatch[1] : ''),
      visibleUrl: stripTags(visibleUrlMatch ? visibleUrlMatch[1] : ''),
      dateText: stripTags(dateMatch ? dateMatch[1] : ''),
      rawBlock: block,
    })
  }

  return results
}

function parseUsShortDate(value) {
  const match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{2})$/)
  if (!match) {
    return null
  }

  const [, month, day, year] = match
  const fullYear = Number(year) >= 70 ? `19${year}` : `20${year}`
  return `${fullYear}-${month}-${day}T12:00:00.000Z`
}

function parseIsoishDate(value) {
  const text = String(value || '').trim()
  if (!text) {
    return null
  }

  const exact = text.match(/\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?)?/)
  if (exact) {
    const parsed = new Date(exact[0])
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }

  return parseUsShortDate(text)
}

function parseRelativeAgo(value, now = new Date()) {
  const match = String(value || '').trim().match(/(\d+)\s*(h|d|w|mo|hour|hours|day|days|week|weeks|month|months)\s+ago/i)
  if (!match) {
    return null
  }

  const amount = Number(match[1])
  if (!Number.isFinite(amount) || amount < 0) {
    return null
  }

  const unit = match[2].toLowerCase()
  const date = new Date(now)

  if (unit === 'h' || unit === 'hour' || unit === 'hours') {
    date.setHours(date.getHours() - amount)
  } else if (unit === 'd' || unit === 'day' || unit === 'days') {
    date.setDate(date.getDate() - amount)
  } else if (unit === 'w' || unit === 'week' || unit === 'weeks') {
    date.setDate(date.getDate() - (amount * 7))
  } else {
    date.setMonth(date.getMonth() - amount)
  }

  return date.toISOString()
}

function parseJapaneseDateTime(value) {
  const match = String(value || '').match(/(\d{4})年(\d{1,2})月(\d{1,2})日.*?(\d{1,2})時(\d{1,2})分/)
  if (!match) {
    return null
  }

  const [, year, month, day, hour, minute] = match
  return new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
  )).toISOString()
}

module.exports = {
  buildJinaProxyUrl,
  decodeDuckDuckGoHref,
  dedupeBy,
  fetchDuckDuckGoHtml,
  fetchText,
  fetchViaJina,
  htmlDecode,
  normalizeWhitespace,
  parseDuckDuckGoHtmlResults,
  parseIsoishDate,
  parseJapaneseDateTime,
  parsePriceNumber,
  parseRelativeAgo,
  parseUsShortDate,
  stripTags,
}
