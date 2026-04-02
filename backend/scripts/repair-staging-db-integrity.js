#!/usr/bin/env node
'use strict'

const path = require('path')
const Database = require('better-sqlite3')

function resolveDbPath() {
  const custom = process.argv.find((entry) => String(entry).startsWith('--db='))
  if (custom) {
    return path.resolve(process.cwd(), String(custom).slice('--db='.length))
  }
  return path.resolve(__dirname, '..', 'storage', 'retrodex.sqlite')
}

function titleCaseToken(token) {
  if (!token) {
    return token
  }

  const exactMap = new Map([
    ['2k', '2K'],
    ['3do', '3DO'],
    ['ea', 'EA'],
    ['hal', 'HAL'],
    ['am2', 'AM2'],
    ['am3', 'AM3'],
    ['am4', 'AM4'],
    ['melb', 'Melbourne'],
    ['scei', 'SCEI'],
    ['thq', 'THQ'],
    ['snk', 'SNK'],
    ['acclaim', 'Acclaim'],
    ['ltd', 'Ltd.'],
    ['co', 'Co.'],
    ['corp', 'Corp.'],
    ['ent', 'Entertainment'],
    ['sys', 'Systems'],
    ['comm', 'Communications'],
    ['assoc', 'Associates'],
    ['ie', 'IE'],
    ['rd1', 'R&D1'],
    ['rd3', 'R&D3'],
    ['rd4', 'R&D4'],
    ['r-d1', 'R&D1'],
  ])

  const lowered = token.toLowerCase()
  if (exactMap.has(lowered)) {
    return exactMap.get(lowered)
  }

  if (/^\d+$/.test(token)) {
    return token
  }

  if (/^[a-z]\d+$/i.test(token)) {
    return token.toUpperCase()
  }

  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()
}

function humanizeCompanyId(companyId) {
  return String(companyId)
    .split('-')
    .filter(Boolean)
    .map((token) => titleCaseToken(token))
    .join(' ')
}

function expandIdToken(token) {
  const lowered = String(token || '').toLowerCase()
  const aliasMap = new Map([
    ['assoc', ['associates']],
    ['comm', ['communications']],
    ['corp', ['corporation']],
    ['ent', ['entertainment']],
    ['ie', ['interactive', 'entertainment']],
    ['melb', ['melbourne']],
    ['sys', ['systems']],
  ])

  return aliasMap.get(lowered) || [lowered]
}

function tokenizeCompanyId(companyId) {
  return String(companyId)
    .split('-')
    .flatMap((token) => expandIdToken(token))
    .filter(Boolean)
}

function tokenizeCompanyName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

function isTrustworthySourceName(companyId, sourceName) {
  const stopwords = new Set([
    'and',
    'co',
    'company',
    'communications',
    'corporation',
    'corp',
    'entertainment',
    'game',
    'games',
    'inc',
    'incorporated',
    'interactive',
    'limited',
    'ltd',
    'productions',
    'production',
    'software',
    'studio',
    'studios',
    'system',
    'systems',
    'the',
  ])

  const idTokens = tokenizeCompanyId(companyId).filter((token) => !stopwords.has(token))
  const nameTokens = tokenizeCompanyName(sourceName).filter((token) => !stopwords.has(token))
  if (!idTokens.length || !nameTokens.length) {
    return false
  }

  return idTokens.every((idToken) => nameTokens.some((nameToken) => (
    nameToken === idToken ||
    nameToken.startsWith(idToken) ||
    idToken.startsWith(nameToken)
  )))
}

function buildCompanyCandidates(db) {
  const rows = db.prepare(`
    WITH referenced AS (
      SELECT developerId AS company_id, NULLIF(TRIM(developer), '') AS company_name, 'developer' AS role
      FROM games
      WHERE developerId IS NOT NULL AND TRIM(developerId) <> ''
      UNION ALL
      SELECT publisherId AS company_id, NULL AS company_name, 'publisher' AS role
      FROM games
      WHERE publisherId IS NOT NULL AND TRIM(publisherId) <> ''
      UNION ALL
      SELECT company_id, NULL AS company_name, role
      FROM game_companies
      WHERE company_id IS NOT NULL AND TRIM(company_id) <> ''
    ),
    grouped AS (
      SELECT
        company_id,
        COUNT(*) AS refs,
        COUNT(DISTINCT company_name) FILTER (WHERE company_name IS NOT NULL) AS distinct_names,
        MIN(company_name) FILTER (WHERE company_name IS NOT NULL) AS single_name,
        GROUP_CONCAT(DISTINCT company_name) FILTER (WHERE company_name IS NOT NULL) AS candidate_names,
        MAX(CASE WHEN role = 'developer' THEN 1 ELSE 0 END) AS has_developer,
        MAX(CASE WHEN role = 'publisher' THEN 1 ELSE 0 END) AS has_publisher
      FROM referenced
      GROUP BY company_id
    )
    SELECT
      g.company_id,
      g.refs,
      g.distinct_names,
      g.single_name,
      g.candidate_names,
      g.has_developer,
      g.has_publisher
    FROM grouped g
    LEFT JOIN companies c ON c.id = g.company_id
    WHERE c.id IS NULL
    ORDER BY g.refs DESC, g.company_id ASC
  `).all()

  return rows.map((row) => {
    const role = row.has_developer && row.has_publisher
      ? 'both'
      : row.has_developer
        ? 'developer'
        : 'publisher'

    const useSourceName = row.distinct_names === 1 && isTrustworthySourceName(row.company_id, row.single_name)
    const sourceType = useSourceName ? 'developer_name' : 'slug_humanized'
    const name = useSourceName ? row.single_name : humanizeCompanyId(row.company_id)

    return {
      id: row.company_id,
      name,
      role,
      refs: row.refs,
      sourceType,
      distinctNames: row.distinct_names,
      candidateNames: row.candidate_names ? String(row.candidate_names).split(',') : [],
    }
  })
}

function groupForeignKeyIssues(rows) {
  const grouped = new Map()
  for (const row of rows) {
    const key = `${row.table}|${row.parent}|${row.fkid}`
    grouped.set(key, (grouped.get(key) || 0) + 1)
  }

  return [...grouped.entries()]
    .map(([key, count]) => {
      const [table, parent, fkid] = key.split('|')
      return { table, parent, fkid: Number(fkid), count }
    })
    .sort((a, b) => b.count - a.count)
}

function main() {
  const dbPath = resolveDbPath()
  const db = new Database(dbPath)
  db.pragma('foreign_keys = ON')

  const beforeForeignKeyRows = db.pragma('foreign_key_check')
  const beforeIntegrity = db.pragma('integrity_check')
  const candidates = buildCompanyCandidates(db)
  const ambiguousCandidates = candidates.filter((entry) => entry.distinctNames > 1)
  const slugFallbackCandidates = candidates.filter((entry) => entry.sourceType === 'slug_humanized')
  const orphanGameGenresBefore = db.prepare(`
    SELECT COUNT(*) AS total
    FROM game_genres gg
    LEFT JOIN games g ON g.id = gg.gameId
    WHERE g.id IS NULL
  `).get().total

  const now = new Date().toISOString()
  const insertCompany = db.prepare(`
    INSERT INTO companies (id, name, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `)

  const deleteOrphanGenres = db.prepare(`
    DELETE FROM game_genres
    WHERE gameId IN (
      SELECT gg.gameId
      FROM game_genres gg
      LEFT JOIN games g ON g.id = gg.gameId
      WHERE g.id IS NULL
    )
  `)

  const transaction = db.transaction(() => {
    let insertedCompanies = 0
    for (const candidate of candidates) {
      insertCompany.run(candidate.id, candidate.name, candidate.role, now, now)
      insertedCompanies += 1
    }

    const deletedOrphanGenres = deleteOrphanGenres.run().changes
    return {
      insertedCompanies,
      deletedOrphanGenres,
    }
  })

  const mutationSummary = transaction()
  const afterForeignKeyRows = db.pragma('foreign_key_check')
  const afterIntegrity = db.pragma('integrity_check')

  console.log(JSON.stringify({
    dbPath,
    generatedAt: new Date().toISOString(),
    before: {
      integrityCheck: beforeIntegrity,
      foreignKeyIssueCount: beforeForeignKeyRows.length,
      foreignKeyGroups: groupForeignKeyIssues(beforeForeignKeyRows),
      orphanGameGenres: orphanGameGenresBefore,
    },
    applied: {
      insertedCompanies: mutationSummary.insertedCompanies,
      deletedOrphanGameGenres: mutationSummary.deletedOrphanGenres,
      companiesUsingDeveloperName: candidates.length - slugFallbackCandidates.length,
      companiesUsingSlugFallback: slugFallbackCandidates.length,
      ambiguousCompanyIdsResolvedConservatively: ambiguousCandidates.map((entry) => ({
        id: entry.id,
        candidateNames: entry.candidateNames,
        chosenName: entry.name,
        sourceType: entry.sourceType,
      })),
    },
    after: {
      integrityCheck: afterIntegrity,
      foreignKeyIssueCount: afterForeignKeyRows.length,
      foreignKeyGroups: groupForeignKeyIssues(afterForeignKeyRows),
      companiesCount: db.prepare('SELECT COUNT(*) AS total FROM companies').get().total,
      gameGenresCount: db.prepare('SELECT COUNT(*) AS total FROM game_genres').get().total,
    },
  }, null, 2))
}

try {
  main()
} catch (error) {
  console.error('[repair-staging-db-integrity]', error && error.stack ? error.stack : error)
  process.exitCode = 1
}
