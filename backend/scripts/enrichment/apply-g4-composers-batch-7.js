#!/usr/bin/env node
'use strict'

const { runComposerBatch } = require('./_composer-batch-common')

const G4_BATCH = [
  {
    gameId: 'phoenix-wright-ace-attorney-nintendo-ds',
    title: 'Phoenix Wright: Ace Attorney',
    ostComposers: [{ name: 'Masakazu Sugimori', role: 'composer' }],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Phoenix_Wright:_Ace_Attorney',
    notes: 'Composer curated from Phoenix Wright: Ace Attorney reference credits',
  },
  {
    gameId: 'castlevania-nintendo-entertainment-system',
    title: 'Castlevania',
    ostComposers: [
      { name: 'Kinuyo Yamashita', role: 'composer' },
      { name: 'Satoe Terashima', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Castlevania',
    notes: 'Composer curated from Castlevania reference credits',
  },
  {
    gameId: 'mega-man-4-nintendo-entertainment-system',
    title: 'Mega Man 4',
    ostComposers: [
      { name: 'Minae Fujii', role: 'composer' },
      { name: 'Yasuaki Fujita', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Mega_Man_4',
    notes: 'Composer curated from Mega Man 4 reference credits',
  },
  {
    gameId: 'mega-man-7-super-nintendo',
    title: 'Mega Man 7',
    ostComposers: [
      { name: 'Toshihiko Horiyama', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Mega_Man_7',
    notes: 'Composer curated from Mega Man 7 reference credits',
  },
  {
    gameId: 'metroid-nintendo-entertainment-system',
    title: 'Metroid',
    ostComposers: [
      { name: 'Hirokazu Tanaka', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Metroid',
    notes: 'Composer curated from Metroid reference credits',
  },
  {
    gameId: 'street-fighter-ii-super-nintendo',
    title: 'Street Fighter II',
    ostComposers: [
      { name: 'Yoko Shimomura', role: 'composer' },
      { name: 'Isao Abe', role: 'composer' },
      { name: 'Syun Nishigaki', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Street_Fighter_II',
    notes: 'Composer curated from Street Fighter II reference credits',
  },
  {
    gameId: 'pokemon-emerald-game-boy-advance',
    title: 'Pokemon Emerald',
    ostComposers: [
      { name: 'Junichi Masuda', role: 'composer' },
      { name: 'Go Ichinose', role: 'composer' },
      { name: 'Morikazu Aoki', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Pok%C3%A9mon_Emerald',
    notes: 'Composer curated from Pokemon Emerald reference credits',
  },
  {
    gameId: 'pokemon-diamond-nintendo-ds',
    title: 'Pokemon Diamond',
    ostComposers: [
      { name: 'Hitomi Sato', role: 'composer' },
      { name: 'Junichi Masuda', role: 'composer' },
      { name: 'Go Ichinose', role: 'composer' },
      { name: 'Morikazu Aoki', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Pok%C3%A9mon_Diamond_and_Pearl',
    notes: 'Composer curated from Pokemon Diamond and Pearl reference credits',
  },
  {
    gameId: 'pokemon-silver-game-boy',
    title: 'Pokemon Silver',
    ostComposers: [
      { name: 'Junichi Masuda', role: 'composer' },
      { name: 'Morikazu Aoki', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Pok%C3%A9mon_Gold_and_Silver',
    notes: 'Composer curated from Pokemon Gold and Silver reference credits',
  },
  {
    gameId: 'tetris-game-boy',
    title: 'Tetris',
    ostComposers: [
      { name: 'Hirokazu Tanaka', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Tetris_(Game_Boy_video_game)',
    notes: 'Composer curated from Tetris Game Boy reference credits',
  },
]

runComposerBatch({
  batchKey: 'g4_composers_batch_7',
  notes: 'G4 composers batch 7 applied locally on staging sqlite',
  payload: G4_BATCH,
})
