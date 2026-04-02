#!/usr/bin/env node
'use strict'

const { runComposerBatch } = require('./_composer-batch-common')

const G4_BATCH = [
  {
    gameId: 'castlevania-legacy-of-darkness-nintendo-64',
    title: 'Castlevania: Legacy of Darkness',
    ostComposers: [
      { name: 'Masahiko Kimura', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Castlevania:_Legacy_of_Darkness',
    notes: 'Composer curated from Castlevania: Legacy of Darkness reference credits',
  },
  {
    gameId: 'ice-climber-nintendo-entertainment-system',
    title: 'Ice Climber',
    ostComposers: [
      { name: 'Akito Nakatsuka', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Ice_Climber',
    notes: 'Composer curated from Ice Climber reference credits',
  },
  {
    gameId: 'yoshis-island-ds-nintendo-ds',
    title: "Yoshi's Island DS",
    ostComposers: [
      { name: 'Yutaka Minobe', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Yoshi%27s_Island_DS',
    notes: 'Composer curated from Yoshi\'s Island DS reference credits',
  },
  {
    gameId: 'knights-in-the-nightmare-nintendo-ds',
    title: 'Knights in the Nightmare',
    ostComposers: [
      { name: 'Shigeki Hayashi', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Knights_in_the_Nightmare',
    notes: 'Composer curated from Knights in the Nightmare reference credits',
  },
  {
    gameId: 'the-lion-king-super-nintendo',
    title: 'The Lion King',
    ostComposers: [
      { name: 'Patrick J. Collins', role: 'composer' },
    ],
    sourceName: 'gamefaqs',
    sourceType: 'credits',
    sourceUrl: 'https://gamefaqs.gamespot.com/snes/588444-the-lion-king/credit',
    notes: 'Composer curated from The Lion King SNES credits',
  },
  {
    gameId: 'super-smash-bros-nintendo-64',
    title: 'Super Smash Bros.',
    ostComposers: [
      { name: 'Hirokazu Ando', role: 'composer' },
    ],
    sourceName: 'smashwiki',
    sourceType: 'credits',
    sourceUrl: 'https://zeldawiki.wiki/wiki/Super_Smash_Bros./Credits',
    notes: 'Composer curated from Super Smash Bros. credits',
  },
  {
    gameId: 'sonic-the-hedgehog-sega-genesis',
    title: 'Sonic the Hedgehog',
    ostComposers: [
      { name: 'Masato Nakamura', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Sonic_the_Hedgehog_(1991_video_game)',
    notes: 'Composer curated from Sonic the Hedgehog reference credits',
  },
  {
    gameId: 'sonic-the-hedgehog-2-sega-genesis',
    title: 'Sonic the Hedgehog 2',
    ostComposers: [
      { name: 'Masato Nakamura', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Sonic_the_Hedgehog_2',
    notes: 'Composer curated from Sonic the Hedgehog 2 reference credits',
  },
  {
    gameId: 'pokemon-firered-game-boy-advance',
    title: 'Pokemon FireRed',
    ostComposers: [
      { name: 'Junichi Masuda', role: 'composer' },
      { name: 'Go Ichinose', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Pok%C3%A9mon_FireRed_and_LeafGreen',
    notes: 'Composer curated from Pokemon FireRed and LeafGreen reference credits',
  },
  {
    gameId: 'pokemon-trading-card-game-game-boy',
    title: 'Pokemon Trading Card Game',
    ostComposers: [
      { name: 'Ichiro Shimakura', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Pok%C3%A9mon_Trading_Card_Game_(video_game)',
    notes: 'Composer curated from Pokemon Trading Card Game reference credits',
  },
]

runComposerBatch({
  batchKey: 'g4_composers_batch_10',
  notes: 'G4 composers batch 10 applied locally on staging sqlite',
  payload: G4_BATCH,
})
