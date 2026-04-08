'use strict'

const { db } = require('../../db_supabase')

function getRecordValue(record, fields = []) {
  for (const field of fields) {
    if (record && record[field] != null && record[field] !== '') {
      return record[field]
    }
  }

  return null
}

function uniqueStrings(values = []) {
  return Array.from(new Set((values || []).map((value) => String(value || '')).filter(Boolean)))
}

function isMissingSupabaseRelationError(error) {
  const message = String(error?.message || error || '').toLowerCase()
  return (
    message.includes('schema cache') ||
    message.includes('could not find the table') ||
    message.includes('no such table') ||
    message.includes('no such column') ||
    (message.includes('column') && message.includes('does not exist')) ||
    (message.includes('relation') && message.includes('does not exist'))
  )
}

async function fetchRowsInBatches(table, columns, configure, orderBy) {
  const rows = []
  let from = 0
  const batchSize = Math.max(1, Math.min(1000, Number(orderBy?.batchSize) || 1000))

  while (true) {
    let query = db.from(table).select(columns)
    query = configure(query)

    if (orderBy) {
      query = query.order(orderBy.column, orderBy.options)
    }

    query = query.range(from, from + batchSize - 1)

    const { data, error } = await query
    if (error) {
      throw new Error(error.message)
    }

    if (!Array.isArray(data) || data.length === 0) {
      break
    }

    rows.push(...data)

    if (data.length < batchSize) {
      break
    }

    from += batchSize
  }

  return rows
}

module.exports = {
  getRecordValue,
  uniqueStrings,
  isMissingSupabaseRelationError,
  fetchRowsInBatches,
}
