'use strict'

function getArg(name, def) {
  const found = process.argv.find(a => a.startsWith(name + '='))
  return found ? found.split('=').slice(1).join('=') : def
}

const args = {
  entity:   getArg('--entity',   'game'),
  source:   getArg('--source',   'wikidata'),
  platform: getArg('--platform', 'Super Nintendo'),
  limit:    parseInt(getArg('--limit', '25')),
  offset:   parseInt(getArg('--offset', '0')),
  dryRun:   process.argv.includes('--dry-run')
}

async function main() {
  console.log('\n╔═══════════════════════════════╗')
  console.log('║   RETRODEX — DATA PIPELINE    ║')
  console.log('╚═══════════════════════════════╝')
  console.log(`  Entity   : ${args.entity}`)
  console.log(`  Source   : ${args.source}`)
  console.log(`  Platform : ${args.platform}`)
  console.log(`  Limit    : ${args.limit} | Offset: ${args.offset}`)
  console.log(`  Dry-run  : ${args.dryRun}\n`)

  const { fetchFromWikidata, saveRaw } = require('./fetch_raw')
  const { normalizeGame }              = require('./normalize')
  const { validateRecord }             = require('./validate')

  const stats = { total:0, ok:0, skip:0, err:0, warn:0 }
  const t0 = Date.now()

  // Stage 1 — Fetch
  console.log('► Stage 1 — Fetch')
  let raw = []
  if (args.source === 'wikidata') {
    raw = await fetchFromWikidata(args.platform, args.limit, args.offset)
    await saveRaw(raw, args.entity)
  } else {
    console.log('[ERR] Source non supportee:', args.source)
    process.exit(1)
  }
  console.log(`  → ${raw.length} records bruts\n`)

  // Stage 2 — Normalize
  console.log('► Stage 2 — Normalize')
  const normalized = raw.map(normalizeGame).filter(r => r.slug)
  console.log(`  → ${normalized.length}/${raw.length} normalises\n`)

  // Stage 3 — Validate
  console.log('► Stage 3 — Validate')
  const valid = []
  for (const record of normalized) {
    stats.total++
    const { valid: isValid, errors, warnings } = validateRecord(record, args.entity)
    if (!isValid) {
      console.log(`  [REJ] ${record.slug}: ${errors.join(', ')}`)
      stats.err++
    } else {
      if (warnings.length) {
        console.log(`  [WARN] ${record.slug}: ${warnings.join(', ')}`)
        stats.warn++
      }
      valid.push(record)
    }
  }
  console.log(`  → ${valid.length} valides\n`)

  // Stage 4 — Dedup
  console.log('► Stage 4 — Dedup')
  const seen = new Set()
  const deduped = valid.filter(r => {
    if (seen.has(r.slug)) { stats.skip++; return false }
    seen.add(r.slug); return true
  })
  console.log(`  → ${deduped.length} uniques, ${stats.skip} doublons\n`)

  // Stage 5 — Insert ou dry-run
  if (args.dryRun) {
    console.log('► Stage 5 — [DRY-RUN] Aperçu des 5 premiers :')
    deduped.slice(0, 5).forEach(r =>
      console.log(`  ${r.name} (${r.platform} ${r.release_year}) — ${r.genre}`)
    )
    stats.ok = deduped.length
  } else {
    console.log('► Stage 5 — Insert')
    const path      = require('path')
    const sequelize = require(path.join(__dirname, '../../backend/config/database'))
    const Game      = require(path.join(__dirname, '../../backend/src/models/Game'))
    await sequelize.sync({ alter: false })
    for (const record of deduped) {
      try {
        await Game.upsert({
          id:        record.slug,
          title:     record.name,
          console:   record.platform,
          year:      record.release_year,
          developer: record.developer,
          genre:     record.genre,
          summary:   record.description
        })
        console.log(`  [OK] ${record.name}`)
        stats.ok++
      } catch (err) {
        console.log(`  [ERR] ${record.slug}: ${err.message}`)
        stats.err++
      }
    }
    await sequelize.close()
  }

  const elapsed  = ((Date.now() - t0) / 1000).toFixed(1)
  const rph      = elapsed > 0
    ? Math.round(stats.ok / (parseFloat(elapsed) / 3600)) : '∞'

  console.log('\n╔═══════════════════════════════╗')
  console.log('║           RÉSUMÉ              ║')
  console.log('╚═══════════════════════════════╝')
  console.log(`  Insérés  : ${stats.ok}`)
  console.log(`  Doublons : ${stats.skip}`)
  console.log(`  Rejetés  : ${stats.err}`)
  console.log(`  Warnings : ${stats.warn}`)
  console.log(`  Durée    : ${elapsed}s`)
  console.log(`  Débit    : ~${rph} records/heure`)
  if (args.dryRun)
    console.log('\n  [DRY-RUN] Rien inséré — relancer sans --dry-run')
}

main().catch(err => {
  console.error('[FATAL]', err.message)
  process.exit(1)
})
