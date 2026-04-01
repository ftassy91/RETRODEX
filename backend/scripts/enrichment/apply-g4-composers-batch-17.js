#!/usr/bin/env node
'use strict'

const { runComposerBatch } = require('./_composer-batch-common')

const G4_BATCH = [
  {
    gameId: 'chameleon-twist-nintendo-64',
    title: 'Chameleon Twist',
    ostComposers: [
      { name: 'Takashi Sugioka', role: 'composer' },
      { name: 'Takashi Makino', role: 'composer' },
      { name: 'Yuuji Nakao', role: 'composer' },
      { name: 'Nobutoshi Ichimiya', role: 'composer' },
      { name: 'Koki Tochio', role: 'composer' },
      { name: 'Tsutomu Washijima', role: 'composer' },
      { name: 'Hiroshi Takami', role: 'composer' },
      { name: 'Fumihiko Yamada', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://es.wikipedia.org/wiki/Chameleon_Twist',
    notes: 'Composer curated from Chameleon Twist credits under the Sound and Music staff section',
  },
  {
    gameId: 'point-blank-playstation',
    title: 'Point Blank',
    ostComposers: [
      { name: 'Takayuki Aihara', role: 'composer' },
      { name: 'Takayuki Ishikawa', role: 'composer' },
      { name: 'Hiroto Sasaki', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/3915/point-blank/credits/arcade/',
    notes: 'Composer curated from Point Blank credits listing music and sound staff for the PlayStation conversion lineage',
  },
  {
    gameId: 'bahamut-senki-sega-genesis',
    title: 'Bahamut Senki',
    ostComposers: [
      { name: 'Tokuhiko Uwabo', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Bahamut_Senki',
    notes: 'Composer curated from Bahamut Senki reference credits',
  },
  {
    gameId: 'black-dawn-sega-saturn',
    title: 'Black Dawn',
    ostComposers: [
      { name: 'Tommy Tallarico', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Black_Dawn_(video_game)',
    notes: 'Composer curated from Black Dawn reference credits covering the Saturn version',
  },
  {
    gameId: 'battletanx-global-assault-nintendo-64',
    title: 'BattleTanx: Global Assault',
    ostComposers: [
      { name: 'Barry Leitch', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/BattleTanx:_Global_Assault',
    notes: 'Composer curated from BattleTanx Global Assault reference credits',
  },
]

runComposerBatch({
  batchKey: 'g4_composers_batch_17',
  notes: 'G4 composers batch 17 applied locally on staging sqlite',
  payload: G4_BATCH,
})
