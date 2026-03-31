'use strict'
// DATA: Sequelize via ../../../models - admin/back-office only

const Game = require('../../../models/Game')
const { getSelectableGameAttributes } = require('../game-read-service')
const {
  loadEditorialMap,
  loadMarketSnapshotMap,
  loadCanonicalMediaMap,
} = require('./reads')

function normalizeTextCompare(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function normalizePriceCompare(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }

  return Math.round(numeric * 100) / 100
}

function classifyTextDivergence(legacyValue, canonicalValue) {
  const legacy = normalizeTextCompare(legacyValue)
  const canonical = normalizeTextCompare(canonicalValue)

  if (!legacy && !canonical) return 'both_missing'
  if (legacy && !canonical) return 'legacy_only'
  if (!legacy && canonical) return 'canonical_only'
  return legacy === canonical ? 'match' : 'mismatch'
}

function classifyPriceDivergence(legacyValue, canonicalValue) {
  const legacy = normalizePriceCompare(legacyValue)
  const canonical = normalizePriceCompare(canonicalValue)

  if (legacy == null && canonical == null) return 'both_missing'
  if (legacy != null && canonical == null) return 'legacy_only'
  if (legacy == null && canonical != null) return 'canonical_only'
  return legacy === canonical ? 'match' : 'mismatch'
}

async function getLegacyCanonicalDivergenceReport({ limit = 250 } = {}) {
  const divergenceAttributes = await getSelectableGameAttributes([
    'id',
    'title',
    'console',
    'year',
    'summary',
    'synopsis',
    'cover_url',
    'coverImage',
    'loosePrice',
    'cibPrice',
    'mintPrice',
  ])

  const [games, editorialMap, snapshotMap, mediaMap] = await Promise.all([
    Game.findAll({
      where: { type: 'game' },
      attributes: divergenceAttributes,
      order: [['title', 'ASC']],
    }),
    loadEditorialMap(),
    loadMarketSnapshotMap(),
    loadCanonicalMediaMap(),
  ])

  const summary = {
    totalGames: 0,
    comparedPrices: 0,
    comparedEditorial: 0,
    comparedCovers: 0,
    priceMismatchCount: 0,
    editorialMismatchCount: 0,
    coverMismatchCount: 0,
    legacyOnlyPriceCount: 0,
    canonicalOnlyPriceCount: 0,
    legacyOnlyEditorialCount: 0,
    canonicalOnlyEditorialCount: 0,
    legacyOnlyCoverCount: 0,
    canonicalOnlyCoverCount: 0,
  }
  const items = []

  for (const record of games) {
    const game = record.get({ plain: true })
    const editorial = editorialMap.get(String(game.id)) || {}
    const snapshot = snapshotMap.get(String(game.id)) || {}
    const media = mediaMap.get(String(game.id)) || {}

    const summaryState = classifyTextDivergence(game.summary, editorial.summary)
    const synopsisState = classifyTextDivergence(game.synopsis, editorial.synopsis || editorial.lore)
    const coverState = classifyTextDivergence(game.cover_url || game.coverImage, media.cover)
    const looseState = classifyPriceDivergence(game.loosePrice, snapshot.loosePrice)
    const cibState = classifyPriceDivergence(game.cibPrice, snapshot.cibPrice)
    const mintState = classifyPriceDivergence(game.mintPrice, snapshot.mintPrice)
    const priceStates = [looseState, cibState, mintState]

    summary.totalGames += 1
    if (priceStates.some((state) => state !== 'both_missing')) summary.comparedPrices += 1
    if ([summaryState, synopsisState].some((state) => state !== 'both_missing')) summary.comparedEditorial += 1
    if (coverState !== 'both_missing') summary.comparedCovers += 1

    const priceMismatch = priceStates.includes('mismatch')
    const editorialMismatch = summaryState === 'mismatch' || synopsisState === 'mismatch'
    const coverMismatch = coverState === 'mismatch'

    if (priceMismatch) summary.priceMismatchCount += 1
    if (editorialMismatch) summary.editorialMismatchCount += 1
    if (coverMismatch) summary.coverMismatchCount += 1

    if (priceStates.includes('legacy_only')) summary.legacyOnlyPriceCount += 1
    if (priceStates.includes('canonical_only')) summary.canonicalOnlyPriceCount += 1
    if (summaryState === 'legacy_only' || synopsisState === 'legacy_only') summary.legacyOnlyEditorialCount += 1
    if (summaryState === 'canonical_only' || synopsisState === 'canonical_only') summary.canonicalOnlyEditorialCount += 1
    if (coverState === 'legacy_only') summary.legacyOnlyCoverCount += 1
    if (coverState === 'canonical_only') summary.canonicalOnlyCoverCount += 1

    const hasCoverageGap = [
      summaryState,
      synopsisState,
      coverState,
      ...priceStates,
    ].some((state) => state !== 'match' && state !== 'both_missing')

    if (!hasCoverageGap) {
      continue
    }

    items.push({
      id: game.id,
      title: game.title,
      console: game.console,
      year: game.year,
      price: {
        loose: {
          legacy: normalizePriceCompare(game.loosePrice),
          canonical: normalizePriceCompare(snapshot.loosePrice),
          status: looseState,
        },
        cib: {
          legacy: normalizePriceCompare(game.cibPrice),
          canonical: normalizePriceCompare(snapshot.cibPrice),
          status: cibState,
        },
        mint: {
          legacy: normalizePriceCompare(game.mintPrice),
          canonical: normalizePriceCompare(snapshot.mintPrice),
          status: mintState,
        },
      },
      editorial: {
        summary: {
          legacy: game.summary || null,
          canonical: editorial.summary || null,
          status: summaryState,
        },
        synopsis: {
          legacy: game.synopsis || null,
          canonical: editorial.synopsis || editorial.lore || null,
          status: synopsisState,
        },
      },
      assets: {
        cover: {
          legacy: game.cover_url || game.coverImage || null,
          canonical: media.cover || null,
          status: coverState,
        },
      },
    })
  }

  return {
    summary,
    items: items.slice(0, limit),
  }
}

module.exports = {
  normalizeTextCompare,
  normalizePriceCompare,
  classifyTextDivergence,
  classifyPriceDivergence,
  getLegacyCanonicalDivergenceReport,
}
