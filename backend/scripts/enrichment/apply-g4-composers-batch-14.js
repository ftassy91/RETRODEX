#!/usr/bin/env node
'use strict'

const { runComposerBatch } = require('./_composer-batch-common')

const G4_BATCH = [
  {
    gameId: 'contact-nintendo-ds',
    title: 'Contact',
    ostComposers: [
      { name: 'Masafumi Takada', role: 'composer' },
      { name: 'Jun Fukuda', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Contact_(video_game)',
    notes: 'Composer curated from Contact DS reference credits',
  },
  {
    gameId: 'diablo-playstation',
    title: 'Diablo',
    ostComposers: [
      { name: 'Matt Uelmen', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Diablo_(video_game)',
    notes: 'Composer curated from Diablo reference credits covering the PlayStation port',
  },
  {
    gameId: 'house-of-the-dead-sega-saturn',
    title: 'The House of the Dead',
    ostComposers: [
      { name: 'Tetsuya Kawauchi', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/The_House_of_the_Dead_(video_game)',
    notes: 'Composer curated from The House of the Dead reference credits covering the Saturn port',
  },
  {
    gameId: 'legend-of-dragoon-playstation',
    title: 'The Legend of Dragoon',
    ostComposers: [
      { name: 'Dennis Martin', role: 'composer' },
      { name: 'Takeo Miratsu', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/The_Legend_of_Dragoon',
    notes: 'Composer curated from The Legend of Dragoon reference credits',
  },
  {
    gameId: 'legend-of-mana-playstation',
    title: 'Legend of Mana',
    ostComposers: [
      { name: 'Yoko Shimomura', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Legend_of_Mana',
    notes: 'Composer curated from Legend of Mana reference credits',
  },
  {
    gameId: 'phantasy-star-iv-sega-genesis',
    title: 'Phantasy Star IV',
    ostComposers: [
      { name: 'Izuho Takeuchi', role: 'composer' },
      { name: 'Masaki Nakagaki', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Phantasy_Star_IV',
    notes: 'Composer curated from Phantasy Star IV reference credits',
  },
  {
    gameId: 'rayman-playstation',
    title: 'Rayman',
    ostComposers: [
      { name: 'Remi Gazel', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Rayman_(video_game)',
    notes: 'Composer curated from Rayman original soundtrack credits',
  },
  {
    gameId: 'shining-wisdom-sega-saturn',
    title: 'Shining Wisdom',
    ostComposers: [
      { name: 'Motoaki Takenouchi', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://pt.wikipedia.org/wiki/Shining_Wisdom',
    notes: 'Composer curated from Shining Wisdom reference credits',
  },
  {
    gameId: 'tales-of-phantasia-super-nintendo',
    title: 'Tales of Phantasia',
    ostComposers: [
      { name: 'Motoi Sakuraba', role: 'composer' },
      { name: 'Shinji Tamura', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Tales_of_Phantasia',
    notes: 'Composer curated from Tales of Phantasia reference credits',
  },
  {
    gameId: 'wild-arms-playstation',
    title: 'Wild Arms',
    ostComposers: [
      { name: 'Michiko Naruke', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Wild_Arms_(video_game)',
    notes: 'Composer curated from Wild Arms reference credits',
  },
]

runComposerBatch({
  batchKey: 'g4_composers_batch_14',
  notes: 'G4 composers batch 14 applied locally on staging sqlite',
  payload: G4_BATCH,
})
