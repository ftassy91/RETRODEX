'use strict'

const { listCollectionItems } = require('./storage')
const { UPGRADE_MAX_DELTA, SELL_MIN_GAIN_RATIO, WISHLIST_AFFORDABLE_MAX } = require('./action-resolver')

async function getCollectionCockpit(options = {}) {
  const [owned, wanted] = await Promise.all([
    listCollectionItems({ ...options, listType: 'owned' }),
    listCollectionItems({ ...options, listType: 'wanted' }),
  ])

  // — Doublons : même game_id apparaît plus d'une fois
  const gameIdCount = new Map()
  for (const item of owned) {
    const gid = String(item.game?.id || item.gameId || '')
    if (!gid) continue
    gameIdCount.set(gid, (gameIdCount.get(gid) || 0) + 1)
  }
  const duplicates = owned.filter((item) => {
    const gid = String(item.game?.id || item.gameId || '')
    return gid && (gameIdCount.get(gid) || 0) > 1
  })

  // — Candidats à vendre : plus-value >= 50% vs prix d'achat
  const sellCandidates = owned.filter((item) => {
    if (item.list_type === 'for_sale' || item.for_sale === true) return true
    const paid = Number(item.price_paid || 0)
    const loose = Number(item.game?.loosePrice || 0)
    return paid > 0 && loose > 0 && loose >= paid * SELL_MIN_GAIN_RATIO
  })

  // — Candidats à upgrader : possédé Loose, delta CIB <= $20
  const upgradeCandidates = owned.filter((item) => {
    const cond = String(item.condition || '').toLowerCase()
    if (cond !== 'loose') return false
    const loose = Number(item.game?.loosePrice || 0)
    const cib = Number(item.game?.cibPrice || 0)
    return cib > 0 && loose > 0 && (cib - loose) <= UPGRADE_MAX_DELTA
  })

  // — Entrées incomplètes : pas de prix d'achat renseigné
  const incomplete = owned.filter((item) => {
    return !item.price_paid && item.price_paid !== 0
  })

  // — Wishlist finançable : prix loose <= $25
  const affordableWishlist = wanted.filter((item) => {
    const loose = Number(item.game?.loosePrice || 0)
    const threshold = item.price_threshold != null ? Number(item.price_threshold) : WISHLIST_AFFORDABLE_MAX
    return loose > 0 && loose <= threshold
  })

  return {
    duplicates: { count: duplicates.length, items: duplicates.map(toSignalItem) },
    sell_candidates: { count: sellCandidates.length, items: sellCandidates.map(toSignalItem) },
    upgrade_candidates: { count: upgradeCandidates.length, items: upgradeCandidates.map(toSignalItem) },
    incomplete: { count: incomplete.length, items: incomplete.map(toSignalItem) },
    affordable_wishlist: { count: affordableWishlist.length, items: affordableWishlist.map(toSignalItem) },
  }
}

function toSignalItem(item) {
  const game = item.game || {}
  return {
    id: item.id || item.gameId,
    gameId: game.id || item.gameId,
    title: game.title || '?',
    console: game.console || game.platform || null,
    condition: item.condition || null,
    price_paid: item.price_paid ?? null,
    price_threshold: item.price_threshold ?? null,
    loosePrice: Number(game.loosePrice || 0) || null,
    cibPrice: Number(game.cibPrice || 0) || null,
    mintPrice: Number(game.mintPrice || 0) || null,
  }
}

module.exports = { getCollectionCockpit }
