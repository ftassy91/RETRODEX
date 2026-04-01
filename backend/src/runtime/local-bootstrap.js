'use strict'

const fs = require('fs')
const path = require('path')

const { runMigrations } = require('../services/migration-runner')
const { getLegacyRuntime } = require('./legacy-runtime')

function parseConsoleGeneration(value) {
  const raw = String(value || '').trim()
  if (!raw) {
    return null
  }

  const numeric = Number.parseInt(raw, 10)
  if (Number.isInteger(numeric)) {
    return numeric
  }

  const normalized = raw.toLowerCase()
  const map = new Map([
    ['first', 1],
    ['second', 2],
    ['third', 3],
    ['fourth', 4],
    ['fifth', 5],
    ['sixth', 6],
    ['seventh', 7],
    ['eighth', 8],
    ['ninth', 9],
  ])

  for (const [token, rank] of map.entries()) {
    if (normalized.includes(token)) {
      return rank
    }
  }

  return null
}

async function seedConsoles(runtime = getLegacyRuntime()) {
  const { Console } = runtime
  const existingCount = await Console.count().catch(() => 0)
  if (existingCount > 0) {
    return { inserted: 0, skipped: true }
  }

  const seedPath = path.join(__dirname, '..', '..', 'data', 'consoles.json')
  const raw = await fs.promises.readFile(seedPath, 'utf8').catch(() => null)
  if (!raw) {
    return { inserted: 0, skipped: true }
  }

  const items = JSON.parse(raw)
  const rows = (Array.isArray(items) ? items : [])
    .map((item) => ({
      id: String(item.id || '').trim(),
      slug: String(item.id || item.slug || '').trim(),
      name: String(item.name || '').trim(),
      manufacturer: String(item.manufacturer || 'Unknown').trim(),
      generation: parseConsoleGeneration(item.generation),
      releaseYear: Number.isInteger(Number(item.release_year)) ? Number(item.release_year) : null,
    }))
    .filter((item) => item.id && item.slug && item.name)

  if (!rows.length) {
    return { inserted: 0, skipped: true }
  }

  await Console.bulkCreate(rows, { ignoreDuplicates: true })
  return { inserted: rows.length, skipped: false }
}

async function bootstrapLocalSandbox() {
  const runtime = getLegacyRuntime()
  if (runtime.databaseMode !== 'sqlite') {
    throw new Error('db:bootstrap-local only supports SQLite sandbox mode')
  }

  await runtime.sequelize.sync({ alter: false })
  await runMigrations(runtime.sequelize)
  const consoleSeed = await seedConsoles(runtime)

  return {
    databaseMode: runtime.databaseMode,
    storagePath: runtime.storagePath,
    consoleSeed,
  }
}

async function seedPrototypeLocal({ force = false } = {}) {
  const runtime = await bootstrapLocalSandbox()
  const { syncGamesFromPrototype } = require('../syncGames')
  const result = await syncGamesFromPrototype({ force })
  return {
    ...runtime,
    prototypeSeed: result,
  }
}

module.exports = {
  bootstrapLocalSandbox,
  seedConsoles,
  seedPrototypeLocal,
}
