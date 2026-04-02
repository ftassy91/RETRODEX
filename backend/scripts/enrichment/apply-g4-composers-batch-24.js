#!/usr/bin/env node
'use strict'

const { runComposerBatch } = require('./_composer-batch-common')

const G4_BATCH = [
  {
    gameId: 'actua-golf-2-playstation',
    title: 'Actua Golf 2',
    ostComposers: [
      { name: 'Kevin Saville', role: 'composer' },
      { name: 'Colin Anderson', role: 'composer' },
      { name: 'Fiona Robertson', role: 'composer' },
      { name: 'Sean Taylor', role: 'composer' },
      { name: 'Stuart Ross', role: 'composer' },
      { name: 'Simon Short', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/4742/fox-sports-golf-99/credits/playstation/',
    notes: 'Composers curated from Fox Sports Golf 99 / Actua Golf 2 PlayStation credits listing the music and sample editing team',
  },
  {
    gameId: 'advan-racing-playstation',
    title: 'Advan Racing',
    ostComposers: [
      { name: 'Tomoyuki Hamada', role: 'composer' },
      { name: 'Yasutaka Hatade', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/24943/advan-racing/credits/playstation/',
    notes: 'Composers curated from ADVAN Racing PlayStation credits listing musical composer and additional composer roles',
  },
]

runComposerBatch({
  batchKey: 'g4_composers_batch_24',
  notes: 'G4 composers batch 24 applied locally on staging sqlite',
  payload: G4_BATCH,
})
