'use strict'

const { PLATFORM_ALIASES } = require('./constants')

function normalizeKey(value) {
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
    const normalized = normalizeKey(candidate)
    if (!normalized) continue

    for (const [alias, platform] of Object.entries(PLATFORM_ALIASES)) {
      if (normalized.includes(alias)) {
        return {
          platform: platform,
          confidence: candidate === rawHint ? 1 : 0.8,
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
  normalizePlatformKey: normalizeKey,
}
