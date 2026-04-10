'use strict'

const { db, mode } = require('../../../db_supabase')
const { resolveCollectionScope } = require('./core')
const { ensureGameExists } = require('./storage')

function parseCsvLine(line) {
  const fields = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'))
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    const row = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    return row
  })
  return { headers, rows }
}

function normalizeCondition(value) {
  const v = String(value || '').trim().toLowerCase()
  if (v === 'loose' || v === 'l') return 'Loose'
  if (v === 'cib' || v === 'complet' || v === 'complete') return 'CIB'
  if (v === 'mint' || v === 'neuf' || v === 'sealed' || v === 'scelle') return 'Mint'
  return 'Loose'
}

function resolveColumn(row, candidates) {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== '') return row[key]
  }
  return null
}

async function matchGameByTitle(title, console) {
  if (!title) return null
  const search = String(title).trim()
  if (!search) return null

  if (mode !== 'supabase') return null

  let query = db.from('games').select('id,title,console').ilike('title', `%${search}%`).eq('type', 'game').limit(5)
  const { data, error } = await query
  if (error || !data?.length) return null

  // Prefer exact console match
  if (console) {
    const consoleMatch = data.find((g) =>
      String(g.console || '').toLowerCase().includes(String(console).toLowerCase())
    )
    if (consoleMatch) return consoleMatch
  }

  return data[0]
}

async function importCsvCollection(options = {}) {
  const scope = resolveCollectionScope(options)
  const csvText = String(options.csvText || '')
  const { headers, rows } = parseCsv(csvText)

  if (!rows.length) {
    return { matched: 0, skipped: 0, errors: [], items: [], message: 'CSV vide ou invalide.' }
  }

  const results = { matched: 0, skipped: 0, duplicates: 0, errors: [], items: [] }

  for (const row of rows) {
    const title = resolveColumn(row, ['title', 'titre', 'jeu', 'game', 'nom'])
    const console = resolveColumn(row, ['console', 'support', 'platform', 'systeme'])
    const condition = resolveColumn(row, ['condition', 'etat', 'state'])
    const pricePaid = resolveColumn(row, ['price_paid', 'prix', 'prix_paye', 'paid', 'price'])
    const region = resolveColumn(row, ['region', 'zone'])
    const notes = resolveColumn(row, ['notes', 'note', 'commentaire'])

    if (!title) {
      results.errors.push({ row: title, reason: 'Titre manquant' })
      results.skipped += 1
      continue
    }

    try {
      const game = await matchGameByTitle(title, console)
      if (!game) {
        results.errors.push({ row: title, reason: 'Jeu non trouve dans le catalogue' })
        results.skipped += 1
        continue
      }

      // Check duplicate
      const { data: existing } = await db
        .from('collection_items')
        .select('id')
        .eq('user_id', scope.userId || 'local')
        .eq('game_id', game.id)
        .limit(1)

      if (existing?.length) {
        results.errors.push({ row: title, reason: 'Deja dans la collection', gameId: game.id })
        results.duplicates += 1
        continue
      }

      const now = new Date().toISOString()
      const insertRow = {
        user_id: scope.userId || 'local',
        user_session: 'local',
        game_id: game.id,
        added_at: now,
        condition: normalizeCondition(condition),
        list_type: 'owned',
        price_paid: pricePaid ? Number(pricePaid) : null,
        region: region || null,
        notes: notes || null,
        completeness: 'unknown',
        qualification_confidence: 'unknown',
        created_at: now,
        updated_at: now,
      }

      const { error } = await db.from('collection_items').insert(insertRow)
      if (error) {
        results.errors.push({ row: title, reason: error.message })
        results.skipped += 1
        continue
      }

      results.matched += 1
      results.items.push({ title, gameId: game.id, gameTitle: game.title })
    } catch (err) {
      results.errors.push({ row: title, reason: err.message })
      results.skipped += 1
    }
  }

  results.message = `Import: ${results.matched} ajoutes, ${results.skipped} ignores, ${results.duplicates} doublons.`
  return results
}

module.exports = { importCsvCollection, parseCsv }
