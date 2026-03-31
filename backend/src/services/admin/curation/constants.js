'use strict'

const PASS1_KEY = 'pass1-premium-encyclopedic'
const PROFILE_VERSION = 'pass1-heuristic-v1'
const CONTENT_VERSION = 'pass1-content-v1'
const LOCK_THRESHOLD = 0.9
const TARGET_MIN_PER_CONSOLE = 10
const TARGET_MAX_PER_CONSOLE = 20

const PROFILE_KEYS = [
  'overview',
  'lore',
  'characters',
  'maps',
  'vehicles',
  'ost',
  'manuals',
  'sprites',
  'screenshots',
  'codes',
  'records',
  'credits',
]

const NARRATIVE_GENRES = ['rpg', 'role-playing', 'jrpg', 'adventure', 'action adventure', 'metroidvania', 'visual novel']
const CHARACTER_GENRES = ['rpg', 'role-playing', 'fighting', 'beat', 'adventure', 'platform', 'tactical']
const VEHICLE_GENRES = ['racing', 'driving', 'flight', 'vehicular', 'vehicle', 'f1', 'combat flight']
const LOW_LORE_GENRES = ['sports', 'puzzle', 'board', 'card', 'trivia', 'party', 'quiz']
const LOW_OST_GENRES = ['sports', 'board', 'card', 'quiz']

module.exports = {
  PASS1_KEY,
  PROFILE_VERSION,
  CONTENT_VERSION,
  LOCK_THRESHOLD,
  TARGET_MIN_PER_CONSOLE,
  TARGET_MAX_PER_CONSOLE,
  PROFILE_KEYS,
  NARRATIVE_GENRES,
  CHARACTER_GENRES,
  VEHICLE_GENRES,
  LOW_LORE_GENRES,
  LOW_OST_GENRES,
}
