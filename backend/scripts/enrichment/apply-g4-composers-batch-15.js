#!/usr/bin/env node
'use strict'

const { runComposerBatch } = require('./_composer-batch-common')

const G4_BATCH = [
  {
    gameId: 'darkwing-duck-game-boy',
    title: 'Darkwing Duck',
    ostComposers: [
      { name: 'Yasuaki Fujita', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Darkwing_Duck_(Capcom_video_game)',
    notes: 'Composer curated from Darkwing Duck reference credits covering NES and Game Boy releases',
  },
  {
    gameId: 'darkwing-duck-nintendo-entertainment-system',
    title: 'Darkwing Duck',
    ostComposers: [
      { name: 'Yasuaki Fujita', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Darkwing_Duck_(Capcom_video_game)',
    notes: 'Composer curated from Darkwing Duck reference credits covering NES and Game Boy releases',
  },
  {
    gameId: 'duck-tales-nintendo-entertainment-system',
    title: 'DuckTales',
    ostComposers: [
      { name: 'Hiroshige Tonomura', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/DuckTales_(video_game)',
    notes: 'Composer curated from DuckTales reference credits',
  },
  {
    gameId: 'gargoyles-quest-game-boy',
    title: "Gargoyle's Quest",
    ostComposers: [
      { name: 'Harumi Fujita', role: 'composer' },
      { name: 'Yoko Shimomura', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Gargoyle%27s_Quest',
    notes: 'Composer curated from Gargoyles Quest reference credits',
  },
  {
    gameId: 'life-force-nintendo-entertainment-system',
    title: 'Life Force',
    ostComposers: [
      { name: 'Miki Higashino', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'composer_biography',
    sourceUrl: 'https://en.wikipedia.org/wiki/Miki_Higashino',
    notes: 'Composer curated from Miki Higashino biography listing Life Force in her early Konami works',
  },
  {
    gameId: 'ninja-gaiden-nintendo-entertainment-system',
    title: 'Ninja Gaiden',
    ostComposers: [
      { name: 'Keiji Yamagishi', role: 'composer' },
      { name: 'Ryuichi Nitta', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Ninja_Gaiden_(NES_video_game)',
    notes: 'Composer curated from Ninja Gaiden NES reference credits',
  },
  {
    gameId: 'tecmo-bowl-nintendo-entertainment-system',
    title: 'Tecmo Bowl',
    ostComposers: [
      { name: 'Keiji Yamagishi', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Tecmo_Bowl',
    notes: 'Composer curated from Tecmo Bowl reference credits',
  },
  {
    gameId: 'american-gladiators-sega-genesis',
    title: 'American Gladiators',
    ostComposers: [
      { name: 'Leif Marwede', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/American_Gladiators_(video_game)',
    notes: 'Composer curated from American Gladiators reference credits shared across console ports',
  },
  {
    gameId: 'american-gladiators-super-nintendo',
    title: 'American Gladiators',
    ostComposers: [
      { name: 'Leif Marwede', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/American_Gladiators_(video_game)',
    notes: 'Composer curated from American Gladiators reference credits shared across console ports',
  },
  {
    gameId: 'batman-the-animated-series-super-nintendo',
    title: 'Batman: The Animated Series',
    ostComposers: [
      { name: 'Yoshiyuki Hagiwara', role: 'composer' },
      { name: 'Akihiro Juichiya', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Batman:_The_Animated_Series_(video_game)',
    notes: 'Composer curated from Batman: The Animated Series reference credits covering the SNES and Game Boy releases',
  },
]

runComposerBatch({
  batchKey: 'g4_composers_batch_15',
  notes: 'G4 composers batch 15 applied locally on staging sqlite',
  payload: G4_BATCH,
})
