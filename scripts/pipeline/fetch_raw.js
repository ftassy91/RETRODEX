'use strict'
const fs   = require('fs')
const path = require('path')
const LOOKUP = require('../../data/lookup_tables.json')

async function fetchFromWikidata(platformName, limit = 25, offset = 0) {
  const platformId = LOOKUP.wikidata_platform_ids[platformName]
  if (!platformId) throw new Error(`No Wikidata ID for: ${platformName}`)

  const query = `
    SELECT DISTINCT ?item ?name ?year ?dev ?genre WHERE {
      ?item wdt:P31 wd:Q7889 .
      ?item wdt:P400 wd:${platformId} .
      ?item rdfs:label ?name .
      FILTER(LANG(?name) = "en")
      OPTIONAL { ?item wdt:P577 ?date . BIND(YEAR(?date) AS ?year) }
      OPTIONAL {
        ?item wdt:P178 ?devItem .
        ?devItem rdfs:label ?dev .
        FILTER(LANG(?dev) = "en")
      }
      OPTIONAL {
        ?item wdt:P136 ?genreItem .
        ?genreItem rdfs:label ?genre .
        FILTER(LANG(?genre) = "en")
      }
    }
    ORDER BY ?name
    LIMIT ${limit} OFFSET ${offset}
  `

  const url = 'https://query.wikidata.org/sparql?query='
    + encodeURIComponent(query) + '&format=json'

  const res = await fetch(url, {
    headers: { 'User-Agent': 'RetroDex/1.0 (retrogaming database)' }
  })
  if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`)

  const data = await res.json()
  return data.results.bindings.map(row => ({
    name:      row.name?.value || null,
    platform:  platformName,
    year:      row.year?.value ? parseInt(row.year.value) : null,
    developer: row.dev?.value || null,
    genre:     row.genre?.value || null,
    _source:   'wikidata'
  })).filter(r => r.name)
}

function saveRaw(records, entityType) {
  const dir = path.join(__dirname, '../../data/raw', entityType)
  fs.mkdirSync(dir, { recursive: true })
  records.forEach((record, i) => {
    const slug = (record.name || `record-${i}`)
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 80)
    const file = path.join(dir, `${slug}.json`)
    fs.writeFileSync(file, JSON.stringify(record, null, 2))
  })
  return records.length
}

module.exports = { fetchFromWikidata, saveRaw }

// Test si lancé directement
if (require.main === module) {
  const platform = process.argv[2] || 'Super Nintendo'
  const limit    = parseInt(process.argv[3]) || 5

  console.log(`[TEST] Fetching ${limit} games from Wikidata for: ${platform}`)
  fetchFromWikidata(platform, limit, 0)
    .then(records => {
      console.log(`[OK] ${records.length} records récupérés`)
      console.log(JSON.stringify(records[0], null, 2))
      saveRaw(records, 'game')
      console.log(`[OK] Sauvegardés dans data/raw/game/`)
    })
    .catch(err => console.error('[ERR]', err.message))
}
