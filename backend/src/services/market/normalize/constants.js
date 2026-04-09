'use strict'

const SUPPORTED_CURRENCIES = new Set(['EUR', 'USD', 'JPY'])
const PUBLISHABLE_CONDITIONS = new Set(['Loose', 'CIB', 'Mint'])
const REGION_CODES = new Set(['PAL', 'NTSC-U', 'NTSC-J', 'NTSC-B', 'MULTI', 'unknown'])
const SALE_TYPES = new Set(['auction', 'fixed_price_sold', 'realized_price'])

const DEFAULT_MARKET_FX_TO_EUR = Object.freeze({
  EUR: 1,
  USD: Number(process.env.MARKET_FX_USD_TO_EUR || 0),
  JPY: Number(process.env.MARKET_FX_JPY_TO_EUR || 0),
})

const REGION_ALIASES = Object.freeze({
  'pal': 'PAL',
  'europe': 'PAL',
  'euro': 'PAL',
  'uk': 'PAL',
  'fr': 'PAL',
  'de': 'PAL',
  'ntsc-u': 'NTSC-U',
  'ntsc u': 'NTSC-U',
  'north america': 'NTSC-U',
  'usa': 'NTSC-U',
  'us': 'NTSC-U',
  'na': 'NTSC-U',
  'ntsc-j': 'NTSC-J',
  'ntsc j': 'NTSC-J',
  'japan': 'NTSC-J',
  'japon': 'NTSC-J',
  'jp': 'NTSC-J',
  'ntsc-b': 'NTSC-B',
  'brazil': 'NTSC-B',
  'brasil': 'NTSC-B',
  'br': 'NTSC-B',
  'multi': 'MULTI',
  'multi region': 'MULTI',
  'worldwide': 'MULTI',
  'global': 'MULTI',
})

const PLATFORM_ALIASES = Object.freeze({
  'nes': 'Nintendo Entertainment System',
  'famicom': 'Nintendo Entertainment System',
  'nintendo entertainment system': 'Nintendo Entertainment System',
  'super famicom': 'Super Nintendo',
  'snes': 'Super Nintendo',
  'super nintendo': 'Super Nintendo',
  'nintendo 64': 'Nintendo 64',
  'n64': 'Nintendo 64',
  'game boy advance': 'Game Boy Advance',
  'gba': 'Game Boy Advance',
  'game boy color': 'Game Boy Color',
  'gbc': 'Game Boy Color',
  'game boy': 'Game Boy',
  'gb ': 'Game Boy',
  'playstation': 'PlayStation',
  'ps1': 'PlayStation',
  'psx': 'PlayStation',
})

const REJECTION_KEYWORDS = Object.freeze([
  'reproduction',
  'repro',
  'bootleg',
  'fan translation',
  'manual only',
  'strategy guide',
  'box only',
  'case only',
  'replacement case',
  'artbook only',
  'soundtrack only',
  'empty box',
  'download code',
  'console only',
])

const BUNDLE_KEYWORDS = Object.freeze([
  'bundle',
  'lot',
  'set of',
  'collection',
  'assorted',
])

module.exports = {
  BUNDLE_KEYWORDS,
  DEFAULT_MARKET_FX_TO_EUR,
  PLATFORM_ALIASES,
  PUBLISHABLE_CONDITIONS,
  REGION_ALIASES,
  REGION_CODES,
  REJECTION_KEYWORDS,
  SALE_TYPES,
  SUPPORTED_CURRENCIES,
}
