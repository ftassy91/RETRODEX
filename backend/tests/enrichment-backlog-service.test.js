'use strict'

const {
  computeBacklogScore,
  selectBacklogTargets,
} = require('../src/services/enrichment-backlog-service')

describe('enrichment-backlog-service', () => {
  test('published curated entries score above equivalent locked entries', () => {
    const published = {
      status: 'published',
      published: true,
      slotRank: 2,
      selectionScore: 80,
      missingRelevantSections: ['manuals', 'maps'],
      criticalErrors: [],
      reviewItems: [],
    }
    const locked = {
      ...published,
      status: 'locked',
      published: false,
      slotRank: null,
    }

    expect(computeBacklogScore(published)).toBeGreaterThan(computeBacklogScore(locked))
  })

  test('selection respects per-console and global limits', () => {
    const entries = [
      { gameId: 'a1', consoleId: 'nes', published: true, status: 'published', slotRank: 1, selectionScore: 90, missingRelevantSections: ['manuals'], criticalErrors: [], reviewItems: [], backlogScore: 90, title: 'A1' },
      { gameId: 'a2', consoleId: 'nes', published: true, status: 'published', slotRank: 2, selectionScore: 80, missingRelevantSections: ['maps'], criticalErrors: [], reviewItems: [], backlogScore: 80, title: 'A2' },
      { gameId: 'a3', consoleId: 'nes', published: true, status: 'published', slotRank: 3, selectionScore: 70, missingRelevantSections: ['sprites'], criticalErrors: [], reviewItems: [], backlogScore: 70, title: 'A3' },
      { gameId: 'b1', consoleId: 'snes', published: true, status: 'published', slotRank: 1, selectionScore: 85, missingRelevantSections: ['manuals'], criticalErrors: [], reviewItems: [], backlogScore: 85, title: 'B1' },
      { gameId: 'b2', consoleId: 'snes', published: true, status: 'published', slotRank: 2, selectionScore: 75, missingRelevantSections: ['maps'], criticalErrors: [], reviewItems: [], backlogScore: 75, title: 'B2' },
    ]

    const selected = selectBacklogTargets(entries, { perConsoleLimit: 2, globalLimit: 3 })

    expect(selected).toHaveLength(3)
    expect(selected.filter((entry) => entry.consoleId === 'nes')).toHaveLength(2)
    expect(selected.filter((entry) => entry.consoleId === 'snes')).toHaveLength(1)
  })
})
