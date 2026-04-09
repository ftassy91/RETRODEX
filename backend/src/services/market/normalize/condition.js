'use strict'

const CONDITION_PATTERNS = [
  {
    condition: 'Mint',
    confidence: 0.95,
    keywords: ['factory sealed', 'brand new', 'new sealed', 'sealed', 'unopened'],
  },
  {
    condition: 'CIB',
    confidence: 0.88,
    keywords: ['complete in box', 'cib', 'with box and manual', 'boxed complete', 'complete'],
  },
  {
    condition: 'Loose',
    confidence: 0.82,
    keywords: ['cart only', 'cartridge only', 'disc only', 'game only', 'loose', 'no box'],
  },
]

// Japanese condition markers — matched against raw (pre-normalization) strings
// because normalizeText() strips CJK characters.
// Priority: first match wins (ordered from best to worst condition).
const JP_CONDITION_PATTERNS = [
  // Mint / sealed
  { condition: 'Mint', confidence: 0.97, regex: /新品|未開封/ },
  { condition: 'Mint', confidence: 0.92, regex: /未使用$|未使用[^\s]/ },
  { condition: 'Mint', confidence: 0.85, regex: /未使用に近い/ },
  // CIB — box present
  { condition: 'CIB', confidence: 0.90, regex: /箱付き|完品|箱・説明書|箱説付き|箱説あり/ },
  // Loose — software only or explicit no-box
  { condition: 'Loose', confidence: 0.85, regex: /ソフトのみ|カセットのみ|ディスクのみ|本体のみ|ソフト単品/ },
  // Yahoo auction condition labels (システム条件)
  { condition: 'Loose', confidence: 0.80, regex: /目立った傷や汚れなし/ },
  { condition: 'Loose', confidence: 0.72, regex: /やや傷や汚れあり|傷や汚れあり|全体的に状態が悪い/ },
]

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function matchJapaneseCondition(rawText) {
  if (!rawText) return null
  const text = String(rawText)
  for (const entry of JP_CONDITION_PATTERNS) {
    if (entry.regex.test(text)) {
      return { condition: entry.condition, confidence: entry.confidence, keyword: entry.regex.source }
    }
  }
  return null
}

// options.sourceMarket — when 'jp', apply Japanese patterns and JP-specific fallback
function normalizeCondition(rawTitle, rawHint, options = {}) {
  // 1. Try Japanese patterns first on hint (explicit condition label from connector)
  const jpHintMatch = matchJapaneseCondition(rawHint)
  if (jpHintMatch) {
    return { ...jpHintMatch, confidence: 1 } // from explicit hint → max confidence
  }

  // 2. Try Japanese patterns on title
  const jpTitleMatch = matchJapaneseCondition(rawTitle)
  if (jpTitleMatch) {
    return jpTitleMatch
  }

  // 3. Fall back to English keyword matching
  const hint = normalizeText(rawHint)
  const title = normalizeText(rawTitle)
  const text = [hint, title].filter(Boolean).join(' ')

  for (const entry of CONDITION_PATTERNS) {
    for (const keyword of entry.keywords) {
      const normalizedKeyword = normalizeText(keyword)
      if (!normalizedKeyword) {
        continue
      }

      if (hint && hint.includes(normalizedKeyword)) {
        return {
          condition: entry.condition,
          confidence: 1,
          keyword,
        }
      }

      if (text.includes(normalizedKeyword)) {
        return {
          condition: entry.condition,
          confidence: entry.confidence,
          keyword,
        }
      }
    }
  }

  // 4. JP source fallback — most JP retro game lots are loose software.
  //    Assign 'Loose' with low confidence rather than blocking the observation.
  if (options.sourceMarket === 'jp') {
    return {
      condition: 'Loose',
      confidence: 0.35,
      keyword: 'jp_source_default',
    }
  }

  return {
    condition: null,
    confidence: 0,
    keyword: null,
  }
}

module.exports = {
  normalizeCondition,
}
