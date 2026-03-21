'use strict'
const LOOKUP = require('../../data/lookup_tables.json')

const REQUIRED = {
  game: ['slug', 'name', 'platform', 'release_year', 'genre']
}

function validateRecord(record, entityType) {
  const errors = [], warnings = []
  for (const field of (REQUIRED[entityType] || [])) {
    if (!record[field]) errors.push(`MISSING:${field}`)
  }
  if (record.platform && !LOOKUP.platforms.includes(record.platform))
    errors.push(`UNKNOWN_PLATFORM:${record.platform}`)
  if (record.release_year &&
      (record.release_year < 1970 || record.release_year > 2015))
    warnings.push(`SUSPICIOUS_YEAR:${record.release_year}`)
  return { valid: errors.length === 0, errors, warnings }
}

module.exports = { validateRecord }
