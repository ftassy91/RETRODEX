'use strict'
// DATA: pure premium scoring helpers, no direct DB access

const {
  PREMIUM_RULESET_VERSION,
  BLOCK_WEIGHTS,
  CORE_IDENTITY_KEYS,
  EDITORIAL_KEYS,
  CREDIT_ROLE_KEYS,
  MEDIA_SIGNAL_KEYS,
  MUSIC_SIGNAL_KEYS,
  TIER_THRESHOLDS,
} = require('./rules')

function clampScore(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 0
  }
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasSubstantiveText(value, minimumLength = 70) {
  return normalizeText(value).length >= minimumLength
}

function parseMaybeJson(value, fallback = null) {
  if (value == null || value === '') {
    return fallback
  }
  if (Array.isArray(value) || typeof value === 'object') {
    return value
  }
  if (typeof value !== 'string') {
    return fallback
  }
  try {
    return JSON.parse(value)
  } catch (_error) {
    return fallback
  }
}

function countStructuredEntries(value) {
  const parsed = parseMaybeJson(value, null)
  if (Array.isArray(parsed)) {
    return parsed.filter(Boolean).length
  }
  if (parsed && typeof parsed === 'object') {
    return Object.keys(parsed).length
  }

  const text = normalizeText(value)
  if (!text) {
    return 0
  }

  return text
    .split(/[,\n;]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .length
}

function scoreBooleanBlock(keys, signals, denominator = keys.length) {
  const presentCount = keys.filter((key) => Boolean(signals[key])).length
  return {
    presentCount,
    score: denominator > 0 ? clampScore((presentCount / denominator) * 100) : 0,
  }
}

function evaluateIdentityBlock(snapshot) {
  const signals = {
    title: Boolean(snapshot.title),
    console: Boolean(snapshot.console || snapshot.consoleId),
    release: Boolean(snapshot.releaseDate || snapshot.year),
    cover: Boolean(snapshot.coverUrl || snapshot.coverImage || snapshot.media?.signals?.cover),
    editorial_seed: Boolean(snapshot.editorial?.signals?.summary || snapshot.editorial?.signals?.synopsis),
    studio_seed: Boolean(
      snapshot.credits?.signals?.developer
      || snapshot.credits?.signals?.publisher
      || snapshot.developer
      || snapshot.publisherId
    ),
  }
  const summary = scoreBooleanBlock(CORE_IDENTITY_KEYS, signals)

  return {
    signals,
    presentCount: summary.presentCount,
    score: summary.score,
    gate: CORE_IDENTITY_KEYS.every((key) => Boolean(signals[key])),
  }
}

function evaluateEditorialBlock(snapshot) {
  const signals = {
    summary: hasSubstantiveText(snapshot.summary, 70),
    synopsis: hasSubstantiveText(snapshot.synopsis, 70),
    lore: hasSubstantiveText(snapshot.lore, 80),
    characters: countStructuredEntries(snapshot.characters) > 0,
  }
  const summary = scoreBooleanBlock(EDITORIAL_KEYS, signals)

  return {
    signals,
    presentCount: summary.presentCount,
    score: summary.score,
    richEnough: summary.presentCount >= 2 && (signals.summary || signals.synopsis),
  }
}

function evaluateCreditsBlock(snapshot) {
  const roleSignals = CREDIT_ROLE_KEYS.reduce((acc, key) => {
    acc[key] = Boolean(snapshot.credits?.signals?.[key])
    return acc
  }, {})
  const summary = scoreBooleanBlock(CREDIT_ROLE_KEYS, roleSignals, 6)

  return {
    signals: roleSignals,
    distinctCount: summary.presentCount,
    score: summary.score,
    richEnough: summary.presentCount >= 2 && (roleSignals.developer || roleSignals.publisher),
  }
}

function evaluateMediaBlock(snapshot) {
  const mediaSignals = MEDIA_SIGNAL_KEYS.reduce((acc, key) => {
    acc[key] = Boolean(snapshot.media?.signals?.[key])
    return acc
  }, {})
  const summary = scoreBooleanBlock(MEDIA_SIGNAL_KEYS, mediaSignals, 4)

  return {
    signals: mediaSignals,
    distinctCount: summary.presentCount,
    score: summary.score,
    richEnough: summary.presentCount >= 2,
  }
}

function evaluateMusicBlock(snapshot) {
  const signals = {
    composers: Number(snapshot.music?.composerCount || 0) > 0,
    tracks: Number(snapshot.music?.trackCount || 0) > 0,
  }
  const summary = scoreBooleanBlock(MUSIC_SIGNAL_KEYS, signals)

  return {
    signals,
    signalCount: summary.presentCount,
    score: summary.score,
    richEnough: signals.composers && signals.tracks,
  }
}

function buildMissingCoreRequirements(blocks) {
  const missing = []

  for (const key of CORE_IDENTITY_KEYS) {
    if (!blocks.identity.signals[key]) {
      missing.push(key)
    }
  }

  if (!blocks.editorial.richEnough) {
    missing.push('editorial_richness')
  }

  return missing
}

function buildMissingDomainSignals(blocks) {
  const missing = []

  for (const key of EDITORIAL_KEYS) {
    if (!blocks.editorial.signals[key]) {
      missing.push(key)
    }
  }

  for (const key of CREDIT_ROLE_KEYS) {
    if (!blocks.credits.signals[key]) {
      missing.push(key)
    }
  }

  for (const key of MEDIA_SIGNAL_KEYS) {
    if (!blocks.media.signals[key]) {
      missing.push(key)
    }
  }

  for (const key of MUSIC_SIGNAL_KEYS) {
    if (!blocks.music.signals[key]) {
      missing.push(key)
    }
  }

  return missing
}

function computeWeightedCompleteness(blocks) {
  return clampScore(
    (blocks.identity.score * (BLOCK_WEIGHTS.identity / 100))
    + (blocks.editorial.score * (BLOCK_WEIGHTS.editorial / 100))
    + (blocks.credits.score * (BLOCK_WEIGHTS.credits / 100))
    + (blocks.media.score * (BLOCK_WEIGHTS.media / 100))
    + (blocks.music.score * (BLOCK_WEIGHTS.music / 100))
  )
}

function deriveCompletionTier(blocks, completenessScore, isPublishable) {
  if (
    blocks.identity.gate
    && blocks.editorial.presentCount >= 3
    && blocks.credits.distinctCount >= 3
    && blocks.media.distinctCount >= 3
    && blocks.music.signalCount >= 1
    && completenessScore >= TIER_THRESHOLDS.gold
  ) {
    return 'gold'
  }

  if (isPublishable && completenessScore >= TIER_THRESHOLDS.silver) {
    return 'silver'
  }

  if (isPublishable && completenessScore >= TIER_THRESHOLDS.bronze) {
    return 'bronze'
  }

  return 'none'
}

function scorePremiumCoverageEntry(snapshot) {
  const blocks = {
    identity: evaluateIdentityBlock(snapshot),
    editorial: evaluateEditorialBlock(snapshot),
    credits: evaluateCreditsBlock(snapshot),
    media: evaluateMediaBlock(snapshot),
    music: evaluateMusicBlock(snapshot),
  }

  const completenessScore = computeWeightedCompleteness(blocks)
  const missingCoreRequirements = buildMissingCoreRequirements(blocks)
  const isPublishable = missingCoreRequirements.length === 0
  const completionTier = deriveCompletionTier(blocks, completenessScore, isPublishable)
  const isTop100Candidate = Boolean(
    isPublishable
    && completenessScore >= TIER_THRESHOLDS.top100Candidate
    && (
      blocks.credits.distinctCount >= 2
      || blocks.media.distinctCount >= 2
      || blocks.music.signalCount >= 1
    )
  )

  return {
    rulesetVersion: PREMIUM_RULESET_VERSION,
    completenessScore,
    completionTier,
    isPublishable,
    isTop100Candidate,
    missingCoreRequirements,
    missingDomainSignals: buildMissingDomainSignals(blocks),
    blockScores: {
      identity: blocks.identity.score,
      editorial: blocks.editorial.score,
      credits: blocks.credits.score,
      media: blocks.media.score,
      music: blocks.music.score,
    },
    blockSignals: {
      identity: blocks.identity.signals,
      editorial: blocks.editorial.signals,
      credits: blocks.credits.signals,
      media: blocks.media.signals,
      music: blocks.music.signals,
    },
    blockCounts: {
      identity: blocks.identity.presentCount,
      editorial: blocks.editorial.presentCount,
      credits: blocks.credits.distinctCount,
      media: blocks.media.distinctCount,
      music: blocks.music.signalCount,
    },
  }
}

module.exports = {
  clampScore,
  normalizeText,
  hasSubstantiveText,
  parseMaybeJson,
  countStructuredEntries,
  scorePremiumCoverageEntry,
}
