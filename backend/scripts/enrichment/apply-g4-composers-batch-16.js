#!/usr/bin/env node
'use strict'

const { runComposerBatch } = require('./_composer-batch-common')

const G4_BATCH = [
  {
    gameId: 'army-men-sarge-s-heroes-nintendo-64',
    title: "Army Men: Sarge's Heroes",
    ostComposers: [
      { name: 'Barry Blum', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'series_reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Army_Men',
    notes: 'Composer curated from Army Men series reference mapping Barry Blum to Sarges Heroes',
  },
  {
    gameId: 'army-men-sarge-s-heroes-playstation',
    title: "Army Men: Sarge's Heroes",
    ostComposers: [
      { name: 'Barry Blum', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'series_reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Army_Men',
    notes: 'Composer curated from Army Men series reference mapping Barry Blum to Sarges Heroes',
  },
  {
    gameId: 'army-men-sarge-s-heroes-2-game-boy-color',
    title: "Army Men: Sarge's Heroes 2",
    ostComposers: [
      { name: 'Jason Tai', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'series_reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Army_Men',
    notes: 'Composer curated from Army Men series reference mapping Jason Tai to Sarges Heroes 2',
  },
  {
    gameId: 'army-men-sarge-s-heroes-2-nintendo-64',
    title: "Army Men: Sarge's Heroes 2",
    ostComposers: [
      { name: 'Jason Tai', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'series_reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Army_Men',
    notes: 'Composer curated from Army Men series reference mapping Jason Tai to Sarges Heroes 2',
  },
  {
    gameId: 'army-men-sarge-s-heroes-2-playstation',
    title: "Army Men: Sarge's Heroes 2",
    ostComposers: [
      { name: 'Jason Tai', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'series_reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Army_Men',
    notes: 'Composer curated from Army Men series reference mapping Jason Tai to Sarges Heroes 2',
  },
  {
    gameId: 'arkanoid-super-nintendo',
    title: 'Arkanoid',
    ostComposers: [
      { name: 'Seiji Momoi', role: 'composer' },
      { name: 'Katsuhisa Ishikawa', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Arkanoid:_Doh_It_Again',
    notes: 'Composer curated from Arkanoid: Doh It Again reference credits for the SNES release',
  },
  {
    gameId: 'assault-rigs-sega-saturn',
    title: 'Assault Rigs',
    ostComposers: [
      { name: 'Matt Furniss', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Assault_Rigs',
    notes: 'Composer curated from Assault Rigs reference credits covering the Saturn release',
  },
  {
    gameId: 'pokemon-yellow-game-boy',
    title: 'Pokemon Yellow',
    ostComposers: [
      { name: 'Junichi Masuda', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Pok%C3%A9mon_Red,_Blue,_and_Yellow',
    notes: 'Composer curated from Pokemon Red Blue and Yellow reference credits',
  },
  {
    gameId: 'rival-schools-evolution-dreamcast',
    title: 'Project Justice',
    ostComposers: [
      { name: 'Yuki Iwai', role: 'composer' },
      { name: 'Etsuko Yoneda', role: 'composer' },
      { name: 'Setsuo Yamamoto', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Project_Justice',
    notes: 'Composer curated from Project Justice reference credits',
  },
  {
    gameId: 'dark-savior-sega-saturn',
    title: 'Dark Savior',
    ostComposers: [
      { name: 'Hiroshi Kondo', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Dark_Savior',
    notes: 'Composer curated from Dark Savior reference credits',
  },
]

runComposerBatch({
  batchKey: 'g4_composers_batch_16',
  notes: 'G4 composers batch 16 applied locally on staging sqlite',
  payload: G4_BATCH,
})
