'use strict'

const {
  getHydratedGameByLookup,
} = require('./game-read-service')
const {
  buildConsolePayload,
} = require('./console-service')

function toLegacyMarketItemPayload(game) {
  return {
    id: game.id,
    title: game.title,
    platform: game.console,
    year: game.year,
    genre: game.genre,
    rarity: game.rarity,
    type: game.type || 'game',
    slug: game.slug || null,
    loosePrice: game.loosePrice ?? game.loose_price ?? null,
    cibPrice: game.cibPrice ?? game.cib_price ?? null,
    mintPrice: game.mintPrice ?? game.mint_price ?? null,
    metascore: game.metascore ?? null,
    coverImage: game.coverImage || game.cover_url || null,
    summary: game.summary || game.synopsis || null,
  }
}

async function fetchLegacyMarketItem(lookup) {
  const normalizedLookup = String(lookup || '').trim()
  if (!normalizedLookup) {
    return null
  }

  const item = await getHydratedGameByLookup(normalizedLookup)
  if (item) {
    return toLegacyMarketItemPayload(item)
  }

  const consolePayload = await buildConsolePayload(normalizedLookup, { gamesLimit: 24 }).catch(() => null)
  if (!consolePayload) {
    return null
  }

  return {
    id: consolePayload.console.id,
    title: consolePayload.console.name,
    platform: consolePayload.console.name,
    year: consolePayload.console.releaseYear,
    genre: null,
    rarity: null,
    type: 'console',
    slug: consolePayload.console.slug || null,
    loosePrice: null,
    cibPrice: null,
    mintPrice: null,
  }
}

module.exports = {
  fetchLegacyMarketItem,
}
