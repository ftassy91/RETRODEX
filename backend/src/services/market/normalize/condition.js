'use strict'

const MINT_KEYWORDS = ['factory sealed', 'sealed', 'brand new', 'new sealed', 'shrink wrap', 'unopened']
const CIB_KEYWORDS = ['complete in box', 'complete box', 'with box', 'box manual', 'cib', 'complete', 'with manual']
const LOOSE_KEYWORDS = ['cart only', 'cartridge only', 'game only', 'disc only', 'no box', 'loose', 'cartridge']

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function detectKeywords(text, keywords, exactConfidence, partialConfidence) {
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      return {
        hit: keyword,
        confidence: keyword.includes(' ') ? exactConfidence : partialConfidence,
      }
    }
  }
  return null
}

function normalizeCondition(rawTitle, rawHint) {
  const text = normalizeText([rawTitle, rawHint].filter(Boolean).join(' '))
  if (!text) {
    return { condition: 'Unknown', confidence: 0.3, keyword: null }
  }

  const mint = detectKeywords(text, MINT_KEYWORDS, 1, 0.9)
  if (mint) return { condition: 'Mint', confidence: mint.confidence, keyword: mint.hit }

  const cib = detectKeywords(text, CIB_KEYWORDS, 1, 0.85)
  if (cib) return { condition: 'CIB', confidence: cib.confidence, keyword: cib.hit }

  const loose = detectKeywords(text, LOOSE_KEYWORDS, 1, 0.75)
  if (loose) return { condition: 'Loose', confidence: loose.confidence, keyword: loose.hit }

  return { condition: 'Unknown', confidence: 0.3, keyword: null }
}

module.exports = {
  normalizeCondition,
}
