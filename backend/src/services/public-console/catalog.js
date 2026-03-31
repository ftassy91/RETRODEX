'use strict'

const { getConsoleById, normalizeConsoleKey } = require('../../lib/consoles')
const { normalizeGameRecord } = require('../../lib/normalize')

function buildConsoleAliases(consoleItem) {
  const values = [
    consoleItem?.id,
    consoleItem?.slug,
    consoleItem?.name,
    consoleItem?.title,
    consoleItem?.platform,
    consoleItem?.knowledgeEntry?.id,
    consoleItem?.knowledgeEntry?.name,
  ]

  const primaryName = normalizeConsoleKey(consoleItem?.name || consoleItem?.platform || consoleItem?.title)
  if (primaryName === 'super-nintendo' || primaryName === 'snes') {
    values.push('SNES', 'Super Nintendo', 'Super Nintendo Entertainment System')
  }
  if (primaryName === 'nes' || primaryName === 'nintendo-entertainment-system') {
    values.push('NES', 'Nintendo Entertainment System', 'Famicom')
  }
  if (primaryName === 'sega-mega-drive' || primaryName === 'sega-genesis' || primaryName === 'mega-drive' || primaryName === 'genesis') {
    values.push('Mega Drive', 'Sega Mega Drive', 'Genesis', 'Sega Genesis')
  }
  if (primaryName === 'playstation' || primaryName === 'ps1') {
    values.push('PS1', 'PSX', 'Sony PlayStation')
  }
  if (primaryName === 'game-boy') values.push('GB')
  if (primaryName === 'game-boy-advance') values.push('GBA')
  if (primaryName === 'nintendo-64') values.push('N64')
  if (primaryName === 'nintendo-ds') values.push('DS')
  if (primaryName === 'turbografx-16') values.push('PC Engine')
  if (primaryName === 'neo-geo') values.push('Neo Geo', 'Neo-Geo')
  if (primaryName === 'dreamcast' || primaryName === 'sega-dreamcast') {
    values.push('Dreamcast', 'Sega Dreamcast')
  }
  if (primaryName === 'sega-master-system') values.push('Master System')

  return Array.from(new Set(values.map((value) => normalizeConsoleKey(value)).filter(Boolean)))
}

function getConsoleCatalogKey(consoleItem) {
  if (consoleItem?.knowledgeEntry?.id) {
    return consoleItem.knowledgeEntry.id
  }

  return normalizeConsoleKey(consoleItem?.name || consoleItem?.platform || consoleItem?.title || consoleItem?.id)
}

function buildConsoleGamesMap(games = [], catalog = []) {
  const map = new Map()
  const aliasMap = new Map()

  ;(catalog || []).forEach((consoleItem) => {
    const key = getConsoleCatalogKey(consoleItem)
    for (const alias of buildConsoleAliases(consoleItem)) {
      if (!aliasMap.has(alias)) {
        aliasMap.set(alias, key)
      }
    }
  })

  games.forEach((game) => {
    const knowledgeEntry = getConsoleById(game.console)
    const key = knowledgeEntry?.id || aliasMap.get(normalizeConsoleKey(game.console)) || normalizeConsoleKey(game.console)
    if (!key) {
      return
    }

    if (!map.has(key)) {
      map.set(key, [])
    }

    map.get(key).push(normalizeGameRecord(game))
  })

  return map
}

function findConsoleInCatalog(catalog = [], requestedId) {
  const needle = normalizeConsoleKey(requestedId)
  if (!needle) {
    return null
  }

  return catalog.find((consoleItem) => buildConsoleAliases(consoleItem).includes(needle)) || null
}

function createGlobalConsoleResult(consoleItem, gamesCount = 0) {
  const releaseYear = consoleItem.releaseYear ?? consoleItem.release_year ?? null

  return {
    id: `console-${consoleItem.id}`,
    type: 'console',
    title: consoleItem.name || '',
    subtitle: [consoleItem.manufacturer, releaseYear, gamesCount ? `${gamesCount} jeux` : null]
      .filter(Boolean)
      .join(' Â· '),
    href: `/console-detail.html?id=${encodeURIComponent(consoleItem.id || '')}`,
    marketHref: `/stats.html?q=${encodeURIComponent(consoleItem.name || '')}`,
    product: 'retrodex',
    meta: {
      manufacturer: consoleItem.manufacturer || null,
      console: consoleItem.name || null,
      year: releaseYear,
      gamesCount,
    },
  }
}

function createGlobalFranchiseResult(franchise) {
  return {
    id: `franchise-${franchise.slug || franchise.id}`,
    type: 'franchise',
    title: franchise.name || '',
    subtitle: [franchise.developer, franchise.first_game_year, franchise.last_game_year ? `â†’ ${franchise.last_game_year}` : null]
      .filter(Boolean)
      .join(' Â· '),
    href: `/franchises.html?slug=${encodeURIComponent(franchise.slug || franchise.id || '')}`,
    product: 'retrodex',
    meta: {
      developer: franchise.developer || null,
      summary: franchise.synopsis || null,
    },
  }
}

module.exports = {
  buildConsoleAliases,
  buildConsoleGamesMap,
  createGlobalConsoleResult,
  createGlobalFranchiseResult,
  findConsoleInCatalog,
  getConsoleCatalogKey,
}
