'use strict'

const SELL_MIN_GAIN_RATIO = 1.5
const UPGRADE_MAX_DELTA = 20
const WISHLIST_AFFORDABLE_MAX = 25

/**
 * Résout l'état d'action canonique pour un item de collection.
 *
 * @param {object} item - item de collection (list_type, condition, price_paid, price_threshold)
 * @param {object} game - données du jeu (loosePrice, cibPrice, mintPrice)
 * @returns {{ action: string, note: string, tone: string }}
 *   action: 'sell' | 'upgrade' | 'buy' | 'hold' | 'none'
 */
function resolveCollectionAction(item, game) {
  if (!item || !game) return { action: 'none', note: '', tone: '' }

  const listType = String(item.list_type || '').toLowerCase()
  const owned = listType === 'owned' || listType === 'for_sale'
  const wanted = listType === 'wanted'
  const forSale = listType === 'for_sale' || item.for_sale === true
  const condition = String(item.condition || '').trim()
  const pricePaid = Number(item.price_paid || 0)
  const priceThreshold = item.price_threshold != null ? Number(item.price_threshold) : null
  const wishlistMax = priceThreshold != null ? priceThreshold : WISHLIST_AFFORDABLE_MAX

  const loosePrice = Number(game.loosePrice || game.loose_price || 0)
  const cibPrice = Number(game.cibPrice || game.cib_price || 0)

  const hasLoosePrice = loosePrice > 0
  const hasCibPrice = cibPrice > 0
  const cibDelta = hasLoosePrice && hasCibPrice ? cibPrice - loosePrice : null

  // Trust guard: sell, upgrade, buy cues require validated price data.
  // low/unknown confidence means insufficient sold signal — do not fire action cues.
  const priceTier = String(game.priceConfidenceTier || '').toLowerCase()
  const hasTrustForAction = priceTier === 'high' || priceTier === 'medium'

  // for_sale items always show sell regardless of price trust (user-declared intent)
  if (owned && forSale) {
    return {
      action: 'sell',
      note: 'Le jeu est marque a vendre.',
      tone: 'is-hot',
    }
  }

  // sell on gain signal — requires trust
  if (hasTrustForAction && owned && pricePaid > 0 && hasLoosePrice && loosePrice >= pricePaid * SELL_MIN_GAIN_RATIO) {
    return {
      action: 'sell',
      note: 'La valeur loose depasse le prix paye de 50% ou plus.',
      tone: 'is-hot',
    }
  }

  // upgrade signal — requires trust
  if (hasTrustForAction && owned && condition === 'Loose' && cibDelta != null && cibDelta <= UPGRADE_MAX_DELTA) {
    return {
      action: 'upgrade',
      note: 'Le delta Loose -> CIB reste sous $20.',
      tone: 'is-primary',
    }
  }

  // buy signal — requires trust
  if (hasTrustForAction && wanted && hasLoosePrice && loosePrice <= wishlistMax) {
    return {
      action: 'buy',
      note: `Wishlist active et valeur loose sous $${wishlistMax}.`,
      tone: 'is-hot',
    }
  }

  if (owned || wanted) {
    return {
      action: 'hold',
      note: 'Position conservee. Aucun signal fort detecte.',
      tone: '',
    }
  }

  return { action: 'none', note: '', tone: '' }
}

module.exports = { resolveCollectionAction, SELL_MIN_GAIN_RATIO, UPGRADE_MAX_DELTA, WISHLIST_AFFORDABLE_MAX }
