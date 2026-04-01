'use strict'
// DATA: Sequelize via admin game read schema, canonical tables, and premium scoring - admin/back-office only

const { countStructuredEntries, parseMaybeJson, scorePremiumCoverageEntry } = require('./scoring')
const { buildGameEvidenceSummaryMap } = require('./evidence-service')
const {
  createEmptyCreditSummary,
  createEmptyMediaSummary,
  createEmptyMusicSummary,
  loadBaseGames,
  loadCreditSummaryMap,
  loadCurationStateMap,
  loadMediaSummaryMap,
  loadMusicSummaryMap,
  loadProfileMap,
  loadQualityMap,
  loadStoredStatusMap,
} = require('./coverage-loaders')

function buildPremiumCoverageSnapshot(game, context) {
  const profile = context.profile || null
  const curation = context.curation || null
  const quality = context.quality || null
  const evidence = context.evidence || null
  const media = context.media || createEmptyMediaSummary()
  const credits = context.credits || createEmptyCreditSummary()
  const music = context.music || createEmptyMusicSummary()
  const storedStatus = context.storedStatus || null

  const composersFromGame = countStructuredEntries(game.ost_composers)
  const tracksFromGame = countStructuredEntries(game.ost_notable_tracks)
  const finalMusic = {
    composerCount: Math.max(
      Number(music.composerCount || 0),
      composersFromGame,
      credits.signals.composer ? 1 : 0
    ),
    trackCount: Math.max(Number(music.trackCount || 0), tracksFromGame),
    releaseCount: Number(music.releaseCount || 0),
    labelCount: Number(music.labelCount || 0),
  }

  const finalCredits = {
    ...credits,
    signals: {
      ...credits.signals,
      developer: Boolean(credits.signals.developer || game.developer || game.developerId),
      publisher: Boolean(credits.signals.publisher || game.publisherId),
      soundtrack_label: Boolean(credits.signals.soundtrack_label || finalMusic.labelCount > 0),
      composer: Boolean(credits.signals.composer || finalMusic.composerCount > 0),
    },
  }
  finalCredits.distinctRoleCount = Object.values(finalCredits.signals).filter(Boolean).length

  const finalMedia = {
    ...media,
    signals: {
      ...media.signals,
      cover: Boolean(media.signals.cover || game.cover_url || game.coverImage),
      manual: Boolean(media.signals.manual || game.manual_url),
      archive_item: Boolean(media.signals.archive_item || game.archive_id),
      youtube_video: Boolean(media.signals.youtube_video || game.youtube_id),
    },
  }
  finalMedia.distinctCount = Object.entries(finalMedia.signals)
    .filter(([key, value]) => key !== 'cover' && Boolean(value))
    .length

  const snapshot = {
    gameId: String(game.id),
    title: game.title || null,
    console: game.console || null,
    consoleId: game.consoleId || null,
    year: game.year || null,
    releaseDate: game.releaseDate || null,
    rarity: game.rarity || null,
    metascore: game.metascore == null ? null : Number(game.metascore),
    developer: game.developer || null,
    developerId: game.developerId || null,
    publisherId: game.publisherId || null,
    slug: game.slug || null,
    summary: game.summary || null,
    synopsis: game.synopsis || null,
    lore: game.lore || null,
    gameplayDescription: game.gameplay_description || null,
    characters: game.characters || null,
    coverUrl: game.cover_url || null,
    coverImage: game.coverImage || null,
    profile: profile ? {
      version: profile.profileVersion || null,
      mode: profile.profileMode || null,
      relevantExpected: Number(profile.relevantExpected || 0),
      contentProfile: parseMaybeJson(profile.contentProfileJson, {}),
      basis: parseMaybeJson(profile.profileBasisJson, {}),
    } : null,
    curation: curation ? {
      passKey: curation.passKey || null,
      status: curation.status || null,
      selectionScore: Number(curation.selectionScore || 0),
      targetRank: curation.targetRank == null ? null : Number(curation.targetRank),
      isTarget: Number(curation.isTarget || 0) === 1,
      completionScore: Number(curation.completionScore || 0),
      relevantExpected: Number(curation.relevantExpected || 0),
      relevantFilled: Number(curation.relevantFilled || 0),
      missingRelevantSections: parseMaybeJson(curation.missingRelevantSectionsJson, []) || [],
      criticalErrors: parseMaybeJson(curation.criticalErrorsJson, []) || [],
      validationSummary: parseMaybeJson(curation.validationSummaryJson, {}) || {},
    } : null,
    audit: quality ? {
      completenessScore: Number(quality.completenessScore || 0),
      confidenceScore: Number(quality.confidenceScore || 0),
      sourceCoverageScore: Number(quality.sourceCoverageScore || 0),
      freshnessScore: Number(quality.freshnessScore || 0),
      overallScore: Number(quality.overallScore || 0),
      tier: quality.tier || null,
      priorityScore: Number(quality.priorityScore || 0),
      missingCriticalFields: parseMaybeJson(quality.missingCriticalFields, []) || [],
      breakdown: parseMaybeJson(quality.breakdownJson, {}) || {},
    } : null,
    storedStatuses: storedStatus ? {
      editorialStatus: storedStatus.editorialStatus || null,
      mediaStatus: storedStatus.mediaStatus || null,
      priceStatus: storedStatus.priceStatus || null,
    } : null,
    evidence: evidence || {
      sourceRecordCount: 0,
      fieldProvenanceCount: 0,
      attributedFieldCount: 0,
      inferredFieldCount: 0,
      verifiedFieldCount: 0,
      avgFieldConfidence: 0,
      sourceNames: [],
      fieldNames: [],
    },
    credits: finalCredits,
    media: finalMedia,
    music: finalMusic,
    editorial: {
      signals: {
        summary: Boolean(game.summary),
        synopsis: Boolean(game.synopsis),
        lore: Boolean(game.lore),
        characters: countStructuredEntries(game.characters) > 0,
      },
    },
  }

  return {
    ...snapshot,
    ...scorePremiumCoverageEntry(snapshot),
  }
}

function compareCoverageEntries(left, right) {
  if (Number(left.isTop100Candidate) !== Number(right.isTop100Candidate)) {
    return left.isTop100Candidate ? -1 : 1
  }
  if (Number(left.completenessScore || 0) !== Number(right.completenessScore || 0)) {
    return Number(right.completenessScore || 0) - Number(left.completenessScore || 0)
  }
  if (Number(left.audit?.priorityScore || 0) !== Number(right.audit?.priorityScore || 0)) {
    return Number(right.audit?.priorityScore || 0) - Number(left.audit?.priorityScore || 0)
  }
  return String(left.title || '').localeCompare(String(right.title || ''), 'fr', { sensitivity: 'base' })
}

async function buildPremiumCoverageEntries({ gameIds = [] } = {}) {
  const baseGames = await loadBaseGames(gameIds)
  const ids = baseGames.map((game) => String(game.id))

  const [
    profileMap,
    curationMap,
    qualityMap,
    mediaMap,
    creditMap,
    musicMap,
    evidenceMap,
    storedStatusMap,
  ] = await Promise.all([
    loadProfileMap(ids),
    loadCurationStateMap(ids),
    loadQualityMap(ids),
    loadMediaSummaryMap(ids),
    loadCreditSummaryMap(ids),
    loadMusicSummaryMap(ids),
    buildGameEvidenceSummaryMap(ids),
    loadStoredStatusMap(ids),
  ])

  return baseGames
    .map((game) => buildPremiumCoverageSnapshot(game, {
      profile: profileMap.get(String(game.id)) || null,
      curation: curationMap.get(String(game.id)) || null,
      quality: qualityMap.get(String(game.id)) || null,
      media: mediaMap.get(String(game.id)) || null,
      credits: creditMap.get(String(game.id)) || null,
      music: musicMap.get(String(game.id)) || null,
      evidence: evidenceMap.get(String(game.id)) || null,
      storedStatus: storedStatusMap.get(String(game.id)) || null,
    }))
    .sort(compareCoverageEntries)
}

function summarizePremiumCoverage(entries = []) {
  const summary = {
    totalGames: entries.length,
    publishable: 0,
    top100Candidates: 0,
    tiers: {
      gold: 0,
      silver: 0,
      bronze: 0,
      none: 0,
    },
    missingCoreCounts: {},
  }

  for (const entry of entries) {
    if (entry.isPublishable) {
      summary.publishable += 1
    }
    if (entry.isTop100Candidate) {
      summary.top100Candidates += 1
    }
    summary.tiers[entry.completionTier] = (summary.tiers[entry.completionTier] || 0) + 1
    for (const key of entry.missingCoreRequirements || []) {
      summary.missingCoreCounts[key] = (summary.missingCoreCounts[key] || 0) + 1
    }
  }

  return summary
}

module.exports = {
  buildPremiumCoverageEntries,
  summarizePremiumCoverage,
}
