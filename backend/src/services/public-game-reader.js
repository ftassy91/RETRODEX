'use strict'

const {
  db,
  queryGames,
  getGameById,
} = require('../../db_supabase')
const {
  normalizeGameRecord,
  parseStoredJson,
  compareGamesForSort,
} = require('../lib/normalize')
const {
  buildProductionPayload,
  buildMediaPayload,
  buildArchivePayload: buildKnowledgeArchivePayload,
  buildEncyclopediaPayload: buildKnowledgeEncyclopediaPayload,
} = require('../helpers/game-knowledge')
const {
  getRecordValue,
  isMissingSupabaseRelationError,
  fetchRowsInBatches,
} = require('./public-supabase-utils')

async function fetchGameMediaMap(gameIds = []) {
  const uniqueIds = Array.from(new Set((gameIds || []).filter(Boolean).map((value) => String(value))))
  if (!uniqueIds.length) {
    return new Map()
  }

  const { data, error } = await db
    .from('media_references')
    .select('entity_id,media_type,url')
    .eq('entity_type', 'game')
    .in('entity_id', uniqueIds)

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return new Map()
    }
    throw new Error(error.message)
  }

  const mediaMap = new Map()
  for (const row of data || []) {
    const gameId = String(row.entity_id || '')
    if (!gameId) {
      continue
    }

    if (!mediaMap.has(gameId)) {
      mediaMap.set(gameId, {})
    }

    mediaMap.get(gameId)[String(row.media_type || '').toLowerCase()] = row.url
  }

  return mediaMap
}

async function fetchGameMediaRows(gameId) {
  const query = db
    .from('media_references')
    .select('media_type,url,provider,compliance_status,storage_mode,title,preview_url,asset_subtype,license_status,ui_allowed,healthcheck_status,notes,source_context')
    .eq('entity_type', 'game')
    .eq('entity_id', String(gameId || ''))

  const { data, error } = await query

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return []
    }

    const fallback = await db
      .from('media_references')
      .select('media_type,url,provider,compliance_status,storage_mode')
      .eq('entity_type', 'game')
      .eq('entity_id', String(gameId || ''))

    if (fallback.error) {
      if (isMissingSupabaseRelationError(fallback.error)) {
        return []
      }
      throw new Error(fallback.error.message)
    }

    return Array.isArray(fallback.data) ? fallback.data : []
  }

  return Array.isArray(data) ? data : []
}

async function fetchGameEditorialRow(gameId) {
  const query = db
    .from('game_editorial')
    .select('summary,synopsis,lore,gameplay_description,characters,dev_anecdotes,cheat_codes,versions,avg_duration_main,avg_duration_complete,speedrun_wr')
    .eq('game_id', String(gameId || ''))
    .limit(1)
    .single()

  const { data, error } = await query
  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return null
    }

    const fallback = await db
      .from('game_editorial')
      .select('summary,synopsis,lore,gameplay_description,characters,cheat_codes')
      .eq('game_id', String(gameId || ''))
      .limit(1)
      .single()

    if (fallback.error) {
      if (isMissingSupabaseRelationError(fallback.error)) {
        return null
      }
      throw new Error(fallback.error.message)
    }

    return fallback.data || null
  }

  return data || null
}

async function fetchGameContentProfileRow(gameId) {
  const { data, error } = await db
    .from('game_content_profiles')
    .select('content_profile_json,profile_version,profile_mode,profile_basis_json,relevant_expected,updated_at')
    .eq('game_id', String(gameId || ''))
    .limit(1)
    .single()

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return null
    }
    throw new Error(error.message)
  }

  return data || null
}

async function fetchGamePeopleRows(gameId) {
  const { data, error } = await db
    .from('game_people')
    .select('person_id,role,billing_order,confidence,is_inferred,people(id,name,normalized_name)')
    .eq('game_id', String(gameId || ''))
    .order('billing_order', { ascending: true })

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return []
    }
    throw new Error(error.message)
  }

  return (data || []).map((entry) => ({
    personId: entry.person_id,
    role: entry.role,
    billingOrder: entry.billing_order,
    confidence: entry.confidence,
    isInferred: entry.is_inferred,
    name: entry.people?.name || null,
    normalizedName: entry.people?.normalized_name || null,
  })).filter((entry) => entry.name)
}

async function fetchGameCompanyRows(game) {
  const gameId = String(game?.id || '')
  if (!gameId) {
    return []
  }

  const { data, error } = await db
    .from('game_companies')
    .select('company_id,role,confidence')
    .eq('game_id', gameId)

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return []
    }
    throw new Error(error.message)
  }

  let bindings = Array.isArray(data) ? data : []

  if (!bindings.length) {
    bindings = [
      { company_id: getRecordValue(game, ['developerId', 'developer_id', 'developerid']), role: 'developer', confidence: 0.7 },
      { company_id: getRecordValue(game, ['publisherId', 'publisher_id', 'publisherid']), role: 'publisher', confidence: 0.7 },
    ].filter((entry) => entry.company_id)
  }

  if (!bindings.length) {
    return []
  }

  const ids = Array.from(new Set(bindings.map((entry) => String(entry.company_id)).filter(Boolean)))
  const companyResult = await db
    .from('companies')
    .select('id,name,country')
    .in('id', ids)

  if (companyResult.error) {
    if (isMissingSupabaseRelationError(companyResult.error)) {
      return []
    }
    throw new Error(companyResult.error.message)
  }

  const companies = new Map((companyResult.data || []).map((entry) => [String(entry.id), entry]))

  return bindings
    .map((binding) => {
      const company = companies.get(String(binding.company_id))
      if (!company) {
        return null
      }

      return {
        id: company.id,
        name: company.name,
        country: company.country || null,
        role: binding.role,
        confidence: binding.confidence,
        source: Array.isArray(data) && data.length ? 'canonical' : 'association_fallback',
      }
    })
    .filter(Boolean)
}

async function fetchGameOstReleases(gameId) {
  const { data, error } = await db
    .from('ost_releases')
    .select('id,ost_id,region_code,release_date,catalog_number,label,confidence,ost!inner(id,game_id,title)')
    .eq('ost.game_id', String(gameId || ''))
    .order('release_date', { ascending: true })
    .order('label', { ascending: true })

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      const legacy = await db
        .from('osts')
        .select('id,name,format,track_count,release_year,label,region_code,slug,source_confidence')
        .eq('game_id', String(gameId || ''))
        .order('release_year', { ascending: true })
        .order('name', { ascending: true })

      if (legacy.error) {
        if (isMissingSupabaseRelationError(legacy.error)) {
          return []
        }
        throw new Error(legacy.error.message)
      }

      return (legacy.data || []).map((entry) => ({
        id: entry.id,
        name: entry.name,
        format: entry.format || null,
        trackCount: entry.track_count ?? null,
        releaseYear: entry.release_year ?? null,
        label: entry.label || null,
        regionCode: entry.region_code || null,
        slug: entry.slug || null,
        sourceConfidence: entry.source_confidence ?? null,
      }))
    }
    throw new Error(error.message)
  }

  return (data || []).map((entry) => ({
    id: entry.id,
    name: entry.ost?.title || null,
    format: null,
    trackCount: null,
    releaseYear: entry.release_date ? Number(String(entry.release_date).slice(0, 4)) : null,
    label: entry.label || null,
    regionCode: entry.region_code || null,
    slug: null,
    sourceConfidence: entry.confidence ?? null,
  }))
}

async function fetchGameOstRows(gameId) {
  const { data, error } = await db
    .from('ost')
    .select('id,title,confidence,needs_release_enrichment')
    .eq('game_id', String(gameId || ''))

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return []
    }
    throw new Error(error.message)
  }

  return Array.isArray(data) ? data : []
}

async function fetchGameOstTracks(gameId) {
  const { data, error } = await db
    .from('ost_tracks')
    .select('id,ost_id,track_title,track_number,composer_person_id,confidence,ost!inner(game_id)')
    .eq('ost.game_id', String(gameId || ''))
    .order('track_number', { ascending: true })
    .order('track_title', { ascending: true })

  if (error) {
    if (isMissingSupabaseRelationError(error)) {
      return []
    }
    throw new Error(error.message)
  }

  return (data || []).map((entry) => ({
    ostId: entry.ost_id,
    title: entry.track_title,
    trackNumber: entry.track_number,
    composerPersonId: entry.composer_person_id || null,
    confidence: entry.confidence ?? null,
  }))
}

async function fetchGameKnowledgeDomains(game) {
  const [companyRows, mediaRows, editorial, peopleRows, ostRows, ostTracks, ostReleases] = await Promise.all([
    fetchGameCompanyRows(game),
    fetchGameMediaRows(game?.id),
    fetchGameEditorialRow(game?.id),
    fetchGamePeopleRows(game?.id),
    fetchGameOstRows(game?.id),
    fetchGameOstTracks(game?.id),
    fetchGameOstReleases(game?.id),
  ])

  const canonicalDevTeam = peopleRows
    .filter((entry) => !String(entry.role || '').toLowerCase().includes('composer'))
    .map((entry) => ({
      personId: entry.personId,
      name: entry.name,
      normalizedName: entry.normalizedName,
      role: entry.role,
      confidence: Number(entry.confidence || 0),
      isInferred: Boolean(entry.isInferred),
    }))

  const canonicalComposers = peopleRows
    .filter((entry) => String(entry.role || '').toLowerCase().includes('composer'))
    .map((entry) => ({
      personId: entry.personId,
      name: entry.name,
      normalizedName: entry.normalizedName,
      role: entry.role,
      confidence: Number(entry.confidence || 0),
      isInferred: Boolean(entry.isInferred),
    }))

  return {
    editorial,
    production: buildProductionPayload({
      game,
      companyRows,
      devTeam: canonicalDevTeam.length ? canonicalDevTeam : (parseStoredJson(game?.dev_team) || []),
    }),
    media: buildMediaPayload({
      game,
      mediaRows,
    }),
    music: {
      composers: canonicalComposers.length ? canonicalComposers : (parseStoredJson(game?.ost_composers) || []),
      tracks: ostTracks.length ? ostTracks : (parseStoredJson(game?.ost_notable_tracks) || []),
      releases: ostReleases,
      ostRows,
    },
  }
}

async function hydrateGameCovers(items = []) {
  const mediaMap = await fetchGameMediaMap(items.map((item) => item?.id))
  return items.map((item) => {
    const normalized = normalizeGameRecord(item)
    const media = mediaMap.get(String(normalized?.id || '')) || {}
    const coverUrl = media.cover || normalized.cover_url || normalized.coverImage || null
    return {
      ...normalized,
      cover_url: coverUrl,
      coverImage: coverUrl,
    }
  })
}

function buildArchivePayload(game, domains = {}) {
  return buildKnowledgeArchivePayload({
    game: normalizeGameRecord(game) || {},
    editorial: domains.editorial,
    production: domains.production,
    media: domains.media,
    music: domains.music,
    ostReleases: domains.music?.releases || [],
  })
}

function buildEncyclopediaPayload(game, domains = {}) {
  return buildKnowledgeEncyclopediaPayload({
    game: normalizeGameRecord(game) || {},
    editorial: domains.editorial,
    production: domains.production,
    music: domains.music,
  })
}

async function fetchAllSupabaseGames() {
  return fetchRowsInBatches(
    'games',
    'id,title,console,year,genre,developer,metascore,rarity,summary,synopsis,source_confidence,slug,cover_url,loose_price,cib_price,mint_price',
    (query) => query.eq('type', 'game'),
    { column: 'title', options: { ascending: true } }
  )
}

async function fetchGamesMap(gameIds) {
  const uniqueIds = [...new Set((gameIds || []).filter(Boolean))]

  if (!uniqueIds.length) {
    return new Map()
  }

  const { data, error } = await db
    .from('games')
    .select('id,title,console,year,rarity,loose_price,cib_price,mint_price')
    .in('id', uniqueIds)

  if (error) {
    throw new Error(error.message)
  }

  return new Map((data || []).map((game) => [game.id, normalizeGameRecord(game)]))
}

async function fetchSeedPriceHistory(gameId) {
  const { data, error } = await db
    .from('price_history')
    .select('price,condition,sale_date')
    .eq('game_id', gameId)
    .order('sale_date', { ascending: true })
    .limit(2000)

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

function toItemPayload(game) {
  const item = normalizeGameRecord(game)

  return {
    id: item.id,
    title: item.title,
    platform: item.console,
    console: item.console,
    year: item.year,
    genre: item.genre,
    rarity: item.rarity,
    type: item.type || 'game',
    slug: item.slug || null,
    loosePrice: item.loosePrice,
    cibPrice: item.cibPrice,
    mintPrice: item.mintPrice,
    coverImage: item.coverImage || item.cover_url || null,
    cover_url: item.cover_url || item.coverImage || null,
    synopsis: item.synopsis || null,
    summary: item.summary || null,
    developer: item.developer || null,
    metascore: item.metascore ?? null,
    trend: item.trend || null,
    curation: {
      status: item.curation?.status || null,
      isPublished: Boolean(item.curation?.isPublished),
      passKey: item.curation?.passKey || null,
    },
    signals: {
      hasMaps: Boolean(item.signals?.hasMaps),
      hasManuals: Boolean(item.signals?.hasManuals),
      hasSprites: Boolean(item.signals?.hasSprites),
      hasEndings: Boolean(item.signals?.hasEndings),
    },
  }
}

async function fetchCanonicalGamesList(query = {}) {
  const limit = Math.min(Math.max(Number.parseInt(String(query.limit || '20'), 10) || 20, 1), 5000)
  const offset = Math.max(0, Number.parseInt(String(query.offset || '0'), 10) || 0)
  const includeTrend = String(query.include_trend || '') === '1'
  const { items: rawItems = [] } = await queryGames({
    sort: query.sort,
    console: query.console,
    rarity: query.rarity,
    limit: 5000,
    offset: 0,
    search: query.q,
  })

  const filteredItems = rawItems
    .map(normalizeGameRecord)
    .sort((left, right) => compareGamesForSort(left, right, query.sort))
  const total = filteredItems.length
  const items = await hydrateGameCovers(filteredItems.slice(offset, offset + limit).map((item) => (
    includeTrend
      ? { ...item, trend: null }
      : item
  )))

  return {
    items,
    returned: items.length,
    total,
  }
}

async function fetchCanonicalGameById(id) {
  const [game] = await hydrateGameCovers([await getGameById(id)])
  return game || null
}

module.exports = {
  fetchGameContentProfileRow,
  fetchGameKnowledgeDomains,
  hydrateGameCovers,
  buildArchivePayload,
  buildEncyclopediaPayload,
  fetchAllSupabaseGames,
  fetchGamesMap,
  fetchSeedPriceHistory,
  toItemPayload,
  fetchCanonicalGamesList,
  fetchCanonicalGameById,
}
