#!/usr/bin/env node
'use strict'

const { runComposerBatch } = require('./_composer-batch-common')

const G4_BATCH = [
  {
    gameId: 'actua-soccer-playstation',
    title: 'Actua Soccer',
    ostComposers: [
      { name: 'Neil Biggin', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'person_credits',
    sourceUrl: 'https://www.mobygames.com/person/5215/neil-biggin/credits/',
    notes: 'Composer curated from Neil Biggin credits listing VR Soccer 96 on PlayStation under music',
  },
  {
    gameId: 'actua-soccer-sega-saturn',
    title: 'Actua Soccer',
    ostComposers: [
      { name: 'Neil Biggin', role: 'composer' },
      { name: 'Pat Phelan', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/sega-saturn/vr-soccer-96/credits',
    notes: 'Composers curated from VR Soccer 96 Saturn credits listing Neil Biggin and Pat Phelan under music and sound effects',
  },
  {
    gameId: 'adventures-of-lolo-3-nes',
    title: 'Adventures of Lolo 3',
    ostComposers: [
      { name: 'Hideki Kanazashi', role: 'composer' },
      { name: 'Jun Ishikawa', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/7506/adventures-of-lolo-3/credits/nes/',
    notes: 'Composers curated from Adventures of Lolo 3 NES credits',
  },
  {
    gameId: 'appleseed-super-nintendo',
    title: 'Appleseed',
    ostComposers: [
      { name: 'Kenji Yamazaki', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/145646/appleseed/',
    notes: 'Composer curated from Appleseed SNES credits',
  },
  {
    gameId: 'awesome-possum-kicks-dr-machino-s-butt-sega-genesis',
    title: "Awesome Possum... Kicks Dr. Machino's Butt",
    ostComposers: [
      { name: 'Earl Vickers', role: 'composer' },
      { name: 'Doug Brandon', role: 'composer' },
      { name: 'Nu Romantic', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/16828/awesome-possum-kicks-dr-machinos-butt/credits/genesis/',
    notes: 'Composers curated from Awesome Possum Genesis credits',
  },
  {
    gameId: 'battle-stations-sega-saturn',
    title: 'Battle Stations',
    ostComposers: [
      { name: 'Greg Turner', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'person_credits',
    sourceUrl: 'https://www.mobygames.com/person/67210/greg-turner/credits/',
    notes: 'Composer curated from Greg Turner credits listing Battle Stations on Saturn under music composed and orchestrated by',
  },
  {
    gameId: 'black-fire-sega-saturn',
    title: 'Black Fire',
    ostComposers: [
      { name: 'Barry Blum', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/36907/black-fire/credits/sega-saturn/',
    notes: 'Composer curated from Black Fire Saturn credits',
  },
  {
    gameId: 'bug-too-sega-saturn',
    title: 'Bug Too!',
    ostComposers: [
      { name: 'Greg Turner', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/1713/bug-too/credits/sega-saturn/',
    notes: 'Composer curated from Bug Too Saturn credits',
  },
  {
    gameId: 'chaos-control-sega-saturn',
    title: 'Chaos Control',
    ostComposers: [
      { name: 'Thierry Louis Carron', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/16340/chaos-control/credits/sega-saturn/',
    notes: 'Composer curated from Chaos Control Saturn credits',
  },
  {
    gameId: 'clayfighter-63-nintendo-64',
    title: 'ClayFighter 63⅓',
    ostComposers: [
      { name: 'Richard Band', role: 'composer' },
      { name: 'Rick Jackson', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/8509/clay-fighter-63-13/credits/n64/',
    notes: 'Composers curated from ClayFighter 63⅓ Nintendo 64 credits',
  },
]

runComposerBatch({
  batchKey: 'g4_composers_batch_19',
  notes: 'G4 composers batch 19 applied locally on staging sqlite',
  payload: G4_BATCH,
})
