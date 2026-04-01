#!/usr/bin/env node
'use strict'

const { runComposerBatch } = require('./_composer-batch-common')

const G4_BATCH = [
  {
    gameId: 'ace-attorney-investigations-miles-edgeworth-nintendo-ds',
    title: 'Ace Attorney Investigations: Miles Edgeworth',
    ostComposers: [
      { name: 'Noriyuki Iwadare', role: 'composer' },
      { name: 'Yasuko Yamada', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Ace_Attorney_Investigations:_Miles_Edgeworth',
    notes: 'Composer curated from Ace Attorney Investigations: Miles Edgeworth reference credits',
  },
  {
    gameId: 'ace-attorney-investigations-2-prosecutor-s-gambit-nintendo-ds',
    title: "Ace Attorney Investigations 2: Prosecutor's Gambit",
    ostComposers: [
      { name: 'Noriyuki Iwadare', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Ace_Attorney_Investigations_2:_Prosecutor%27s_Gambit',
    notes: 'Composer curated from Ace Attorney Investigations 2 reference credits',
  },
  {
    gameId: 'castlevania-dawn-of-sorrow-nintendo-ds',
    title: 'Castlevania: Dawn of Sorrow',
    ostComposers: [
      { name: 'Masahiko Kimura', role: 'composer' },
      { name: 'Michiru Yamane', role: 'composer' },
    ],
    sourceName: 'gamefaqs',
    sourceType: 'credits',
    sourceUrl: 'https://gamefaqs.gamespot.com/ds/922145-castlevania-dawn-of-sorrow/credit',
    notes: 'Composer curated from Castlevania: Dawn of Sorrow DS credits',
  },
  {
    gameId: 'castlevania-order-of-ecclesia-nintendo-ds',
    title: 'Castlevania: Order of Ecclesia',
    ostComposers: [
      { name: 'Michiru Yamane', role: 'composer' },
      { name: 'Yasuhiro Ichihashi', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Castlevania:_Order_of_Ecclesia',
    notes: 'Composer curated from Castlevania: Order of Ecclesia reference credits',
  },
  {
    gameId: 'megaman-zero-2-game-boy-advance',
    title: 'Mega Man Zero 2',
    ostComposers: [
      { name: 'Masaki Suzuki', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Mega_Man_Zero_2',
    notes: 'Composer curated from Mega Man Zero 2 reference credits',
  },
  {
    gameId: 'jet-force-gemini-nintendo-64',
    title: 'Jet Force Gemini',
    ostComposers: [
      { name: 'Robin Beanland', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Jet_Force_Gemini',
    notes: 'Composer curated from Jet Force Gemini reference credits',
  },
  {
    gameId: 'lylat-wars-nintendo-64',
    title: 'Lylat Wars',
    ostComposers: [
      { name: 'Koji Kondo', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Star_Fox_64',
    notes: 'Composer curated from Star Fox 64 reference credits',
  },
  {
    gameId: 'story-of-thor-sega-genesis',
    title: 'The Story of Thor',
    ostComposers: [
      { name: 'Yuzo Koshiro', role: 'composer' },
    ],
    sourceName: 'wayo',
    sourceType: 'soundtrack_reference',
    sourceUrl: 'https://www.wayorecords.net/wayo/the-story-of-thor/',
    notes: 'Composer curated from The Story of Thor original soundtrack release credits',
  },
  {
    gameId: 'sonic-advance-game-boy-advance',
    title: 'Sonic Advance',
    ostComposers: [
      { name: 'Tatsuyuki Maeda', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Sonic_Advance',
    notes: 'Composer curated from Sonic Advance reference credits',
  },
  {
    gameId: 'policenauts-playstation',
    title: 'Policenauts',
    ostComposers: [
      { name: 'Tappi Iwase', role: 'composer' },
      { name: 'Masahiro Ikariko', role: 'composer' },
      { name: 'Motoaki Furukawa', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Policenauts',
    notes: 'Composer curated from Policenauts reference credits',
  },
]

runComposerBatch({
  batchKey: 'g4_composers_batch_8',
  notes: 'G4 composers batch 8 applied locally on staging sqlite',
  payload: G4_BATCH,
})
