#!/usr/bin/env node
'use strict'

const { runComposerBatch } = require('./_composer-batch-common')

const G4_BATCH = [
  {
    gameId: 'excitebike-nintendo-entertainment-system',
    title: 'Excitebike',
    ostComposers: [
      { name: 'Akito Nakatsuka', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Excitebike',
    notes: 'Composer curated from Excitebike reference credits',
  },
  {
    gameId: 'super-ghouls-n-ghosts-super-nintendo',
    title: "Super Ghouls 'n Ghosts",
    ostComposers: [
      { name: 'Mari Yamaguchi', role: 'composer' },
    ],
    sourceName: 'gamefaqs',
    sourceType: 'credits',
    sourceUrl: 'https://gamefaqs.gamespot.com/snes/588732-super-ghouls-n-ghosts/credit',
    notes: 'Composer curated from Super Ghouls n Ghosts SNES credits',
  },
  {
    gameId: 'gradius-iii-super-nintendo',
    title: 'Gradius III',
    ostComposers: [
      { name: 'Konami Kukeiha Club', role: 'composer' },
    ],
    sourceName: 'theongaku',
    sourceType: 'soundtrack_reference',
    sourceUrl: 'https://www.theongaku.com/posts/gradius-iii-vinyl-soundtrack-snes-arcade',
    notes: 'Composer curated from Gradius III soundtrack release notes crediting Konami Kukeiha Club',
  },
  {
    gameId: 'tecmo-super-bowl-nintendo-entertainment-system',
    title: 'Tecmo Super Bowl',
    ostComposers: [
      { name: 'Keiji Yamagishi', role: 'composer' },
      { name: 'Ryuichi Nitta', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Tecmo_Super_Bowl',
    notes: 'Composer curated from Tecmo Super Bowl reference credits',
  },
  {
    gameId: 'driver-playstation',
    title: 'Driver',
    ostComposers: [
      { name: 'Allister Brimble', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Driver_(video_game)',
    notes: 'Composer curated from Driver reference credits',
  },
  {
    gameId: 'colin-mcrae-rally-playstation',
    title: 'Colin McRae Rally',
    ostComposers: [
      { name: 'Jonathan Colling', role: 'composer' },
    ],
    sourceName: 'vgmdb',
    sourceType: 'soundtrack_reference',
    sourceUrl: 'https://vgmdb.net/album/19716',
    notes: 'Composer curated from Colin McRae Rally soundtrack credits',
  },
  {
    gameId: 'contra-hard-corps-sega-genesis',
    title: 'Contra: Hard Corps',
    ostComposers: [
      { name: 'Hiroshi Kobayashi', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Contra:_Hard_Corps',
    notes: 'Composer curated from Contra: Hard Corps reference credits',
  },
  {
    gameId: 'mr-driller-playstation',
    title: 'Mr. Driller',
    ostComposers: [
      { name: 'Go Shiina', role: 'composer' },
    ],
    sourceName: 'caneandrinse',
    sourceType: 'reference',
    sourceUrl: 'https://caneandrinse.com/music-monday-mr-driller/',
    notes: 'Composer curated from Mr. Driller soundtrack overview crediting Go Shiina',
  },
  {
    gameId: 'mortal-kombat-ii-sega-genesis',
    title: 'Mortal Kombat II',
    ostComposers: [
      { name: 'Dan Forden', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Mortal_Kombat_II',
    notes: 'Composer curated from Mortal Kombat II reference credits',
  },
  {
    gameId: 'castlevania-nintendo-64',
    title: 'Castlevania',
    ostComposers: [
      { name: 'Masahiko Kimura', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Castlevania_(1999_video_game)',
    notes: 'Composer curated from Castlevania Nintendo 64 reference credits',
  },
]

runComposerBatch({
  batchKey: 'g4_composers_batch_9',
  notes: 'G4 composers batch 9 applied locally on staging sqlite',
  payload: G4_BATCH,
})
