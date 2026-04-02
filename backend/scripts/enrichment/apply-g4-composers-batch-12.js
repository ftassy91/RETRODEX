#!/usr/bin/env node
'use strict'

const { runComposerBatch } = require('./_composer-batch-common')

const G4_BATCH = [
  {
    gameId: 'again-nintendo-ds',
    title: 'Again',
    ostComposers: [
      { name: 'Naoyuki Yoneda', role: 'composer' },
      { name: 'Tatsuya Fujiwara', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Again_(video_game)',
    notes: 'Composer curated from Again DS reference credits',
  },
  {
    gameId: 'batman-revenge-of-the-joker-sega-genesis',
    title: 'Batman: Revenge of the Joker',
    ostComposers: [
      { name: 'Tommy Tallarico', role: 'composer' },
    ],
    sourceName: 'vgmdb',
    sourceType: 'soundtrack_reference',
    sourceUrl: 'https://vgmdb.net/release/18498',
    notes: 'Composer curated from Batman: Revenge of the Joker Mega Drive soundtrack reference',
  },
  {
    gameId: 'batman-the-animated-series-game-boy',
    title: 'Batman: The Animated Series',
    ostComposers: [
      { name: 'Yoshiyuki Hagiwara', role: 'composer' },
      { name: 'Akihiro Juichiya', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Batman:_The_Animated_Series_(video_game)',
    notes: 'Composer curated from Batman: The Animated Series Game Boy reference credits',
  },
  {
    gameId: 'batman-the-video-game-game-boy',
    title: 'Batman: The Video Game',
    ostComposers: [
      { name: 'Naoki Kodaka', role: 'composer' },
      { name: 'Nobuyuki Hara', role: 'composer' },
      { name: 'Shinichi Seya', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Batman:_The_Video_Game_(Game_Boy_video_game)',
    notes: 'Composer curated from Batman: The Video Game Game Boy reference credits',
  },
  {
    gameId: 'pokemon-crystal-game-boy',
    title: 'Pokemon Crystal',
    ostComposers: [
      { name: 'Go Ichinose', role: 'composer' },
      { name: 'Junichi Masuda', role: 'composer' },
      { name: 'Morikazu Aoki', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Pok%C3%A9mon_Crystal',
    notes: 'Composer curated from Pokemon Crystal reference credits',
  },
  {
    gameId: 'azure-dreams-game-boy-color',
    title: 'Azure Dreams',
    ostComposers: [
      { name: 'Hiroshi Tamawari', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Azure_Dreams',
    notes: 'Composer curated from Azure Dreams reference covering PlayStation and Game Boy Color releases',
  },
  {
    gameId: 'thunder-force-iv-sega-genesis',
    title: 'Thunder Force IV',
    ostComposers: [
      { name: 'Naosuke Arai', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'development_reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Thunder_Force_IV',
    notes: 'Composer curated from Thunder Force IV development notes citing sound team leadership by Naosuke Arai',
  },
  {
    gameId: 'air-combat-playstation',
    title: 'Air Combat',
    ostComposers: [
      { name: 'Nobuhide Isayama', role: 'composer' },
      { name: 'Masako Oogami', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Air_Combat',
    notes: 'Composer curated from Air Combat PlayStation reference credits',
  },
  {
    gameId: 'rampage-atari-lynx',
    title: 'Rampage',
    ostComposers: [
      { name: 'Michael Bartlow', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Rampage_(video_game)',
    notes: 'Composer curated from Rampage reference credits covering the original game and Atari Lynx port family',
  },
  {
    gameId: 'addams-family-values-super-nintendo',
    title: 'Addams Family Values',
    ostComposers: [
      { name: 'Keith Tinman', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Addams_Family_Values_(video_game)',
    notes: 'Composer curated from Addams Family Values reference credits for the Super NES and Mega Drive release set',
  },
]

runComposerBatch({
  batchKey: 'g4_composers_batch_12',
  notes: 'G4 composers batch 12 applied locally on staging sqlite',
  payload: G4_BATCH,
})
