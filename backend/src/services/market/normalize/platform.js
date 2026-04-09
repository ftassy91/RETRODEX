'use strict'

const { PLATFORM_ALIASES } = require('./constants')

function normalizePlatformKey(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizePlatform(rawTitle, rawHint) {
  const candidates = [rawHint, rawTitle]

  for (const candidate of candidates) {
    const normalized = normalizePlatformKey(candidate)
    if (!normalized) {
      continue
    }

    for (const [alias, platform] of Object.entries(PLATFORM_ALIASES)) {
      if (normalized.includes(alias)) {
        return {
          platform,
          confidence: candidate === rawHint ? 1 : 0.82,
          alias,
        }
      }
    }
  }

  return {
    platform: null,
    confidence: 0,
    alias: null,
  }
}

module.exports = {
  normalizePlatform,
  normalizePlatformKey,
}
