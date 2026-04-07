#!/usr/bin/env node
'use strict'

/**
 * enrich-manuals-archiveorg.js
 *
 * Fetches Archive.org collection metadata for each retro console,
 * fuzzy-matches against RetroDex game titles, and writes manual_url
 * to games that currently have none.
 *
 * Sources:
 *   NES         → NESManuals
 *   SNES        → SNESManuals + snesmanualarchive (merged)
 *   Genesis     → SEGAGenesisMegaDriveManuals
 *   PlayStation → SonyPlaystationManuals
 *   N64         → N64Manuals + Nintendo64GameManuals
 *   Game Boy    → NintendoGameBoyManuals
 *   GBC         → NintendoGameBoyColorManuals
 *   GBA         → NintendoGameBoyAdvanceManuals
 *   NDS         → NintendoDSManuals
 *   Saturn      → SEGASaturnManuals_201812
 *   Dreamcast   → SEGADreamcastManuals_201812
 *   Master Sys. → SEGAMasterSystemManuals
 *   TurboGrafx  → NECTurboGrafx-16Manuals
 *   Neo Geo     → SNKNeoGeoMVSManuals
 *
 * Usage:
 *   node scripts/enrichment/enrich-manuals-archiveorg.js           # dry-run
 *   node scripts/enrichment/enrich-manuals-archiveorg.js --apply   # write
 */

const path = require('path')
const https = require('https')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const DB_PATH = path.resolve(__dirname, '../../storage/retrodex.sqlite')

// ---------------------------------------------------------------------------
// Console → Archive.org collection(s) mapping
// ---------------------------------------------------------------------------
const COLLECTION_MAP = [
  {
    consoles: ['Nintendo Entertainment System', 'NES'],
    collections: ['NESManuals'],
    preferPdf: true,
  },
  {
    consoles: ['Super Nintendo'],
    collections: ['SNESManuals', 'snesmanualarchive'],
    preferPdf: true,
  },
  {
    consoles: ['Sega Genesis'],
    collections: ['SEGAGenesisMegaDriveManuals'],
    preferPdf: true,
  },
  {
    consoles: ['PlayStation'],
    collections: ['SonyPlaystationManuals'],
    preferPdf: true,
  },
  {
    consoles: ['Nintendo 64'],
    collections: ['N64Manuals', 'Nintendo64GameManuals'],
    preferPdf: true,
  },
  {
    consoles: ['Game Boy'],
    collections: ['NintendoGameBoyManuals'],
    preferPdf: false, // mostly EPUB/CHOCR
  },
  {
    consoles: ['Game Boy Color'],
    collections: ['NintendoGameBoyColorManuals'],
    preferPdf: false,
  },
  {
    consoles: ['Game Boy Advance'],
    collections: ['NintendoGameBoyAdvanceManuals'],
    preferPdf: false,
  },
  {
    consoles: ['Nintendo DS'],
    collections: ['NintendoDSManuals', 'ds-game-manuals'],
    preferPdf: false,
  },
  {
    consoles: ['Sega Saturn'],
    collections: ['SEGASaturnManuals_201812'],
    preferPdf: true,
  },
  {
    consoles: ['Dreamcast'],
    collections: ['SEGADreamcastManuals_201812'],
    preferPdf: true,
  },
  {
    consoles: ['Sega Master System'],
    collections: ['SEGAMasterSystemManuals'],
    preferPdf: false,
  },
  {
    consoles: ['TurboGrafx-16'],
    collections: ['NECTurboGrafx-16Manuals'],
    preferPdf: true,
  },
  {
    consoles: ['Neo Geo'],
    collections: ['SNKNeoGeoMVSManuals'],
    preferPdf: true,
  },
]

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 30000 }, (res) => {
      const chunks = []
      res.on('data', (d) => chunks.push(d))
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString()))
        } catch (e) {
          reject(new Error(`JSON parse error for ${url}: ${e.message}`))
        }
      })
      res.on('error', reject)
    }).on('error', reject).on('timeout', () => reject(new Error(`Timeout: ${url}`)))
  })
}

// Normalize a title for comparison:
// - lowercase, remove accents, remove punctuation except letters/digits/spaces
function normalizeTitle(title) {
  return String(title)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remove "The " prefix
    .replace(/^the\s+/i, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Strip Archive.org region suffix from filename
// "Sonic The Hedgehog (USA, Europe).pdf" → "Sonic The Hedgehog"
function stripRegionSuffix(filename) {
  return filename
    .replace(/\.[^/.]+$/, '')           // remove extension
    .replace(/\s*\(.*\)\s*$/, '')       // remove trailing (...)
    .replace(/\s*\[.*\]\s*$/, '')       // remove trailing [...]
    .trim()
}

// Levenshtein distance (small titles only, cap at 50 chars)
function levenshtein(a, b) {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

// Score: 0 = perfect, higher = worse
function matchScore(archiveTitle, gameTitle) {
  const a = normalizeTitle(archiveTitle)
  const b = normalizeTitle(gameTitle)
  if (a === b) return 0
  // Token overlap bonus
  const tokA = new Set(a.split(' ').filter(Boolean))
  const tokB = new Set(b.split(' ').filter(Boolean))
  const overlap = [...tokA].filter(t => tokB.has(t)).length
  const totalTok = Math.max(tokA.size, tokB.size)
  const tokenRatio = totalTok > 0 ? overlap / totalTok : 0
  // Levenshtein on normalized (max 40 chars)
  const lev = levenshtein(a.substring(0, 40), b.substring(0, 40))
  // Combined score: weighted
  return lev * (1 - tokenRatio * 0.5)
}

// ---------------------------------------------------------------------------
// Fetch collection file list from Archive.org
// ---------------------------------------------------------------------------

async function fetchCollectionFiles(collectionId) {
  const url = `https://archive.org/metadata/${collectionId}/files`
  console.log(`  Fetching ${url} ...`)
  try {
    const data = await fetchJson(url)
    const files = Array.isArray(data.result) ? data.result : []
    return files.map(f => f.name).filter(Boolean)
  } catch (e) {
    console.warn(`  WARN: ${collectionId}: ${e.message}`)
    return []
  }
}

// Pick the best file for a game from a list of filenames
// Prefers PDF > EPUB > HTML
function pickBestFile(filenames, preferPdf) {
  const exts = preferPdf
    ? ['.pdf', '.epub', '.html', '.htm', '.jpg', '.png']
    : ['.epub', '.pdf', '.html', '.htm', '.jpg', '.png']
  for (const ext of exts) {
    const match = filenames.find(f => f.toLowerCase().endsWith(ext) && !f.includes('_text'))
    if (match) return match
  }
  return filenames[0] || null
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(APPLY ? '[APPLY MODE] Will write to SQLite\n' : '[DRY RUN] Pass --apply to write\n')

  const db = new Database(DB_PATH)

  // Load games without manual
  const games = db.prepare(`
    SELECT id, title, console
    FROM games
    WHERE manual_url IS NULL OR manual_url = ''
    ORDER BY console, title
  `).all()

  console.log(`Games without manual: ${games.length}`)

  const updateManual = APPLY
    ? db.prepare('UPDATE games SET manual_url = ? WHERE id = ?')
    : null

  const logRun = APPLY
    ? db.prepare(`INSERT INTO enrichment_runs (run_key, pipeline_name, mode, status, items_updated, items_skipped, started_at, finished_at)
        VALUES (?, 'enrich-manuals-archiveorg', 'apply', ?, ?, ?, datetime('now'), datetime('now'))`)
    : null

  let totalMatched = 0
  let totalSkipped = 0
  const results = [] // { id, title, console, url }

  for (const group of COLLECTION_MAP) {
    const groupGames = games.filter(g => group.consoles.includes(g.console))
    if (groupGames.length === 0) {
      console.log(`\n[${group.consoles[0]}] No games without manual`)
      continue
    }

    console.log(`\n[${group.consoles.join('/')}] ${groupGames.length} games without manual`)

    // Fetch all files from all collections in this group
    const allFiles = []
    for (const collectionId of group.collections) {
      const files = await fetchCollectionFiles(collectionId)
      // Tag each file with its collection
      for (const f of files) {
        allFiles.push({ filename: f, collection: collectionId })
      }
    }

    if (allFiles.length === 0) {
      console.log(`  No files found — skipping`)
      continue
    }

    // Build lookup: normalized archive title → best file entry
    const archiveLookup = new Map()
    for (const entry of allFiles) {
      const bare = stripRegionSuffix(entry.filename)
      const norm = normalizeTitle(bare)
      if (!archiveLookup.has(norm)) {
        archiveLookup.set(norm, [])
      }
      archiveLookup.get(norm).push({ ...entry, bare })
    }

    // For each game, find best match
    let matched = 0
    let skipped = 0

    for (const game of groupGames) {
      const gameNorm = normalizeTitle(game.title)

      // Exact match first
      let candidates = archiveLookup.get(gameNorm)

      // If no exact match, try fuzzy
      if (!candidates || candidates.length === 0) {
        let bestScore = Infinity
        let bestKey = null
        for (const [key] of archiveLookup) {
          const score = matchScore(key, gameNorm)
          if (score < bestScore) {
            bestScore = score
            bestKey = key
          }
        }
        // Only accept if score is low enough (close match)
        if (bestScore <= 3 && bestKey) {
          candidates = archiveLookup.get(bestKey)
        }
      }

      if (!candidates || candidates.length === 0) {
        skipped++
        continue
      }

      // From candidates, pick best file type
      const filenames = candidates.map(c => c.filename)
      const bestFile = pickBestFile(filenames, group.preferPdf)
      if (!bestFile) { skipped++; continue }

      const bestCollection = candidates.find(c => c.filename === bestFile)?.collection
        || candidates[0].collection

      const url = `https://archive.org/download/${bestCollection}/${encodeURIComponent(bestFile)}`

      results.push({ id: game.id, title: game.title, console: game.console, url })
      console.log(`  ✓ ${game.id}`)
      console.log(`    → ${url.substring(0, 100)}`)
      matched++
      totalMatched++

      if (APPLY) {
        updateManual.run(url, game.id)
      }
    }

    skipped = groupGames.length - matched
    totalSkipped += skipped
    console.log(`  → Matched: ${matched} | No match: ${skipped}`)
  }

  if (APPLY && logRun) {
    const runKey = `enrich-manuals-archiveorg-${new Date().toISOString()}`
    logRun.run(runKey, 'complete', totalMatched, totalSkipped)
  }

  db.close()

  console.log('\n════════════════════════════════════════════')
  console.log(`Matched  : ${totalMatched}`)
  console.log(`No match : ${totalSkipped}`)
  if (!APPLY) {
    console.log('\n[DRY RUN] Re-run with --apply to write.')
  } else {
    console.log('\n✓ Archive.org manual URLs written to SQLite.')
  }
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
