'use strict'

const { db } = require('../../../db_supabase')
const { isMissingSupabaseRelationError } = require('../public-supabase-utils')

function normalizeText(value) {
  const text = String(value || '').trim()
  return text || null
}

function safeNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function emptyCompetitionDomain() {
  return {
    profile: null,
    categories: [],
    featuredRecords: [],
    primaryRecord: null,
    achievementProfile: null,
    hasData: false,
  }
}

async function safeSelect(table, builder) {
  try {
    return await builder(db.from(table))
  } catch (error) {
    if (isMissingSupabaseRelationError(error)) {
      return { data: [], error: null, missing: true }
    }
    throw error
  }
}

function normalizeCategory(row) {
  return {
    id: String(row.id),
    gameId: String(row.game_id),
    label: String(row.label),
    categoryKey: normalizeText(row.category_key),
    recordKind: normalizeText(row.record_kind),
    valueDirection: normalizeText(row.value_direction),
    externalUrl: normalizeText(row.external_url),
    sourceName: String(row.source_name),
    sourceType: String(row.source_type),
    sourceUrl: normalizeText(row.source_url),
    observedAt: normalizeText(row.observed_at),
    isPrimary: Boolean(row.is_primary),
    displayOrder: safeNumber(row.display_order) ?? 0,
  }
}

function normalizeEntry(row) {
  return {
    id: String(row.id),
    categoryId: String(row.category_id),
    gameId: String(row.game_id),
    rankPosition: safeNumber(row.rank_position),
    playerHandle: normalizeText(row.player_handle),
    scoreRaw: normalizeText(row.score_raw),
    scoreDisplay: String(row.score_display),
    achievedAt: normalizeText(row.achieved_at),
    externalUrl: normalizeText(row.external_url),
    sourceName: String(row.source_name),
    sourceType: String(row.source_type),
    sourceUrl: normalizeText(row.source_url),
    observedAt: normalizeText(row.observed_at),
  }
}

function normalizeProfile(row) {
  return {
    gameId: String(row.game_id),
    speedrunRelevant: Boolean(row.speedrun_relevant),
    scoreAttackRelevant: Boolean(row.score_attack_relevant),
    leaderboardRelevant: Boolean(row.leaderboard_relevant),
    achievementCompetitive: Boolean(row.achievement_competitive),
    primarySource: normalizeText(row.primary_source),
    freshnessCheckedAt: normalizeText(row.freshness_checked_at),
    sourceSummary: row.source_summary || null,
  }
}

function normalizeAchievement(row) {
  return {
    gameId: String(row.game_id),
    sourceName: String(row.source_name),
    sourceType: String(row.source_type),
    sourceUrl: normalizeText(row.source_url),
    pointsTotal: safeNumber(row.points_total),
    achievementCount: safeNumber(row.achievement_count),
    leaderboardCount: safeNumber(row.leaderboard_count),
    masterySummary: normalizeText(row.mastery_summary),
    highScoreSummary: normalizeText(row.high_score_summary),
    observedAt: normalizeText(row.observed_at),
  }
}

function buildFeaturedRecords(categories, entries) {
  const entriesByCategory = new Map()
  for (const entry of entries) {
    const rows = entriesByCategory.get(entry.categoryId) || []
    rows.push(entry)
    entriesByCategory.set(entry.categoryId, rows)
  }

  const sortedCategories = [...categories].sort((left, right) => {
    if (Boolean(right.isPrimary) !== Boolean(left.isPrimary)) {
      return Number(right.isPrimary) - Number(left.isPrimary)
    }
    return Number(left.displayOrder || 0) - Number(right.displayOrder || 0)
  })

  return sortedCategories
    .map((category) => {
      const topEntry = (entriesByCategory.get(category.id) || [])
        .slice()
        .sort((left, right) => Number(left.rankPosition || 9999) - Number(right.rankPosition || 9999))[0]

      if (!topEntry) return null
      return {
        label: category.label,
        value: topEntry.scoreDisplay,
        runner: topEntry.playerHandle,
        source: category.sourceName,
        url: topEntry.externalUrl || category.externalUrl || category.sourceUrl,
        metricType: category.recordKind || null,
        rankPosition: topEntry.rankPosition,
      }
    })
    .filter(Boolean)
}

async function fetchGameCompetitionDomain(gameId) {
  if (!gameId) {
    return emptyCompetitionDomain()
  }

  const [profileResponse, categoriesResponse, entriesResponse, achievementResponse] = await Promise.all([
    safeSelect('game_competitive_profiles', (query) => query.select('*').eq('game_id', gameId).limit(1)),
    safeSelect('game_record_categories', (query) => query.select('*').eq('game_id', gameId).order('display_order', { ascending: true })),
    safeSelect('game_record_entries', (query) => query.select('*').eq('game_id', gameId).order('rank_position', { ascending: true })),
    safeSelect('game_achievement_profiles', (query) => query.select('*').eq('game_id', gameId).limit(1)),
  ])

  if (profileResponse.error && !isMissingSupabaseRelationError(profileResponse.error)) {
    throw new Error(profileResponse.error.message)
  }
  if (categoriesResponse.error && !isMissingSupabaseRelationError(categoriesResponse.error)) {
    throw new Error(categoriesResponse.error.message)
  }
  if (entriesResponse.error && !isMissingSupabaseRelationError(entriesResponse.error)) {
    throw new Error(entriesResponse.error.message)
  }
  if (achievementResponse.error && !isMissingSupabaseRelationError(achievementResponse.error)) {
    throw new Error(achievementResponse.error.message)
  }

  const profileRow = Array.isArray(profileResponse.data) ? profileResponse.data[0] : profileResponse.data
  const achievementRow = Array.isArray(achievementResponse.data) ? achievementResponse.data[0] : achievementResponse.data
  const profile = profileRow ? normalizeProfile(profileRow) : null
  const categories = Array.isArray(categoriesResponse.data) ? categoriesResponse.data.map(normalizeCategory) : []
  const entries = Array.isArray(entriesResponse.data) ? entriesResponse.data.map(normalizeEntry) : []
  const achievementProfile = achievementRow ? normalizeAchievement(achievementRow) : null
  const featuredRecords = buildFeaturedRecords(categories, entries)
  const primaryRecord = featuredRecords[0] || null

  return {
    profile,
    categories,
    featuredRecords,
    primaryRecord,
    achievementProfile,
    hasData: Boolean(profile || categories.length || entries.length || achievementProfile),
  }
}

module.exports = {
  emptyCompetitionDomain,
  fetchGameCompetitionDomain,
}
