#!/usr/bin/env node
'use strict'

const { runComposerBatch } = require('./_composer-batch-common')

const G4_BATCH = [
  {
    gameId: 'aa-yakyu-jinsei-itchokusen-nes',
    title: 'Aa Yakyu Jinsei Itchokusen',
    ostComposers: [
      { name: 'Masaharu Iwata', role: 'composer' },
    ],
    sourceName: 'wikidata',
    sourceType: 'reference',
    sourceUrl: 'https://www.wikidata.org/wiki/Q4661040',
    notes: 'Composer curated from Wikidata work metadata listing Masaharu Iwata as composer for Aa Yakyu Jinsei Itchokusen',
  },
  {
    gameId: '3xtreme-playstation',
    title: '3Xtreme',
    ostComposers: [
      { name: 'Chuck Doud', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/3Xtreme',
    notes: 'Composer curated from 3Xtreme reference credits',
  },
  {
    gameId: 'atelier-marie-the-alchemist-of-salburg-sega-saturn',
    title: 'Atelier Marie: The Alchemist of Salburg',
    ostComposers: [
      { name: 'Daisuke Achiwa', role: 'composer' },
      { name: 'Toshiharu Yamanishi', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Atelier_Marie%3A_The_Alchemist_of_Salburg',
    notes: 'Composers curated from Atelier Marie reference credits; Saturn release follows the same original score as the PlayStation release family',
  },
  {
    gameId: 'australian-rugby-league-sega-genesis',
    title: 'Australian Rugby League',
    ostComposers: [
      { name: 'Bill Lusty', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/20519/australian-rugby-league/credits/genesis/',
    notes: 'Composer curated from Australian Rugby League Genesis credits listing Bill Lusty under Music',
  },
  {
    gameId: 'ballz-sega-genesis',
    title: 'Ballz',
    ostComposers: [
      { name: 'Nu Romantic Productions', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/company/2796/nu-romantic-productions/',
    notes: 'Composer curated from Nu Romantic Productions company credits listing Ballz 3D: Fighting at its Ballziest on Genesis under music',
  },
  {
    gameId: 'barkley-shut-up-and-jam-sega-genesis',
    title: 'Barkley Shut Up and Jam!',
    ostComposers: [
      { name: 'Dominique Messinger', role: 'composer' },
      { name: 'Rick Rhodes', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Barkley_Shut_Up_and_Jam%21',
    notes: 'Composers curated from Barkley Shut Up and Jam reference credits',
  },
  {
    gameId: 'capcom-vs-snk-dreamcast',
    title: 'Capcom vs. SNK',
    ostComposers: [
      { name: 'Satoshi Ise', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/4156/capcom-vs-snk/credits/dreamcast/',
    notes: 'Composer curated from Capcom vs. SNK Dreamcast credits listing Satoshi Ise under Music Compose',
  },
  {
    gameId: 'cruis-n-exotica-nintendo-64',
    title: 'Cruis\'n Exotica',
    ostComposers: [
      { name: 'Vince Pontarelli', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Cruis%27n_Exotica',
    notes: 'Composer curated from Cruis\'n Exotica reference credits covering the Nintendo 64 release family',
  },
]

runComposerBatch({
  batchKey: 'g4_composers_batch_23',
  notes: 'G4 composers batch 23 applied locally on staging sqlite',
  payload: G4_BATCH,
})
