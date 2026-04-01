#!/usr/bin/env node
'use strict'

const { runComposerBatch } = require('./_composer-batch-common')

const G4_BATCH = [
  {
    gameId: 'addams-family-values-sega-genesis',
    title: 'Addams Family Values',
    ostComposers: [
      { name: 'Keith Tinman', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Addams_Family_Values_(video_game)',
    notes: 'Composer curated from Addams Family Values game reference listing Super NES and Mega Drive releases',
  },
  {
    gameId: 'batman-the-video-game-nes',
    title: 'Batman: The Video Game',
    ostComposers: [
      { name: 'Naoki Kodaka', role: 'composer' },
      { name: 'Nobuyuki Hara', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Batman:_The_Video_Game',
    notes: 'Composer curated from Batman NES reference credits',
  },
  {
    gameId: 'alien-hominid-game-boy-advance',
    title: 'Alien Hominid',
    ostComposers: [
      { name: 'Allister Brimble', role: 'composer' },
      { name: 'Anthony N. Putson', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Alien_Hominid',
    notes: 'Composer curated from Alien Hominid reference credits for the Game Boy Advance soundtrack',
  },
  {
    gameId: 'area-51-sega-saturn',
    title: 'Area 51',
    ostComposers: [
      { name: 'Jeanne Parson', role: 'composer' },
      { name: 'Michael Stein', role: 'composer', note: 'uncredited' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Area_51_%281995_video_game%29',
    notes: 'Composer curated from Area 51 reference credits covering the Saturn and PlayStation ports',
  },
  {
    gameId: 'area-51-playstation',
    title: 'Area 51',
    ostComposers: [
      { name: 'Jeanne Parson', role: 'composer' },
      { name: 'Michael Stein', role: 'composer', note: 'uncredited' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Area_51_%281995_video_game%29',
    notes: 'Composer curated from Area 51 reference credits covering the Saturn and PlayStation ports',
  },
  {
    gameId: 'amok-sega-saturn',
    title: 'Amok',
    ostComposers: [
      { name: 'Jesper Kyd', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'composer_biography',
    sourceUrl: 'https://en.wikipedia.org/wiki/Jesper_Kyd',
    notes: 'Composer curated from Jesper Kyd biography listing Amok in his game works',
  },
  {
    gameId: 'amazing-hebereke-super-nintendo',
    title: 'Amazing Hebereke',
    ostComposers: [
      { name: 'Kansei Craftwork', role: 'composer' },
      { name: 'Prophet Kazuo', role: 'composer' },
      { name: 'Naoki Kodaka', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Sugoi_Hebereke',
    notes: 'Composer curated from Sugoi Hebereke reference, the original Super Famicom release for Amazing Hebereke',
  },
  {
    gameId: 'an-american-tail-fievel-goes-west-super-nintendo',
    title: 'An American Tail: Fievel Goes West',
    ostComposers: [
      { name: 'Munetaka Sakamoto', role: 'composer' },
      { name: 'Takashi Tsumaki', role: 'composer' },
      { name: 'Takeshi Sato', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/An_American_Tail%3A_Fievel_Goes_West_%28video_game%29',
    notes: 'Composer curated from An American Tail: Fievel Goes West SNES reference credits',
  },
  {
    gameId: '70-s-robot-anime-geppy-x-playstation',
    title: "70's Robot Anime Geppy-X",
    ostComposers: [
      { name: 'Momo Michishita', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/70%27s_Robot_Anime_Geppy-X',
    notes: 'Composer curated from 70s Robot Anime Geppy-X reference credits',
  },
  {
    gameId: 'american-gladiators-nes',
    title: 'American Gladiators',
    ostComposers: [
      { name: 'Leif Marwede', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/American_Gladiators_%28video_game%29',
    notes: 'Composer curated from American Gladiators reference credits for the NES release',
  },
]

runComposerBatch({
  batchKey: 'g4_composers_batch_13',
  notes: 'G4 composers batch 13 applied locally on staging sqlite',
  payload: G4_BATCH,
})
