'use strict'
const path = require('path')
const db = require(path.join(__dirname, '../../backend/config/database'))
const sequelize = db.sequelize || db
const Company = require(path.join(__dirname, '../../backend/src/models/Company'))

async function main() {
  await Company.sync({ alter: true })

  await Company.bulkCreate([
    { id: 'nintendo',     name: 'Nintendo',          role: 'both',      country: 'JP', founded_year: 1889 },
    { id: 'sega',         name: 'Sega',              role: 'both',      country: 'JP', founded_year: 1945 },
    { id: 'sony',         name: 'Sony Interactive',  role: 'both',      country: 'JP', founded_year: 1993 },
    { id: 'konami',       name: 'Konami',            role: 'both',      country: 'JP', founded_year: 1969 },
    { id: 'capcom',       name: 'Capcom',            role: 'both',      country: 'JP', founded_year: 1979 },
    { id: 'square',       name: 'Square',            role: 'developer', country: 'JP', founded_year: 1986 },
    { id: 'enix',         name: 'Enix',              role: 'publisher', country: 'JP', founded_year: 1975 },
    { id: 'squareenix',   name: 'Square Enix',       role: 'both',      country: 'JP', founded_year: 2003 },
    { id: 'namco',        name: 'Namco',             role: 'both',      country: 'JP', founded_year: 1955 },
    { id: 'snk',          name: 'SNK',               role: 'both',      country: 'JP', founded_year: 1978 },
    { id: 'taito',        name: 'Taito',             role: 'both',      country: 'JP', founded_year: 1953 },
    { id: 'atlus',        name: 'Atlus',             role: 'both',      country: 'JP', founded_year: 1986 },
    { id: 'naughtydog',   name: 'Naughty Dog',       role: 'developer', country: 'US', founded_year: 1984 },
    { id: 'rareware',     name: 'Rare',              role: 'developer', country: 'GB', founded_year: 1985 },
    { id: 'hudson',       name: 'Hudson Soft',       role: 'both',      country: 'JP', founded_year: 1973 },
    { id: 'treasure',     name: 'Treasure',          role: 'developer', country: 'JP', founded_year: 1992 },
    { id: 'hal',          name: 'HAL Laboratory',    role: 'developer', country: 'JP', founded_year: 1980 },
    { id: 'gamefreak',    name: 'Game Freak',        role: 'developer', country: 'JP', founded_year: 1989 },
    { id: 'retrogames',   name: 'Retro Studios',     role: 'developer', country: 'US', founded_year: 1998 },
    { id: 'midway',       name: 'Midway Games',      role: 'both',      country: 'US', founded_year: 1958 }
  ], { ignoreDuplicates: true })

  const count = await Company.count()
  console.log(`[OK] ${count} companies en base`)
  await sequelize.close()
}

main().catch(async err => {
  console.error('[FATAL]', err.message)
  try { await sequelize.close() } catch (_) {}
  process.exit(1)
})
