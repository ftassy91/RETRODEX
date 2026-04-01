'use strict'
// DATA: pure admin enrichment rules, no direct DB access

const PREMIUM_RULESET_VERSION = 'premium-top100-v1'

const BLOCK_WEIGHTS = Object.freeze({
  identity: 25,
  editorial: 25,
  credits: 20,
  media: 20,
  music: 10,
})

const CORE_IDENTITY_KEYS = Object.freeze([
  'title',
  'console',
  'release',
  'cover',
  'editorial_seed',
  'studio_seed',
])

const EDITORIAL_KEYS = Object.freeze([
  'summary',
  'synopsis',
  'lore',
  'characters',
])

const CREDIT_ROLE_KEYS = Object.freeze([
  'developer',
  'publisher',
  'distributor',
  'soundtrack_label',
  'director',
  'composer',
  'writer',
  'producer',
  'designer',
  'programmer',
])

const MEDIA_SIGNAL_KEYS = Object.freeze([
  'manual',
  'map',
  'sprite_sheet',
  'ending',
  'archive_item',
  'youtube_video',
  'screenshot',
  'scan',
])

const MUSIC_SIGNAL_KEYS = Object.freeze([
  'composers',
  'tracks',
])

const TIER_THRESHOLDS = Object.freeze({
  gold: 85,
  silver: 70,
  bronze: 55,
  top100Candidate: 60,
})

function normalizeRoleSignal(rawValue) {
  const value = String(rawValue || '')
    .trim()
    .toLowerCase()

  if (!value) {
    return null
  }

  if (value.includes('soundtrack') || value.includes('record label') || value.includes('label')) {
    return 'soundtrack_label'
  }
  if (value.includes('distributor') || value.includes('distribution')) {
    return 'distributor'
  }
  if (value.includes('publisher') || value.includes('publishing')) {
    return 'publisher'
  }
  if (value.includes('developer') || value.includes('development')) {
    return 'developer'
  }
  if (value.includes('director')) {
    return 'director'
  }
  if (value.includes('composer') || value.includes('music') || value.includes('sound')) {
    return 'composer'
  }
  if (value.includes('writer') || value.includes('scenario') || value.includes('script')) {
    return 'writer'
  }
  if (value.includes('producer')) {
    return 'producer'
  }
  if (value.includes('designer') || value.includes('design')) {
    return 'designer'
  }
  if (value.includes('programmer') || value.includes('engineer') || value.includes('coder')) {
    return 'programmer'
  }

  return null
}

function normalizeMediaSignal(rawValue) {
  const value = String(rawValue || '')
    .trim()
    .toLowerCase()

  switch (value) {
    case 'manual':
      return 'manual'
    case 'map':
      return 'map'
    case 'sprite_sheet':
      return 'sprite_sheet'
    case 'ending':
      return 'ending'
    case 'archive_item':
      return 'archive_item'
    case 'youtube_video':
      return 'youtube_video'
    case 'screenshot':
      return 'screenshot'
    case 'scan':
      return 'scan'
    default:
      return null
  }
}

module.exports = {
  PREMIUM_RULESET_VERSION,
  BLOCK_WEIGHTS,
  CORE_IDENTITY_KEYS,
  EDITORIAL_KEYS,
  CREDIT_ROLE_KEYS,
  MEDIA_SIGNAL_KEYS,
  MUSIC_SIGNAL_KEYS,
  TIER_THRESHOLDS,
  normalizeRoleSignal,
  normalizeMediaSignal,
}
