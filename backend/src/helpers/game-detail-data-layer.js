'use strict'

const TAB_ORDER = [
  { id: 'overview', name: 'Overview', lazy: false, profileKey: 'overview' },
  { id: 'lore', name: 'Lore', lazy: false, profileKey: 'lore' },
  { id: 'characters', name: 'Characters', lazy: false, profileKey: 'characters' },
  { id: 'dev-team', name: 'Dev Team', lazy: false, profileKey: 'dev_team' },
  { id: 'ost', name: 'OST', lazy: true, profileKey: 'ost' },
  { id: 'manuals', name: 'Manuals', lazy: true, profileKey: 'manuals' },
  { id: 'maps', name: 'Maps', lazy: true, profileKey: 'maps' },
  { id: 'sprites-assets', name: 'Sprites / Assets', lazy: true, profileKey: 'sprites' },
  { id: 'codes-tips', name: 'Codes / Tips', lazy: false, profileKey: 'codes_tips' },
  { id: 'records', name: 'Records', lazy: false, profileKey: 'records' },
  { id: 'ending', name: 'Ending', lazy: true, profileKey: 'endings' },
  { id: 'development', name: 'Development', lazy: false, profileKey: 'development' },
  { id: 'anecdotes', name: 'Anecdotes', lazy: false, profileKey: 'development_anecdotes' },
]

const MIN_SYNOPSIS_LENGTH = 70
const MIN_LORE_LENGTH = 90

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

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function asArray(value) {
  const parsed = parseMaybeJson(value, value)
  return Array.isArray(parsed) ? parsed : (parsed ? [parsed] : [])
}

function asTrimmedString(value) {
  return String(value || '').trim()
}

function hasSubstantiveText(value, minimumLength = MIN_SYNOPSIS_LENGTH) {
  return asTrimmedString(value).replace(/\s+/g, ' ').length >= minimumLength
}

function dedupeBy(items = [], getKey) {
  const next = []
  const seen = new Set()

  for (const item of items) {
    const key = getKey(item)
    if (!key || seen.has(key)) {
      continue
    }
    seen.add(key)
    next.push(item)
  }

  return next
}

function isValidExternalUrl(value) {
  const text = asTrimmedString(value)
  return /^https?:\/\//i.test(text)
}

function isImageLikeUrl(value) {
  return /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(asTrimmedString(value))
}

function isPdfLikeUrl(value) {
  return /\.pdf(\?|#|$)/i.test(asTrimmedString(value))
}

function buildArchiveOrgEmbedUrl(value) {
  const url = asTrimmedString(value)
  const match = url.match(/archive\.org\/details\/([^/?#]+)/i)
  return match ? `https://archive.org/embed/${match[1]}` : null
}

function normalizeMediaEntry(entry, fallbackType = 'reference') {
  if (!entry) {
    return null
  }

  const item = typeof entry === 'string' ? { url: entry } : entry
  const externalUrl = asTrimmedString(item.external_url || item.externalUrl || item.url)
  if (!isValidExternalUrl(externalUrl)) {
    return null
  }

  const healthcheckStatus = asTrimmedString(item.healthcheck_status || item.healthcheckStatus || 'ok').toLowerCase()
  const legalFlag = asTrimmedString(item.legal_flag || item.legalFlag || item.license_status || item.licenseStatus || item.complianceStatus || 'reference_only').toLowerCase()
  const uiAllowed = item.ui_allowed === false || item.uiAllowed === false ? false : true

  if (['broken', 'timeout'].includes(healthcheckStatus)) {
    return null
  }
  if (legalFlag === 'blocked' || !uiAllowed) {
    return null
  }

  const previewUrl = asTrimmedString(item.preview_url || item.previewUrl || '')
  const previewLike = isValidExternalUrl(previewUrl) ? previewUrl : (isImageLikeUrl(externalUrl) ? externalUrl : null)
  const embedUrl = buildArchiveOrgEmbedUrl(externalUrl) || (isPdfLikeUrl(externalUrl) ? externalUrl : null)

  return {
    title: asTrimmedString(item.title || item.name || item.asset_subtype || item.assetSubtype || fallbackType) || null,
    asset_type: asTrimmedString(item.asset_type || item.assetType || item.mediaType || fallbackType).toLowerCase() || fallbackType,
    asset_subtype: asTrimmedString(item.asset_subtype || item.assetSubtype) || null,
    external_url: externalUrl,
    preview_url: previewLike,
    embed_url: embedUrl,
    provider: asTrimmedString(item.provider || item.providerLabel || '') || null,
    legal_flag: legalFlag || 'reference_only',
    ui_allowed: uiAllowed,
    healthcheck_status: healthcheckStatus || 'ok',
    notes: item.notes || null,
    source_context: item.source_context || item.sourceContext || null,
  }
}

function normalizePeopleEntry(entry, fallbackRole = '') {
  if (!entry) {
    return null
  }

  if (typeof entry === 'string') {
    const name = asTrimmedString(entry)
    return name ? { name, role: fallbackRole, note: '', confidence: 0 } : null
  }

  const name = asTrimmedString(entry.name || entry.full_name || entry.person)
  if (!name) {
    return null
  }

  return {
    name,
    role: asTrimmedString(entry.role || fallbackRole),
    note: asTrimmedString(entry.note || entry.description),
    confidence: Number(entry.confidence || 0) || 0,
    country: asTrimmedString(entry.country) || null,
    type: asTrimmedString(entry.type) || null,
    roleLabel: asTrimmedString(entry.roleLabel) || null,
  }
}

function normalizeCharacterEntry(entry) {
  if (!entry) {
    return null
  }

  if (typeof entry === 'string') {
    const name = asTrimmedString(entry)
    return name ? { name, role: '', description: '' } : null
  }

  const name = asTrimmedString(entry.name || entry.label || entry.character)
  if (!name) {
    return null
  }

  return {
    name,
    role: asTrimmedString(entry.role || entry.class || ''),
    description: asTrimmedString(entry.description || entry.bio || entry.note || ''),
  }
}

function normalizeCodeEntry(entry) {
  if (!entry) {
    return null
  }

  if (typeof entry === 'string') {
    const text = asTrimmedString(entry)
    return text ? { label: 'Code', code: '', effect: text } : null
  }

  const label = asTrimmedString(entry.label || entry.name || 'Code')
  const code = asTrimmedString(entry.code || entry.value || '')
  const effect = asTrimmedString(entry.effect || entry.description || entry.note || '')

  if (!label && !code && !effect) {
    return null
  }

  return {
    label: label || 'Code',
    code,
    effect,
  }
}

function normalizeAnecdoteEntry(entry, index) {
  if (!entry) {
    return null
  }

  if (typeof entry === 'string') {
    const text = asTrimmedString(entry)
    return text ? { title: `Note ${index + 1}`, text } : null
  }

  const text = asTrimmedString(entry.text || entry.note || entry.description)
  if (!text) {
    return null
  }

  return {
    title: asTrimmedString(entry.title || entry.label || `Note ${index + 1}`),
    text,
  }
}

function normalizeVersionEntry(entry) {
  if (!entry) {
    return null
  }

  if (typeof entry === 'string') {
    const value = asTrimmedString(entry)
    return value ? { label: value } : null
  }

  const label = asTrimmedString(entry.name || entry.label || entry.title)
  return label ? { label, note: asTrimmedString(entry.note || entry.description || '') } : null
}

function normalizeRecordEntry(entry) {
  if (!entry) {
    return null
  }

  if (typeof entry === 'string') {
    const value = asTrimmedString(entry)
    return value ? { label: 'Record', value } : null
  }

  const time = asTrimmedString(entry.time || entry.value)
  const category = asTrimmedString(entry.category || 'Record')
  if (!time && !category) {
    return null
  }

  return {
    label: category || 'Record',
    value: time,
    runner: asTrimmedString(entry.runner || entry.player || ''),
    source: asTrimmedString(entry.source || ''),
    url: asTrimmedString(entry.url || entry.externalUrl || ''),
    metricType: asTrimmedString(entry.metricType || ''),
  }
}

function formatDuration(value) {
  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric > 0) {
    return `${Number.isInteger(numeric) ? numeric : numeric.toFixed(1).replace(/\.0$/, '')}h`
  }

  const text = asTrimmedString(value)
  if (!text) {
    return null
  }

  return /h$/i.test(text) ? text : `${text}h`
}

function normalizeStoredProfile(storedProfile = null) {
  const base = parseMaybeJson(
    storedProfile?.content_profile_json
      || storedProfile?.contentProfile
      || storedProfile
      || null,
    {}
  ) || {}

  return {
    overview: Boolean(base.overview),
    synopsis: Boolean(base.synopsis || base.overview),
    lore: Boolean(base.lore),
    characters: Boolean(base.characters),
    dev_team: Boolean(base.dev_team || base.credits),
    ost: Boolean(base.ost),
    manuals: Boolean(base.manuals),
    sprites: Boolean(base.sprites),
    endings: Boolean(base.endings),
    codes: Boolean(base.codes),
    tips: Boolean(base.tips),
    maps: Boolean(base.maps),
    records: Boolean(base.records),
    covers: Boolean(base.covers),
    game_length: Boolean(base.game_length),
    development: Boolean(base.development || base.credits),
    development_anecdotes: Boolean(base.development_anecdotes || base.anecdotes),
  }
}

function buildOverviewContent(game, content) {
  const primaryCover = content.covers[0] || null

  return {
    summary: asTrimmedString(content.overview.summary) || null,
    synopsis: asTrimmedString(content.overview.synopsis) || null,
    platform: asTrimmedString(game.consoleData?.name || game.console) || null,
    year: game.year || null,
    genre: asTrimmedString(game.genre) || null,
    rarity: asTrimmedString(game.rarity) || null,
    developer: asTrimmedString(game.developerCompany?.name || game.developer) || null,
    publisher: asTrimmedString(game.publisherCompany?.name || game.publisher) || null,
    metascore: Number(game.metascore || 0) || null,
    cover: primaryCover,
    game_length: content.game_length,
  }
}

function buildRuntimeProfile(game, content, storedProfile = null) {
  const base = normalizeStoredProfile(storedProfile)
  const hasOverviewText = Boolean(
    content.synopsis.length
    || content.overview.summary
    || content.overview.synopsis
  )

  return {
    overview: true,
    synopsis: Boolean(base.synopsis && hasOverviewText) || hasOverviewText,
    lore: Boolean(content.lore.length),
    characters: Boolean(content.characters.length),
    dev_team: Boolean(content.dev_team.length),
    ost: Boolean(content.ost.composers.length || content.ost.tracks.length || content.ost.releases.length),
    manuals: Boolean(content.manuals.length),
    sprites: Boolean(content.sprites.length),
    endings: Boolean(content.endings.length),
    codes: Boolean(content.codes.length),
    tips: Boolean(content.tips.length),
    maps: Boolean(content.maps.length),
    records: Boolean(content.records.length),
    covers: Boolean(content.covers.length),
    game_length: Boolean(content.game_length.main || content.game_length.complete),
    development: Boolean(
      content.development.length
      || content.dev_team.length
      || content.game_length.main
      || content.game_length.complete
    ),
    development_anecdotes: Boolean(content.development_anecdotes.length),
  }
}

function buildContent(game, archive = {}, encyclopedia = {}) {
  const archiveMedia = archive.media || {}
  const manuals = dedupeBy(
    safeArray(archiveMedia.manuals).map((entry) => normalizeMediaEntry(entry, 'manual')).filter(Boolean),
    (entry) => entry.external_url
  )
  const maps = dedupeBy(
    safeArray(archiveMedia.maps).map((entry) => normalizeMediaEntry(entry, 'map')).filter(Boolean),
    (entry) => entry.external_url
  )
  const sprites = dedupeBy(
    safeArray(archiveMedia.sprites).map((entry) => normalizeMediaEntry(entry, 'sprite_sheet')).filter(Boolean),
    (entry) => entry.external_url
  )
  const endings = dedupeBy(
    safeArray(archiveMedia.endings).map((entry) => normalizeMediaEntry(entry, 'ending')).filter(Boolean),
    (entry) => entry.external_url
  )
  const covers = dedupeBy(
    safeArray(archiveMedia.covers).map((entry) => normalizeMediaEntry(entry, 'cover')).filter(Boolean),
    (entry) => entry.external_url
  )

  const extraAssets = dedupeBy(
    safeArray(archiveMedia.assets).map((entry) => normalizeMediaEntry(entry, 'asset')).filter((entry) => (
      entry && entry.asset_type !== 'ending'
    )),
    (entry) => entry.external_url
  )

  const summaryText = asTrimmedString(encyclopedia.summary || game.summary)
  const synopsisText = asTrimmedString(encyclopedia.synopsis || game.synopsis)
  const loreText = asTrimmedString(encyclopedia.lore || archive.lore || game.lore)
  const gameplayText = asTrimmedString(encyclopedia.gameplay_description || archive.gameplay_description || game.gameplay_description)

  const devTeamPeople = dedupeBy(
    asArray(encyclopedia.dev_team || game.dev_team).map((entry) => normalizePeopleEntry(entry)).filter(Boolean),
    (entry) => `${entry.name.toLowerCase()}::${entry.role.toLowerCase()}`
  )

  const companyRows = []
  const production = archive.production || {}
  for (const entry of safeArray(production.companies)) {
    const normalized = normalizePeopleEntry({
      ...entry,
      type: 'company',
      role: entry.roleLabel || entry.role || 'Production',
      note: entry.country || '',
    })
    if (normalized) {
      companyRows.push(normalized)
    }
  }

  const content = {
    overview: {
      summary: summaryText,
      synopsis: synopsisText,
    },
    synopsis: hasSubstantiveText(synopsisText, MIN_SYNOPSIS_LENGTH)
      ? [{ type: 'text', title: 'Synopsis', text: synopsisText }]
      : [],
    lore: dedupeBy([
      hasSubstantiveText(loreText, MIN_LORE_LENGTH) ? { type: 'text', title: 'Lore', text: loreText } : null,
      hasSubstantiveText(gameplayText, 60) ? { type: 'text', title: 'Gameplay', text: gameplayText } : null,
    ].filter(Boolean), (entry) => `${entry.title}::${entry.text}`),
    characters: dedupeBy(
      asArray(archive.characters || encyclopedia.characters || game.characters)
        .map((entry) => normalizeCharacterEntry(entry))
        .filter(Boolean),
      (entry) => `${entry.name.toLowerCase()}::${entry.role.toLowerCase()}`
    ),
    dev_team: dedupeBy(
      [...devTeamPeople, ...companyRows],
      (entry) => `${entry.type || 'person'}::${entry.name.toLowerCase()}::${entry.role.toLowerCase()}`
    ),
    ost: {
      composers: dedupeBy(
        asArray(archive.ost?.composers || encyclopedia.ost_composers || game.ost_composers)
          .map((entry) => normalizePeopleEntry(entry, 'Composer'))
          .filter(Boolean),
        (entry) => `${entry.name.toLowerCase()}::${entry.role.toLowerCase()}`
      ),
      tracks: dedupeBy(
        asArray(archive.ost?.notable_tracks || encyclopedia.ost_notable_tracks || game.ost_notable_tracks)
          .map((entry) => {
            if (typeof entry === 'string') {
              const value = asTrimmedString(entry)
              return value ? { title: value, trackNumber: null, composerPersonId: null } : null
            }
            const title = asTrimmedString(entry.title || entry.name)
            return title ? {
              title,
              trackNumber: entry.trackNumber ?? entry.track_number ?? null,
              composerPersonId: entry.composerPersonId ?? entry.composer_person_id ?? null,
            } : null
          })
          .filter(Boolean),
        (entry) => `${entry.trackNumber || ''}::${entry.title.toLowerCase()}`
      ),
      releases: dedupeBy(
        safeArray(archive.ost?.releases).map((entry) => {
          const item = typeof entry === 'string' ? { name: entry } : entry
          const name = asTrimmedString(item.name || item.title || 'OST')
          return name ? {
            name,
            format: asTrimmedString(item.format),
            label: asTrimmedString(item.label),
            regionCode: asTrimmedString(item.regionCode || item.region_code),
            releaseYear: item.releaseYear ?? item.release_year ?? null,
            trackCount: item.trackCount ?? item.track_count ?? null,
          } : null
        }).filter(Boolean),
        (entry) => `${entry.name.toLowerCase()}::${entry.releaseYear || ''}::${entry.label || ''}`
      ),
    },
    manuals,
    maps,
    sprites,
    endings,
    codes: dedupeBy(
      asArray(encyclopedia.cheat_codes || game.cheat_codes).map((entry) => normalizeCodeEntry(entry)).filter(Boolean),
      (entry) => `${entry.label.toLowerCase()}::${entry.code.toLowerCase()}::${entry.effect.toLowerCase()}`
    ),
    tips: [],
    records: dedupeBy(
      [
        normalizeRecordEntry(archive.speedrun_wr || encyclopedia.speedrun_wr || game.speedrun_wr),
        ...safeArray(archive.competition?.featuredRecords).map((entry) => normalizeRecordEntry(entry)),
      ].filter(Boolean),
      (entry) => `${entry.label.toLowerCase()}::${entry.value.toLowerCase()}::${entry.runner.toLowerCase()}`
    ),
    covers,
    game_length: {
      main: formatDuration(archive.duration?.main || encyclopedia.avg_duration_main || game.avg_duration_main),
      complete: formatDuration(archive.duration?.complete || encyclopedia.avg_duration_complete || game.avg_duration_complete),
    },
    development: dedupeBy([
      ...asArray(archive.versions || encyclopedia.versions || game.versions).map((entry) => normalizeVersionEntry(entry)),
      asTrimmedString(game.releaseDate) ? { label: 'Release', note: asTrimmedString(game.releaseDate) } : null,
      ...companyRows.map((entry) => ({
        label: entry.role || 'Production',
        note: [entry.name, entry.country].filter(Boolean).join(' | '),
      })),
    ].filter(Boolean), (entry) => `${entry.label.toLowerCase()}::${entry.note.toLowerCase()}`),
    development_anecdotes: dedupeBy(
      asArray(encyclopedia.dev_anecdotes || game.dev_anecdotes)
        .map((entry, index) => normalizeAnecdoteEntry(entry, index))
        .filter(Boolean),
      (entry) => `${entry.title.toLowerCase()}::${entry.text.toLowerCase()}`
    ),
    _extra_assets: extraAssets,
  }

  if (!content.covers.length && isValidExternalUrl(game.cover_url || game.coverImage)) {
    content.covers.push(normalizeMediaEntry({
      url: game.cover_url || game.coverImage,
      mediaType: 'cover',
      provider: 'igdb',
      uiAllowed: true,
      healthcheckStatus: 'ok',
      licenseStatus: 'approved_with_review',
    }, 'cover'))
  }

  return content
}

function buildTabBlocks(tabId, content, game) {
  switch (tabId) {
    case 'overview': {
      return [{
        type: 'overview',
        data: buildOverviewContent(game, content),
      }]
    }
    case 'lore':
      return content.lore
    case 'characters':
      return content.characters.length ? [{ type: 'character-list', items: content.characters }] : []
    case 'dev-team':
      return content.dev_team.length ? [{ type: 'people-list', items: content.dev_team }] : []
    case 'ost':
      return [{
        type: 'ost',
        composers: content.ost.composers,
        tracks: content.ost.tracks,
        releases: content.ost.releases,
      }]
    case 'manuals':
      return content.manuals.length ? [{ type: 'media-gallery', mediaType: 'manual', items: content.manuals }] : []
    case 'maps':
      return content.maps.length ? [{ type: 'media-gallery', mediaType: 'map', items: content.maps }] : []
    case 'sprites-assets': {
      const blocks = []
      if (content.sprites.length) {
        blocks.push({ type: 'media-gallery', mediaType: 'sprite_sheet', items: content.sprites })
      }
      if (content._extra_assets.length) {
        blocks.push({ type: 'media-gallery', mediaType: 'asset', items: content._extra_assets })
      }
      return blocks
    }
    case 'codes-tips': {
      const blocks = []
      if (content.codes.length) {
        blocks.push({ type: 'code-list', items: content.codes })
      }
      if (content.tips.length) {
        blocks.push({ type: 'tip-list', items: content.tips })
      }
      return blocks
    }
    case 'records':
      return content.records.length ? [{ type: 'record-list', items: content.records }] : []
    case 'ending':
      return content.endings.length ? [{ type: 'media-gallery', mediaType: 'ending', items: content.endings }] : []
    case 'development':
      return content.development.length ? [{ type: 'fact-list', items: content.development }] : []
    case 'anecdotes':
      return content.development_anecdotes.length ? [{ type: 'anecdote-list', items: content.development_anecdotes }] : []
    default:
      return []
  }
}

function shouldIncludeTab(definition, profile, content) {
  if (definition.id === 'overview') {
    return true
  }

  if (definition.id === 'codes-tips') {
    return Boolean(profile.codes || profile.tips)
      && Boolean(content.codes.length || content.tips.length)
  }

  return Boolean(profile[definition.profileKey])
}

function buildGameDetailDataLayer({
  game,
  archive,
  encyclopedia,
  storedProfile = null,
  includeLazyTabs = true,
  scope = 'full',
}) {
  const normalizedGame = game || {}
  const normalizedArchive = archive || {}
  const normalizedEncyclopedia = encyclopedia || {}
  const content = buildContent(normalizedGame, normalizedArchive, normalizedEncyclopedia)
  const contentProfile = buildRuntimeProfile(normalizedGame, content, storedProfile)
  const tabs = TAB_ORDER
    .filter((definition) => includeLazyTabs || !definition.lazy)
    .filter((definition) => shouldIncludeTab(definition, contentProfile, content))
    .map((definition) => ({
      id: definition.id,
      name: definition.name,
      lazy: definition.lazy,
      content: buildTabBlocks(definition.id, content, normalizedGame),
    }))
    .filter((tab) => tab.id === 'overview' || tab.content.length > 0)

  return {
    ok: true,
    game_id: normalizedGame.id,
    title: normalizedGame.title || null,
    platform: normalizedGame.consoleData?.name || normalizedGame.console || null,
    content_profile: contentProfile,
    content: {
      overview: buildOverviewContent(normalizedGame, content),
      synopsis: content.synopsis,
      lore: content.lore,
      characters: content.characters,
      dev_team: content.dev_team,
      ost: content.ost,
      manuals: content.manuals,
      maps: content.maps,
      sprites: content.sprites,
      endings: content.endings,
      codes: content.codes,
      tips: content.tips,
      records: content.records,
      covers: content.covers,
      game_length: content.game_length,
      development: content.development,
      development_anecdotes: content.development_anecdotes,
    },
    tabs,
    meta: {
      source: 'supadata',
      version: 'game-detail-v2',
      scope,
      stored_profile_version: storedProfile?.profile_version || null,
      stored_profile_mode: storedProfile?.profile_mode || null,
    },
  }
}

module.exports = {
  TAB_ORDER,
  buildGameDetailDataLayer,
  normalizeStoredProfile,
}
