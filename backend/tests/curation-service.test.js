'use strict'

const {
  buildHeuristicContentProfile,
  buildValidationSummary,
  computeSelectionScore,
} = require('../src/services/admin/curation-service')

describe('curation-service', () => {
  test('marks narrative RPG domains as relevant when source signals exist', () => {
    const game = {
      id: 'chrono-trigger-snes',
      genre: 'JRPG',
      synopsis: 'A long-form time travel role-playing adventure with a strong story and ensemble cast.',
      characters: JSON.stringify([{ name: 'Crono' }]),
      ost_composers: JSON.stringify([{ name: 'Yasunori Mitsuda' }]),
      developer: 'Square',
      manual_url: 'https://example.com/manual.pdf',
    }

    const profile = buildHeuristicContentProfile(game, {
      media: {
        manual: { valid: 1 },
        map: { valid: 1 },
        sprite_sheet: { valid: 1 },
      },
    })

    expect(profile.overview).toBe(true)
    expect(profile.lore).toBe(true)
    expect(profile.characters).toBe(true)
    expect(profile.ost).toBe(true)
    expect(profile.manuals).toBe(true)
    expect(profile.maps).toBe(true)
    expect(profile.sprites).toBe(true)
    expect(profile.credits).toBe(true)
  })

  test('does not force lore or maps for sports/puzzle games without source signals', () => {
    const game = {
      id: 'tetris-game-boy',
      genre: 'Puzzle',
      synopsis: 'Stack falling blocks.',
      developer: 'Nintendo',
    }

    const profile = buildHeuristicContentProfile(game, {
      media: {
        map: { valid: 0 },
        manual: { valid: 0 },
        sprite_sheet: { valid: 0 },
      },
    })

    expect(profile.overview).toBe(true)
    expect(profile.lore).toBe(false)
    expect(profile.maps).toBe(false)
    expect(profile.screenshots).toBe(false)
  })

  test('validation counts only relevant domains and can reach lock threshold', () => {
    const game = {
      id: 'pokemon-blue-game-boy',
      summary: 'A landmark monster-catching RPG with strong exploration, progression, and a memorable world.',
      synopsis: 'A landmark monster-catching RPG with strong exploration, progression, and a memorable world.',
      lore: 'A landmark monster-catching RPG with strong exploration, progression, and a memorable world.',
      characters: JSON.stringify([{ name: 'Red' }]),
      ost_composers: JSON.stringify([{ name: 'Junichi Masuda' }]),
      developer: 'Game Freak',
      manual_url: 'https://example.com/manual.pdf',
    }

    const profile = {
      overview: true,
      lore: true,
      characters: true,
      maps: true,
      vehicles: false,
      ost: true,
      manuals: true,
      sprites: false,
      screenshots: false,
      codes: false,
      records: false,
      credits: true,
    }

    const validation = buildValidationSummary(game, {
      media: {
        map: { valid: 1, broken: 0 },
        manual: { valid: 1, broken: 0 },
      },
    }, profile)

    expect(validation.relevantExpected).toBe(7)
    expect(validation.relevantFilled).toBe(7)
    expect(validation.completionScore).toBe(1)
    expect(validation.canLock).toBe(true)
    expect(validation.criticalErrors).toEqual([])
  })

  test('selection score rewards completeness and quality', () => {
    const high = computeSelectionScore({
      metascore: 94,
      rarity: 'LEGENDARY',
      source_confidence: 0.9,
      quality: { overallScore: 88 },
    }, {
      completionScore: 1,
      domains: { maps: true, manuals: true, sprites: true, ost: true, characters: true },
    })

    const low = computeSelectionScore({
      metascore: 0,
      rarity: 'COMMON',
      source_confidence: 0.2,
      quality: { overallScore: 40 },
    }, {
      completionScore: 0.3,
      domains: { maps: false, manuals: false, sprites: false, ost: false, characters: false },
    })

    expect(high).toBeGreaterThan(low)
  })
})
