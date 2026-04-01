#!/usr/bin/env node
'use strict'

const { runComposerBatch } = require('./_composer-batch-common')

const G4_BATCH = [
  {
    gameId: 'adventures-in-the-magic-kingdom-nes',
    title: 'Adventures in the Magic Kingdom',
    ostComposers: [
      { name: 'Yoko Shimomura', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Adventures_in_the_Magic_Kingdom',
    notes: 'Composer curated from Adventures in the Magic Kingdom reference credits',
  },
  {
    gameId: 'adventures-of-lolo-2-nes',
    title: 'Adventures of Lolo 2',
    ostComposers: [
      { name: 'Hideki Kanazashi', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Adventures_of_Lolo_2',
    notes: 'Composer curated from Adventures of Lolo 2 reference credits',
  },
  {
    gameId: 'air-fortress-nes',
    title: 'Air Fortress',
    ostComposers: [
      { name: 'Hideki Kanazashi', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Air_Fortress',
    notes: 'Composer curated from Air Fortress reference credits',
  },
  {
    gameId: 'amazing-tater-game-boy',
    title: 'Amazing Tater',
    ostComposers: [
      { name: 'Hidehito Aoki', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Amazing_Tater',
    notes: 'Composer curated from Amazing Tater reference credits',
  },
  {
    gameId: 'asterix-and-the-power-of-the-gods-sega-genesis',
    title: 'Asterix and the Power of the Gods',
    ostComposers: [
      { name: 'Nathan McCree', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Asterix_and_the_Power_of_the_Gods',
    notes: 'Composer curated from Asterix and the Power of the Gods reference credits',
  },
  {
    gameId: 'azure-dreams-playstation',
    title: 'Azure Dreams',
    ostComposers: [
      { name: 'Hiroshi Tamawari', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Azure_Dreams',
    notes: 'Composer curated from Azure Dreams reference credits',
  },
  {
    gameId: 'batsugun-sega-saturn',
    title: 'Batsugun',
    ostComposers: [
      { name: 'Yoshitatsu Sakai', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Batsugun',
    notes: 'Composer curated from Batsugun reference credits',
  },
  {
    gameId: 'battle-unit-zeoth-game-boy',
    title: 'Battle Unit Zeoth',
    ostComposers: [
      { name: 'Akihito Hayashi', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Battle_Unit_Zeoth',
    notes: 'Composer curated from Battle Unit Zeoth reference credits',
  },
  {
    gameId: 'checkered-flag-atari-lynx',
    title: 'Checkered Flag',
    ostComposers: [
      { name: 'Bob Vieira', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Checkered_Flag_(1991_video_game)',
    notes: 'Composer curated from Checkered Flag Atari Lynx reference credits',
  },
  {
    gameId: 'dungeons-dragons-collection-sega-saturn',
    title: 'Dungeons & Dragons Collection',
    ostComposers: [
      { name: 'Isao Abe', role: 'composer' },
      { name: 'Takayuki Iwai', role: 'composer' },
      { name: 'Hideki Okugawa', role: 'composer' },
      { name: 'Masato Kouda', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'compilation_reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Dungeons_%26_Dragons:_Shadow_over_Mystara',
    notes: 'Collection composers curated from Tower of Doom and Shadow over Mystara credits, the two titles bundled in Dungeons & Dragons Collection',
  },
]

runComposerBatch({
  batchKey: 'g4_composers_batch_11',
  notes: 'G4 composers batch 11 applied locally on staging sqlite',
  payload: G4_BATCH,
})
