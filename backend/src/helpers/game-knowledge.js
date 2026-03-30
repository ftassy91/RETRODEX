'use strict'

const { getSourcePolicy, normalizeSourceKey } = require('../config/source-policy')

function parseStoredJson(value, fallback = null) {
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

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function dedupeBy(items, keySelector) {
  const seen = new Set()
  const next = []

  for (const item of items) {
    const key = keySelector(item)
    if (!key || seen.has(key)) {
      continue
    }
    seen.add(key)
    next.push(item)
  }

  return next
}

function normalizeContributor(entry, fallbackRole = '') {
  if (!entry) {
    return null
  }

  if (typeof entry === 'string') {
    const name = String(entry).trim()
    return name
      ? { name, role: fallbackRole, note: '', confidence: 0 }
      : null
  }

  const name = String(entry.name || entry.full_name || entry.person || '').trim()
  if (!name) {
    return null
  }

  return {
    name,
    role: String(entry.role || fallbackRole || '').trim(),
    note: String(entry.note || entry.description || '').trim(),
    confidence: Number(entry.confidence || 0),
  }
}

function normalizeCompanyRole(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function getCompanyRoleLabel(value) {
  const normalized = normalizeCompanyRole(value)

  if (normalized === 'developer') return 'Developpement'
  if (normalized === 'publisher') return 'Edition'
  if (normalized === 'studio') return 'Studio'
  if (normalized === 'manufacturer') return 'Constructeur'
  if (normalized === 'composer') return 'Composition'
  if (normalized === 'localizer') return 'Localisation'
  if (normalized === 'port') return 'Portage'

  return normalized
    ? normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    : 'Production'
}

function normalizeCompanyEntry(entry) {
  if (!entry) {
    return null
  }

  const name = String(entry.name || '').trim()
  if (!name) {
    return null
  }

  const role = normalizeCompanyRole(entry.role)
  const id = String(entry.id || entry.company_id || '').trim() || null
  const confidence = Number(entry.confidence || 0)

  return {
    id,
    name,
    role,
    roleLabel: getCompanyRoleLabel(role),
    country: String(entry.country || '').trim() || null,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    source: String(entry.source || 'canonical').trim() || 'canonical',
  }
}

function getRecordValue(record, fields = []) {
  for (const field of fields) {
    if (record && record[field] != null && record[field] !== '') {
      return record[field]
    }
  }

  return null
}

function buildProductionPayload({ game, companyRows = [], devTeam = [] }) {
  const companies = dedupeBy(
    safeArray(companyRows).map(normalizeCompanyEntry).filter(Boolean),
    (entry) => `${entry.id || entry.name.toLowerCase()}::${entry.role}`
  )

  if (!companies.length) {
    const fallbackCompanies = []
    const developerName = String(getRecordValue(game, ['developer']) || '').trim()
    const publisherName = String(getRecordValue(game, ['publisher']) || '').trim()

    if (developerName) {
      fallbackCompanies.push({
        id: getRecordValue(game, ['developerId', 'developer_id', 'developerid']),
        name: developerName,
        role: 'developer',
        source: 'legacy',
      })
    }

    if (publisherName) {
      fallbackCompanies.push({
        id: getRecordValue(game, ['publisherId', 'publisher_id', 'publisherid']),
        name: publisherName,
        role: 'publisher',
        source: 'legacy',
      })
    }

    companies.push(...dedupeBy(
      fallbackCompanies.map(normalizeCompanyEntry).filter(Boolean),
      (entry) => `${entry.id || entry.name.toLowerCase()}::${entry.role}`
    ))
  }

  const developers = companies.filter((entry) => entry.role.includes('developer'))
  const publishers = companies.filter((entry) => entry.role.includes('publisher'))
  const studios = companies.filter((entry) => entry.role.includes('studio'))
  const normalizedTeam = dedupeBy(
    safeArray(devTeam).map((entry) => normalizeContributor(entry)).filter(Boolean),
    (entry) => `${entry.name.toLowerCase()}::${entry.role.toLowerCase()}`
  )
  const roleCounts = new Map()

  companies.forEach((entry) => {
    const key = entry.role || 'production'
    roleCounts.set(key, (roleCounts.get(key) || 0) + 1)
  })

  return {
    developers,
    publishers,
    studios,
    companies,
    roles: Array.from(roleCounts.entries()).map(([role, count]) => ({
      role,
      label: getCompanyRoleLabel(role),
      count,
    })),
    dev_team: normalizedTeam,
    hasData: Boolean(companies.length || normalizedTeam.length),
  }
}

function detectProviderFromUrl(url) {
  const value = String(url || '').trim().toLowerCase()
  if (!value) {
    return 'unknown'
  }

  if (value.includes('archive.org')) return 'internet_archive'
  if (value.includes('igdb.com')) return 'igdb'
  if (value.includes('wikidata.org') || value.includes('wikipedia.org')) return 'wikidata'
  if (value.includes('pricecharting.com')) return 'pricecharting'
  if (value.includes('retrodex')) return 'internal'

  return 'internal'
}

function normalizeComplianceStatus(value, providerKey) {
  const normalized = normalizeSourceKey(value)
  if (normalized) {
    return normalized
  }

  return getSourcePolicy(providerKey).status || 'unknown'
}

function complianceTone(status) {
  if (status === 'approved') return 'approved'
  if (status === 'approved_with_review') return 'review'
  if (status === 'reference_only') return 'reference'
  if (status === 'blocked') return 'blocked'
  if (status === 'needs_review') return 'review'
  return 'unknown'
}

function buildComplianceSummary(items = []) {
  const approvedCount = items.filter((item) => item.complianceTone === 'approved').length
  const reviewCount = items.filter((item) => item.complianceTone === 'review').length
  const referenceOnlyCount = items.filter((item) => item.complianceTone === 'reference').length
  const blockedCount = items.filter((item) => item.complianceTone === 'blocked').length

  let status = 'missing'
  if (blockedCount) {
    status = 'blocked'
  } else if (reviewCount) {
    status = 'needs_review'
  } else if (referenceOnlyCount && approvedCount) {
    status = 'mixed'
  } else if (referenceOnlyCount) {
    status = 'reference_only'
  } else if (approvedCount) {
    status = 'approved'
  }

  return {
    status,
    approvedCount,
    reviewCount,
    referenceOnlyCount,
    blockedCount,
    total: items.length,
  }
}

function normalizeMediaItem(entry) {
  if (!entry || !entry.url) {
    return null
  }

  const mediaType = normalizeSourceKey(entry.mediaType || entry.media_type || 'reference') || 'reference'
  const providerKey = normalizeSourceKey(entry.provider || detectProviderFromUrl(entry.url)) || 'unknown'
  const policy = getSourcePolicy(providerKey)
  const complianceStatus = normalizeComplianceStatus(
    entry.complianceStatus || entry.compliance_status,
    providerKey
  )
  const storageMode = String(entry.storageMode || entry.storage_mode || 'external_reference').trim() || 'external_reference'

  return {
    mediaType,
    url: String(entry.url).trim(),
    provider: providerKey,
    providerLabel: policy.name || String(entry.provider || providerKey),
    complianceStatus,
    complianceTone: complianceTone(complianceStatus),
    storageMode,
    isExternalReference: storageMode !== 'local_copy',
  }
}

function buildMediaPayload({ game, mediaRows = [] }) {
  const items = dedupeBy(
    safeArray(mediaRows).map(normalizeMediaItem).filter(Boolean),
    (entry) => `${entry.mediaType}::${entry.url}`
  )
  const fallbackRows = []

  if (!items.some((entry) => entry.mediaType === 'cover')) {
    const coverUrl = String(getRecordValue(game, ['cover_url', 'coverImage']) || '').trim()
    if (coverUrl) {
      fallbackRows.push({ mediaType: 'cover', url: coverUrl })
    }
  }

  if (!items.some((entry) => entry.mediaType === 'manual')) {
    const manualUrl = String(getRecordValue(game, ['manual_url', 'manualUrl']) || '').trim()
    if (manualUrl) {
      fallbackRows.push({ mediaType: 'manual', url: manualUrl })
    }
  }

  items.push(...dedupeBy(
    fallbackRows.map(normalizeMediaItem).filter(Boolean),
    (entry) => `${entry.mediaType}::${entry.url}`
  ).filter((entry) => !items.some((existing) => existing.mediaType === entry.mediaType && existing.url === entry.url)))

  const covers = items.filter((entry) => entry.mediaType === 'cover')
  const manuals = items.filter((entry) => entry.mediaType === 'manual')
  const screenshots = items.filter((entry) => entry.mediaType.includes('screen'))
  const variants = items.filter((entry) => {
    if (entry.mediaType === 'manual') {
      return false
    }

    if (entry.mediaType === 'cover') {
      return covers.indexOf(entry) > 0
    }

    return true
  })
  const complianceSummary = buildComplianceSummary(items)

  return {
    items,
    covers,
    manuals,
    screenshots,
    variants,
    complianceSummary,
    hasData: Boolean(items.length),
  }
}

function buildArchivePayload({ game, production, media, ostReleases = [] }) {
  const item = game || {}
  const normalizedMedia = media || buildMediaPayload({ game: item })
  const normalizedProduction = production || buildProductionPayload({
    game: item,
    devTeam: parseStoredJson(item.dev_team, []) || [],
  })

  return {
    ok: true,
    id: item.id,
    title: item.title,
    manual_url: normalizedMedia.manuals[0]?.url || item.manual_url || null,
    lore: item.lore || null,
    gameplay_description: item.gameplay_description || null,
    characters: parseStoredJson(item.characters),
    versions: parseStoredJson(item.versions),
    ost: {
      composers: parseStoredJson(item.ost_composers),
      notable_tracks: parseStoredJson(item.ost_notable_tracks),
      releases: safeArray(ostReleases),
    },
    duration: {
      main: item.avg_duration_main ?? null,
      complete: item.avg_duration_complete ?? null,
    },
    speedrun_wr: parseStoredJson(item.speedrun_wr),
    production: normalizedProduction,
    media: normalizedMedia,
  }
}

function buildEncyclopediaPayload(game) {
  const item = game || {}

  return {
    ok: true,
    summary: item.summary ?? null,
    synopsis: item.synopsis ?? item.summary ?? null,
    dev_anecdotes: parseStoredJson(item.dev_anecdotes) || [],
    dev_team: parseStoredJson(item.dev_team) || [],
    cheat_codes: parseStoredJson(item.cheat_codes) || [],
  }
}

module.exports = {
  parseStoredJson,
  normalizeContributor,
  normalizeCompanyEntry,
  buildProductionPayload,
  buildMediaPayload,
  buildArchivePayload,
  buildEncyclopediaPayload,
}
