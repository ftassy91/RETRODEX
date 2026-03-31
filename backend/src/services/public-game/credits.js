'use strict'

const { db } = require('../../../db_supabase')
const { getRecordValue, isMissingSupabaseRelationError } = require('../public-supabase-utils')

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

module.exports = {
  fetchGamePeopleRows,
  fetchGameCompanyRows,
  fetchGameOstReleases,
  fetchGameOstRows,
  fetchGameOstTracks,
}
