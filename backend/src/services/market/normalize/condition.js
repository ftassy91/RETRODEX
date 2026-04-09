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

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeCondition(rawTitle, rawHint) {
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

  return {
    condition: null,
    confidence: 0,
    keyword: null,
  }
}

module.exports = {
  normalizeCondition,
}
