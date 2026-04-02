#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

const {
  SQLITE_PATH,
  AUDIT_DIR,
  TOP1200_DIR,
  ensureDir,
  latestJsonFile,
  parseStringFlag,
  parseNumberFlag,
  readJson,
  uniqueStrings,
} = require('./_work-catalog-common')

const OUTPUT_DIR = path.join(path.dirname(AUDIT_DIR), 'enrichment', 'wikidata')
const USER_AGENT = 'RetroDexCodex/1.0 (https://github.com/ftassy91/RETRODEX)'
const VIDEO_GAME_QID = 'Q7889'
const SUPPORTED_WIKI_LANGS = ['en', 'fr', 'pt', 'es', 'hu', 'ja', 'de', 'it', 'nl', 'pl', 'sv', 'fi']

const DEV_FIELDS = [
  'developer',
  'developers',
  'développeur',
  'développeurs',
  'developpeur',
  'developpeurs',
  'desarrollador',
  'desarrolladores',
  'desenvolvedor',
  'desenvolvedores',
  'fejlesztő',
  '開発元',
]

const COMPOSER_FIELDS = [
  'composer',
  'composers',
  'music',
  'music by',
  'musique',
  'música',
  'musica',
  'zeneszerző',
  'sound',
  'sound composer',
  '音楽',
]

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

function parseIdsArg(argv) {
  const token = argv.find((value) => String(value).startsWith('--ids='))
  if (!token) return []
  return uniqueStrings(String(token).slice('--ids='.length).split(','))
}

function loadTargetIds({ auditGamesPath, selectionBandPath, type, explicitIds }) {
  if (explicitIds.length) {
    return explicitIds
  }

  const band = readJson(selectionBandPath)
  const bandIds = new Set(uniqueStrings(band.ids || (band.items || []).map((entry) => entry.entityId)))
  const auditRows = readJson(auditGamesPath)
  const debtField = type === 'dev_team' ? 'dev_team' : 'ost_composers'

  return uniqueStrings(
    (Array.isArray(auditRows) ? auditRows : [])
      .filter((entry) => bandIds.has(String(entry.entityId)))
      .filter((entry) => (entry.missingCriticalFields || []).includes(debtField))
      .map((entry) => entry.entityId)
  )
}

function loadGames(targetIds) {
  if (!targetIds.length) return []

  const db = new Database(SQLITE_PATH, { readonly: true })
  try {
    return db.prepare(`
      SELECT id, title, console, year, dev_team, ost_composers
      FROM games
      WHERE id IN (${targetIds.map(() => '?').join(', ')})
      ORDER BY title ASC
    `).all(...targetIds)
  } finally {
    db.close()
  }
}

async function searchWikidata(title) {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(title)}&language=en&format=json&limit=8`
  const payload = await fetchJson(url)
  return Array.isArray(payload.search) ? payload.search : []
}

async function fetchEntity(qid) {
  const payload = await fetchJson(`https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(qid)}.json`)
  return payload.entities?.[qid] || null
}

async function resolveEntityLabels(qids = []) {
  const ids = uniqueStrings(qids)
  if (!ids.length) return new Map()

  const labels = new Map()
  for (let index = 0; index < ids.length; index += 40) {
    const chunk = ids.slice(index, index + 40)
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(chunk.join('|'))}&languages=en&format=json`
    const payload = await fetchJson(url)
    const entities = payload.entities || {}
    for (const id of Object.keys(entities)) {
      const entity = entities[id] || {}
      const anyLabel = Object.values(entity.labels || {})[0]?.value || id
      labels.set(id, String(entity.labels?.en?.value || anyLabel || id).trim())
    }
    await sleep(80)
  }

  return labels
}

function getClaimEntityIds(entity, property) {
  return (entity?.claims?.[property] || [])
    .map((claim) => claim?.mainsnak?.datavalue?.value?.id || null)
    .filter(Boolean)
}

function isVideoGameEntity(entity) {
  return getClaimEntityIds(entity, 'P31').includes(VIDEO_GAME_QID)
}

function candidateDescriptionLooksGame(candidate) {
  const description = normalizeText(candidate?.description)
  return description.includes('video game')
}

function getExactMatches(game, searchResults) {
  const normalizedTitle = normalizeText(game.title)
  return searchResults.filter((candidate) => {
    const labelMatch = normalizeText(candidate.label) === normalizedTitle
    const aliasMatch = (candidate.aliases || []).some((alias) => normalizeText(alias) === normalizedTitle)
    return labelMatch || aliasMatch
  })
}

function orderCandidates(game, searchResults) {
  const exactMatches = getExactMatches(game, searchResults)
  const ordered = []
  const consoleHint = normalizeText(game.console)
  const yearHint = String(game.year || '').trim()

  const pushIfMissing = (candidate) => {
    if (candidate && !ordered.some((entry) => entry.id === candidate.id)) {
      ordered.push(candidate)
    }
  }

  if (exactMatches.length > 1) {
    pushIfMissing(exactMatches.find((candidate) => {
      const description = normalizeText(candidate.description)
      return consoleHint && description.includes(consoleHint)
    }))
    pushIfMissing(exactMatches.find((candidate) => String(candidate.description || '').includes(yearHint)))
  }

  exactMatches.forEach(pushIfMissing)
  searchResults.forEach(pushIfMissing)
  return ordered
}

function extractFieldValues(wikitext, fields) {
  const values = []
  for (const field of fields) {
    const regex = new RegExp(`\\|\\s*${escapeRegExp(field)}\\s*=([^\\n]+)`, 'ig')
    let match
    while ((match = regex.exec(wikitext))) {
      values.push(match[1].trim())
    }
  }
  return values
}

function sanitizeWikiValue(raw) {
  return String(raw || '')
    .replace(/<br\s*\/?\s*>/gi, '; ')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^/]*\/>/gi, '')
    .replace(/<small>[\s\S]*?<\/small>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\{\{langue\|[^|]+\|([^}]+)\}\}/gi, '$1')
    .replace(/\{\{lang\|[^|]+\|([^}]+)\}\}/gi, '$1')
    .replace(/\{\{ill\|([^|}]+)[^}]*\}\}/gi, '$1')
    .replace(/\{\{nihongo\|([^|}]+)[^}]*\}\}/gi, '$1')
    .replace(/\{\{plainlist\|\s*\*/gi, '')
    .replace(/\{\{Plainlist\|\s*\*/gi, '')
    .replace(/\{\{Plainlist\|/gi, '')
    .replace(/\{\{ubl\|\s*\*/gi, '')
    .replace(/\{\{unbulleted list\|\s*/gi, '')
    .replace(/\{\{hlist\|/gi, '')
    .replace(/\{\{flatlist\|/gi, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/''+/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\|+/g, ', ')
    .replace(/\{|\}/g, '')
    .replace(/\b(C=|GBC|GBA|ARC|ARCADE)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitWikiNames(raw) {
  return sanitizeWikiValue(raw)
    .split(/<br\s*\/?\s*>|,| and | et | y | e |\/|;|\n|\u30fb/gi)
    .map((entry) => entry.trim())
    .map((entry) => entry.replace(/\s*\([^)]*\)\s*/g, ' ').trim())
    .filter(Boolean)
    .filter((entry) => !/^(plainlist|langue|lang)$/i.test(entry))
    .filter((entry) => !/[{}<>]/.test(entry))
    .filter((entry) => !/(plainlist|file:|category:|infobox|wikitable|citation needed)/i.test(entry))
    .filter((entry) => !/^(collapsible list|title=)$/i.test(entry))
    .filter((entry) => !/^q\d+$/i.test(entry))
    .filter((entry) => !/^[-*]+$/.test(entry))
    .filter((entry) => entry.length >= 2)
}

async function fetchWikiExtracts(entity, fields) {
  const results = []
  const sitelinks = entity?.sitelinks || {}

  for (const lang of SUPPORTED_WIKI_LANGS) {
    const link = sitelinks[`${lang}wiki`]
    if (!link?.title) continue

    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=revisions&rvslots=main&rvprop=content&format=json&titles=${encodeURIComponent(link.title)}`
    try {
      const payload = await fetchJson(url)
      const pages = payload.query?.pages || {}
      const page = pages[Object.keys(pages)[0]] || {}
      const wikitext = page?.revisions?.[0]?.slots?.main?.['*'] || ''
      const values = extractFieldValues(wikitext, fields).flatMap(splitWikiNames)
      const uniqueValues = uniqueStrings(values)
      if (uniqueValues.length) {
        results.push({
          language: lang,
          title: link.title,
          url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(link.title.replace(/ /g, '_'))}`,
          values: uniqueValues,
        })
      }
    } catch (_error) {
      // Ignore per-wiki failures; open snapshots should still complete.
    }
  }

  return results
}

function mapCandidates(values, source) {
  return uniqueStrings(values).map((name) => ({
    name,
    sourceName: source.sourceName,
    sourceType: source.sourceType,
    sourceUrl: source.sourceUrl,
    confidenceLevel: source.confidenceLevel,
    notes: source.notes,
  }))
}

function dedupeCandidates(candidates = []) {
  const seen = new Set()
  const deduped = []

  for (const candidate of candidates) {
    if (!candidate || !candidate.name) continue
    if (/^q\d+$/i.test(candidate.name)) continue
    const key = `${normalizeText(candidate.name)}::${String(candidate.sourceUrl || '')}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(candidate)
  }

  return deduped
}

async function buildSnapshotEntry(game, type) {
  const searchResults = await searchWikidata(game.title)
  const orderedCandidates = orderCandidates(game, searchResults)

  if (!orderedCandidates.length) {
    return {
      gameId: game.id,
      title: game.title,
      console: game.console,
      year: game.year,
      debtType: type,
      status: 'blocked',
      reason: 'no_exact_wikidata_match',
      searchResults: searchResults.map((entry) => ({
        id: entry.id,
        label: entry.label,
        description: entry.description || null,
      })),
      developerCandidates: [],
      composerCandidates: [],
    }
  }

  let candidate = null
  let entity = null
  for (const searchCandidate of orderedCandidates) {
    const nextEntity = await fetchEntity(searchCandidate.id)
    if (nextEntity && isVideoGameEntity(nextEntity)) {
      candidate = searchCandidate
      entity = nextEntity
      break
    }
    await sleep(40)
  }

  if (!candidate || !entity) {
    return {
      gameId: game.id,
      title: game.title,
      console: game.console,
      year: game.year,
      debtType: type,
      status: 'blocked',
      reason: 'wikidata_match_not_video_game',
      searchResults: searchResults.map((entry) => ({
        id: entry.id,
        label: entry.label,
        description: entry.description || null,
      })),
      developerCandidates: [],
      composerCandidates: [],
    }
  }

  const developerIds = getClaimEntityIds(entity, 'P178')
  const composerIds = getClaimEntityIds(entity, 'P86')
  if (!candidateDescriptionLooksGame(candidate) && !developerIds.length && !composerIds.length) {
    return {
      gameId: game.id,
      title: game.title,
      console: game.console,
      year: game.year,
      debtType: type,
      status: 'blocked',
      reason: 'wikidata_match_description_not_game_specific',
      wikidataQid: candidate.id,
      wikidataLabel: candidate.label,
      wikidataDescription: candidate.description || null,
      wikidataUrl: `https://www.wikidata.org/wiki/${candidate.id}`,
      developerCandidates: [],
      composerCandidates: [],
    }
  }

  const labelMap = await resolveEntityLabels([...developerIds, ...composerIds])

  const developerCandidates = mapCandidates(
    developerIds.map((id) => labelMap.get(id)).filter(Boolean),
    {
      sourceName: 'wikidata',
      sourceType: 'reference',
      sourceUrl: `https://www.wikidata.org/wiki/${candidate.id}`,
      confidenceLevel: 0.9,
      notes: `Developer credits curated from Wikidata entity ${candidate.id}`,
    }
  )

  const composerCandidates = mapCandidates(
    composerIds.map((id) => labelMap.get(id)).filter(Boolean),
    {
      sourceName: 'wikidata',
      sourceType: 'reference',
      sourceUrl: `https://www.wikidata.org/wiki/${candidate.id}`,
      confidenceLevel: 0.9,
      notes: `Composer credits curated from Wikidata entity ${candidate.id}`,
    }
  )

  const wikiDeveloperExtracts = await fetchWikiExtracts(entity, DEV_FIELDS)
  const wikiComposerExtracts = await fetchWikiExtracts(entity, COMPOSER_FIELDS)

  for (const extract of wikiDeveloperExtracts) {
    developerCandidates.push(...mapCandidates(extract.values, {
      sourceName: 'wikipedia',
      sourceType: 'reference',
      sourceUrl: extract.url,
      confidenceLevel: 0.84,
      notes: `Developer credits extracted from ${extract.language}wiki infobox for ${extract.title}`,
    }))
  }

  for (const extract of wikiComposerExtracts) {
    composerCandidates.push(...mapCandidates(extract.values, {
      sourceName: 'wikipedia',
      sourceType: 'reference',
      sourceUrl: extract.url,
      confidenceLevel: 0.82,
      notes: `Composer credits extracted from ${extract.language}wiki infobox for ${extract.title}`,
    }))
  }

  const finalDeveloperCandidates = dedupeCandidates(developerCandidates)
  const finalComposerCandidates = dedupeCandidates(composerCandidates)
  const status = type === 'dev_team'
    ? (finalDeveloperCandidates.length ? 'resolved' : 'blocked')
    : (finalComposerCandidates.length ? 'resolved' : 'blocked')

  return {
    gameId: game.id,
    title: game.title,
    console: game.console,
    year: game.year,
    debtType: type,
    status,
    reason: status === 'resolved' ? null : 'no_credit_candidates_from_wikidata_or_open_wikis',
    wikidataQid: candidate.id,
    wikidataLabel: candidate.label,
    wikidataDescription: candidate.description || null,
    wikidataUrl: `https://www.wikidata.org/wiki/${candidate.id}`,
    developerCandidates: finalDeveloperCandidates,
    composerCandidates: finalComposerCandidates,
    wikiExtracts: {
      developers: wikiDeveloperExtracts,
      composers: wikiComposerExtracts,
    },
  }
}

async function main() {
  const type = parseStringFlag(process.argv, 'type', 'all')
  const explicitIds = parseIdsArg(process.argv)
  const limit = parseNumberFlag(process.argv, 'limit', 0)
  const selectionBandPath = parseStringFlag(process.argv, 'selection-band', latestJsonFile(TOP1200_DIR))
  const auditGamesPath = parseStringFlag(process.argv, 'audit-games', path.join(
    AUDIT_DIR,
    fs.readdirSync(AUDIT_DIR)
      .filter((entry) => entry.endsWith('_games.json') && !entry.includes('_scoped_'))
      .sort()
      .pop()
  ))

  const debtTypes = type === 'all' ? ['dev_team', 'composers'] : [type]
  const snapshot = {
    generatedAt: new Date().toISOString(),
    selectionBandPath,
    auditGamesPath,
    debtTypes,
    entries: [],
  }

  for (const debtType of debtTypes) {
    const ids = loadTargetIds({
      auditGamesPath,
      selectionBandPath,
      type: debtType,
      explicitIds,
    })
    const targetIds = limit > 0 ? ids.slice(0, limit) : ids
    const games = loadGames(targetIds)
    for (const game of games) {
      const entry = await buildSnapshotEntry(game, debtType)
      snapshot.entries.push(entry)
      await sleep(80)
    }
  }

  const resolved = snapshot.entries.filter((entry) => entry.status === 'resolved')
  const blocked = snapshot.entries.filter((entry) => entry.status !== 'resolved')

  snapshot.summary = {
    total: snapshot.entries.length,
    resolved: resolved.length,
    blocked: blocked.length,
    byDebtType: debtTypes.reduce((acc, debtType) => {
      const rows = snapshot.entries.filter((entry) => entry.debtType === debtType)
      acc[debtType] = {
        total: rows.length,
        resolved: rows.filter((entry) => entry.status === 'resolved').length,
        blocked: rows.filter((entry) => entry.status !== 'resolved').length,
      }
      return acc
    }, {}),
  }

  ensureDir(OUTPUT_DIR)
  const stamp = timestamp()
  const outputPath = path.join(OUTPUT_DIR, `${stamp}_wikidata_credit_snapshot.json`)
  const blockedPath = path.join(OUTPUT_DIR, `${stamp}_wikidata_credit_blocked.json`)
  fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2))
  fs.writeFileSync(blockedPath, JSON.stringify({
    generatedAt: snapshot.generatedAt,
    selectionBandPath,
    debtTypes,
    blocked,
  }, null, 2))

  console.log(JSON.stringify({
    mode: 'snapshot',
    outputPath,
    blockedPath,
    summary: snapshot.summary,
  }, null, 2))
}

main().catch((error) => {
  console.error('[bootstrap-wikidata-credit-snapshot]', error && error.stack ? error.stack : error)
  process.exit(1)
})
