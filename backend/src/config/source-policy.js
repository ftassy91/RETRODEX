'use strict'

const SOURCE_POLICY = {
  ebay: {
    name: 'eBay Developer APIs',
    status: 'approved',
    legalFeasibility: 1,
    sourceAvailability: 1,
  },
  pricecharting: {
    name: 'PriceCharting API',
    status: 'approved_with_review',
    legalFeasibility: 0.75,
    sourceAvailability: 0.8,
  },
  yahoo_auctions_jp: {
    name: 'Yahoo Auctions Japan',
    status: 'approved_with_review',
    legalFeasibility: 0.55,
    sourceAvailability: 0.8,
  },
  mercari_jp: {
    name: 'Mercari Japan',
    status: 'approved_with_review',
    legalFeasibility: 0.5,
    sourceAvailability: 0.78,
  },
  rakuma: {
    name: 'Rakuma',
    status: 'approved_with_review',
    legalFeasibility: 0.5,
    sourceAvailability: 0.72,
  },
  mercari_us: {
    name: 'Mercari US',
    status: 'approved_with_review',
    legalFeasibility: 0.5,
    sourceAvailability: 0.76,
  },
  shopgoodwill: {
    name: 'ShopGoodwill',
    status: 'approved_with_review',
    legalFeasibility: 0.65,
    sourceAvailability: 0.72,
  },
  heritage: {
    name: 'Heritage Auctions',
    status: 'approved_with_review',
    legalFeasibility: 0.7,
    sourceAvailability: 0.74,
  },
  catawiki: {
    name: 'Catawiki',
    status: 'approved_with_review',
    legalFeasibility: 0.62,
    sourceAvailability: 0.72,
  },
  collector_media_signal: {
    name: 'Collector media signal',
    status: 'reference_only',
    legalFeasibility: 0.45,
    sourceAvailability: 0.7,
  },
  igdb: {
    name: 'IGDB / Twitch',
    status: 'approved_with_review',
    legalFeasibility: 0.75,
    sourceAvailability: 0.85,
  },
  twitch: {
    name: 'IGDB / Twitch',
    status: 'approved_with_review',
    legalFeasibility: 0.75,
    sourceAvailability: 0.85,
  },
  internet_archive: {
    name: 'Internet Archive',
    status: 'reference_only',
    legalFeasibility: 0.5,
    sourceAvailability: 0.7,
  },
  youtube: {
    name: 'YouTube',
    status: 'reference_only',
    legalFeasibility: 0.5,
    sourceAvailability: 0.85,
  },
  vgmaps: {
    name: 'VGMaps',
    status: 'reference_only',
    legalFeasibility: 0.5,
    sourceAvailability: 0.75,
  },
  vgmuseum: {
    name: 'VGMuseum',
    status: 'reference_only',
    legalFeasibility: 0.5,
    sourceAvailability: 0.75,
  },
  pixel_warehouse: {
    name: 'Pixel Warehouse',
    status: 'approved_with_review',
    legalFeasibility: 0.8,
    sourceAvailability: 0.8,
  },
  wikidata: {
    name: 'Wikidata',
    status: 'approved',
    legalFeasibility: 1,
    sourceAvailability: 0.95,
  },
  musicbrainz: {
    name: 'MusicBrainz core datasets',
    status: 'approved_with_review',
    legalFeasibility: 0.85,
    sourceAvailability: 0.82,
  },
  musicbrainz_core: {
    name: 'MusicBrainz core datasets',
    status: 'approved_with_review',
    legalFeasibility: 0.85,
    sourceAvailability: 0.82,
  },
  strategywiki: {
    name: 'StrategyWiki',
    status: 'approved_with_review',
    legalFeasibility: 0.78,
    sourceAvailability: 0.74,
  },
  libretro: {
    name: 'libretro-database',
    status: 'reference_only',
    legalFeasibility: 0.6,
    sourceAvailability: 0.8,
  },
  libretro_database: {
    name: 'libretro-database',
    status: 'reference_only',
    legalFeasibility: 0.6,
    sourceAvailability: 0.8,
  },
  speedrun_com: {
    name: 'speedrun.com API',
    status: 'approved_with_review',
    legalFeasibility: 0.7,
    sourceAvailability: 0.9,
  },
  speedruncom: {
    name: 'speedrun.com API',
    status: 'approved_with_review',
    legalFeasibility: 0.7,
    sourceAvailability: 0.9,
  },
  retroachievements: {
    name: 'RetroAchievements API',
    status: 'approved_with_review',
    legalFeasibility: 0.7,
    sourceAvailability: 0.88,
  },
  internal: {
    name: 'RETRODEX internal',
    status: 'approved',
    legalFeasibility: 1,
    sourceAvailability: 1,
  },
  unknown: {
    name: 'Unknown source',
    status: 'blocked',
    legalFeasibility: 0,
    sourceAvailability: 0,
  },
}

function normalizeSourceKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function getSourcePolicy(value) {
  const key = normalizeSourceKey(value)
  return SOURCE_POLICY[key] || SOURCE_POLICY.unknown
}

module.exports = {
  SOURCE_POLICY,
  getSourcePolicy,
  normalizeSourceKey,
}
