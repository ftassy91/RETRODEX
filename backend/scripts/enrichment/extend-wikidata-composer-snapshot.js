#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const {
  AUDIT_DIR,
  ensureDir,
  latestJsonFile,
  parseNumberFlag,
  parseStringFlag,
  readJson,
  uniqueStrings,
} = require('./_work-catalog-common')

const OUTPUT_DIR = path.join(path.dirname(AUDIT_DIR), 'enrichment', 'wikidata')
const USER_AGENT = 'RetroDexCodex/1.0 (https://github.com/ftassy91/RETRODEX)'
const EXTRA_WIKI_LANGS = ['de', 'it', 'nl', 'pl', 'sv', 'fi']
const EXTRA_COMPOSER_FIELDS = [
  'komponist',
  'komponisten',
  'colonna sonora',
  'compositore',
  'compositori',
  'muziek',
  'componist',
  'componisten',
  'muzyka',
  'kompozytor',
  'kompozytorzy',
  'musik',
  'kompositor',
  'kompositör',
  'savellys',
  'sävellys',
  'saevellys',
  'saveltaja',
  'säveltäjä',
  'säveltäjät',
]

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

const NON_LANGUAGE_WIKI_SITES = new Set([
  'commonswiki',
  'foundationwiki',
  'incubatorwiki',
  'mediawiki',
  'metawiki',
  'specieswiki',
  'testwiki',
  'wikidatawiki',
])

const ALL_COMPOSER_FIELDS = uniqueStrings([
  ...EXTRA_COMPOSER_FIELDS,
  'composer',
  'composers',
  'music',
  'music by',
  'sound',
  'sound composer',
  'musique',
  'compositeur',
  'compositeurs',
  'musica',
  'música',
  'compositor',
  'compositores',
  '\u97f3\u697d',
  '\u4f5c\u66f2',
  '\u4f5c\u66f2\u8005',
  '\u30b5\u30a6\u30f3\u30c9',
  '\u97f3\u4e50',
  '\u97f3\u6a02',
  '\u97f3\u4e50\u8bbe\u8ba1',
  '\u97f3\u6a02\u8a2d\u8a08',
  '\uc74c\uc545',
  '\ucef4\ud3ec\uc800',
  '\u043c\u0443\u0437\u044b\u043a\u0430',
  '\u043a\u043e\u043c\u043f\u043e\u0437\u0438\u0442\u043e\u0440',
  'hudba',
])

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

function wikipediaLangsFromEntity(entity) {
  return Object.keys(entity?.sitelinks || {})
    .filter((siteKey) => siteKey.endsWith('wiki'))
    .filter((siteKey) => !NON_LANGUAGE_WIKI_SITES.has(siteKey))
    .map((siteKey) => siteKey.slice(0, -4).replace(/_/g, '-'))
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
    .replace(/\{\{plainlist\|/gi, '')
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
    .filter((entry) => !/^[a-z0-9_-]+=$/i.test(entry))
    .filter((entry) => !/[{}<>]/.test(entry))
    .filter((entry) => !/(plainlist|file:|category:|infobox|wikitable|citation needed)/i.test(entry))
    .filter((entry) => !/^[a-z0-9_-]+\s*=.+$/i.test(entry))
    .filter((entry) => !/^(collapsible list|title=)$/i.test(entry))
    .filter((entry) => !/^q\d+$/i.test(entry))
    .filter((entry) => !/^[-*]+$/.test(entry))
    .filter((entry) => !/\.(jpg|jpeg|png|gif|svg)$/i.test(entry))
    .filter((entry) => entry.length >= 2)
}

async function fetchEntity(qid) {
  const payload = await fetchJson(`https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(qid)}.json`)
  return payload.entities?.[qid] || null
}

async function fetchWikiExtracts(entity, fields) {
  const results = []
  const sitelinks = entity?.sitelinks || {}
  const wikiLangs = uniqueStrings([...EXTRA_WIKI_LANGS, ...wikipediaLangsFromEntity(entity)])

  for (const lang of wikiLangs) {
    const siteKey = `${lang.replace(/-/g, '_')}wiki`
    const link = sitelinks[siteKey]
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
      // Ignore per-wiki failures so the enrichment run can continue.
    }

    await sleep(120)
  }

  return results
}

function dedupeCandidates(candidates = []) {
  const seen = new Set()
  const deduped = []

  for (const candidate of candidates) {
    if (!candidate || !candidate.name) continue
    const key = `${normalizeText(candidate.name)}::${String(candidate.sourceUrl || '')}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(candidate)
  }

  return deduped
}

function toComposerCandidates(extract) {
  return extract.values.map((name) => ({
    name,
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: extract.url,
    confidenceLevel: 0.8,
    notes: `Composer credits extracted from ${extract.language}wiki infobox for ${extract.title}`,
  }))
}

function buildSummary(entries) {
  const byDebtType = entries.reduce((acc, entry) => {
    const debtType = String(entry.debtType || 'unknown')
    if (!acc[debtType]) {
      acc[debtType] = { total: 0, resolved: 0, blocked: 0 }
    }
    acc[debtType].total += 1
    if (entry.status === 'resolved') acc[debtType].resolved += 1
    else acc[debtType].blocked += 1
    return acc
  }, {})

  return {
    total: entries.length,
    resolved: entries.filter((entry) => entry.status === 'resolved').length,
    blocked: entries.filter((entry) => entry.status !== 'resolved').length,
    byDebtType,
  }
}

async function main() {
  const snapshotPath = parseStringFlag(process.argv, 'snapshot', latestJsonFile(OUTPUT_DIR, '_wikidata_credit_snapshot.json'))
  const limit = parseNumberFlag(process.argv, 'limit', 0)
  const snapshot = readJson(snapshotPath)
  if (!Array.isArray(snapshot?.entries)) {
    throw new Error(`Snapshot file does not contain an entries array: ${snapshotPath}`)
  }

  const nextEntries = []
  let processed = 0
  let newlyResolved = 0

  for (const entry of snapshot.entries) {
    const nextEntry = { ...entry }
    const shouldProcess = entry.debtType === 'composers'
      && entry.status !== 'resolved'
      && entry.wikidataQid
      && (!limit || processed < limit)

    if (!shouldProcess) {
      nextEntries.push(nextEntry)
      continue
    }

    processed += 1
    const entity = await fetchEntity(entry.wikidataQid)
    if (!entity) {
      nextEntries.push(nextEntry)
      continue
    }

    const extraExtracts = await fetchWikiExtracts(entity, ALL_COMPOSER_FIELDS)
    const extraCandidates = dedupeCandidates(extraExtracts.flatMap(toComposerCandidates))

    if (extraCandidates.length) {
      nextEntry.status = 'resolved'
      nextEntry.reason = null
      nextEntry.composerCandidates = dedupeCandidates([
        ...(Array.isArray(entry.composerCandidates) ? entry.composerCandidates : []),
        ...extraCandidates,
      ])
      nextEntry.wikiExtracts = {
        developers: Array.isArray(entry?.wikiExtracts?.developers) ? entry.wikiExtracts.developers : [],
        composers: [
          ...(Array.isArray(entry?.wikiExtracts?.composers) ? entry.wikiExtracts.composers : []),
          ...extraExtracts,
        ],
      }
      newlyResolved += 1
    }

    nextEntries.push(nextEntry)
    await sleep(120)
  }

  const nextSnapshot = {
    ...snapshot,
    generatedAt: new Date().toISOString(),
    extendedFrom: snapshotPath,
    extension: {
      mode: 'composer_extra_languages',
      languages: EXTRA_WIKI_LANGS,
      processed,
      newlyResolved,
    },
    entries: nextEntries,
    summary: buildSummary(nextEntries),
  }

  ensureDir(OUTPUT_DIR)
  const outputPath = path.join(OUTPUT_DIR, `${timestamp()}_wikidata_credit_snapshot.json`)
  fs.writeFileSync(outputPath, JSON.stringify(nextSnapshot, null, 2))

  console.log(JSON.stringify({
    mode: 'extend',
    snapshotPath,
    outputPath,
    processed,
    newlyResolved,
    summary: nextSnapshot.summary,
  }, null, 2))
}

main().catch((error) => {
  console.error('[extend-wikidata-composer-snapshot]', error && error.stack ? error.stack : error)
  process.exit(1)
})
