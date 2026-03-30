'use strict'

const { buildGameDetailDataLayer } = require('../src/helpers/game-detail-data-layer')

describe('game-detail-data-layer', () => {
  test('builds ordered tabs from canonical profile and hides empty domains', () => {
    const payload = buildGameDetailDataLayer({
      game: {
        id: 'pokemon-blue-game-boy',
        title: 'Pokemon Blue',
        console: 'Game Boy',
        year: 1996,
        genre: 'JRPG',
        rarity: 'COMMON',
        developer: 'Game Freak',
        summary: 'A substantive role-playing adventure with exploration, battles, and progression across Kanto.',
        synopsis: 'A substantive role-playing adventure with exploration, battles, and progression across Kanto.',
        cover_url: 'https://example.com/cover.jpg',
      },
      archive: {
        media: {
          covers: [{ mediaType: 'cover', url: 'https://example.com/cover.jpg', uiAllowed: true }],
          manuals: [{ mediaType: 'manual', url: 'https://example.com/manual.pdf', uiAllowed: true }],
          maps: [{ mediaType: 'map', url: 'https://example.com/map.png', uiAllowed: true }],
        },
        lore: 'A long-form lore block that clears the minimum threshold for the Lore tab by a wide margin.',
        ost: {
          composers: [{ name: 'Junichi Masuda', role: 'Composer' }],
          notable_tracks: [{ title: 'Opening' }],
          releases: [],
        },
        production: {
          companies: [{ name: 'Game Freak', roleLabel: 'Developpement', role: 'developer' }],
          dev_team: [{ name: 'Satoshi Tajiri', role: 'Director' }],
        },
      },
      encyclopedia: {
        summary: 'A substantive role-playing adventure with exploration, battles, and progression across Kanto.',
        synopsis: 'A substantive role-playing adventure with exploration, battles, and progression across Kanto.',
        lore: 'A long-form lore block that clears the minimum threshold for the Lore tab by a wide margin.',
        characters: [{ name: 'Red', role: 'Trainer' }],
        cheat_codes: [],
        dev_anecdotes: [],
        dev_team: [{ name: 'Satoshi Tajiri', role: 'Director' }],
        ost_composers: [{ name: 'Junichi Masuda', role: 'Composer' }],
      },
      storedProfile: {
        content_profile_json: {
          overview: true,
          lore: true,
          characters: true,
          maps: true,
          ost: true,
          manuals: true,
          sprites: false,
          codes: false,
          records: false,
          credits: true,
        },
        profile_version: 'pass1-heuristic-v1',
        profile_mode: 'heuristic',
      },
    })

    expect(payload.ok).toBe(true)
    expect(payload.content_profile.overview).toBe(true)
    expect(payload.content_profile.manuals).toBe(true)
    expect(payload.content_profile.maps).toBe(true)
    expect(payload.content_profile.sprites).toBe(false)
    expect(payload.tabs.map((tab) => tab.id)).toEqual([
      'overview',
      'lore',
      'characters',
      'dev-team',
      'ost',
      'manuals',
      'maps',
      'development',
    ])
  })

  test('keeps overview only for sparse games and drops broken media', () => {
    const payload = buildGameDetailDataLayer({
      game: {
        id: '1-vs-100-nintendo-ds',
        title: '1 vs 100',
        console: 'Nintendo DS',
        year: 2008,
        developer: 'Nintendo',
      },
      archive: {
        media: {
          maps: [{ mediaType: 'map', url: 'https://example.com/broken-map.png', uiAllowed: true, healthcheckStatus: 'broken' }],
        },
        production: { companies: [], dev_team: [] },
      },
      encyclopedia: {},
      storedProfile: {
        content_profile_json: {
          overview: true,
          lore: false,
          characters: false,
          maps: true,
          ost: false,
          manuals: false,
          sprites: false,
          codes: false,
          records: false,
          credits: false,
        },
      },
    })

    expect(payload.tabs).toHaveLength(1)
    expect(payload.tabs[0].id).toBe('overview')
    expect(payload.content_profile.synopsis).toBe(false)
    expect(payload.content.maps).toEqual([])
    expect(payload.content_profile.maps).toBe(false)
  })
})
