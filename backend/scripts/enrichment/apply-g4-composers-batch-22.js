#!/usr/bin/env node
'use strict'

const { runComposerBatch } = require('./_composer-batch-common')

const G4_BATCH = [
  {
    gameId: '4-elements-nintendo-ds',
    title: '4 Elements',
    ostComposers: [
      { name: 'Damjan Mravunac', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/36224/4-elements/credits/nintendo-ds/',
    notes: 'Composer curated from 4 Elements Nintendo DS credits listing Damjan Mravunac for music and sound effects',
  },
  {
    gameId: '6-inch-my-darling-sega-saturn',
    title: '6 Inch My Darling',
    ostComposers: [
      { name: 'Hironobu Yahata', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'person_credits',
    sourceUrl: 'https://www.mobygames.com/person/162508/hironobu-yahata/',
    notes: 'Composer curated from Hironobu Yahata person credits listing 6 Inch My Darling under Music',
  },
  {
    gameId: '7-wonders-of-the-ancient-world-nintendo-ds',
    title: '7 Wonders of the Ancient World',
    ostComposers: [
      { name: 'Vasily Shestovets', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/32004/7-wonders-of-the-ancient-world/',
    notes: 'Composer curated from the game overview credits listing Vasily Shestovets for music and SFX across 7 Wonders of the Ancient World releases, including the Nintendo DS port',
  },
  {
    gameId: 'aero-fighters-assault-nintendo-64',
    title: 'Aero Fighters Assault',
    ostComposers: [
      { name: 'Kouji Shiina', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/2871/aerofighters-assault/credits/nintendo-64/',
    notes: 'Composer curated from Aero Fighters Assault Nintendo 64 credits listing Kouji Shiina under Audio',
  },
  {
    gameId: 'aerobiz-playstation',
    title: 'Aerobiz',
    ostComposers: [
      { name: 'Taku Iwasaki', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Aerobiz',
    notes: 'Composer curated from Aerobiz reference credits; PlayStation variant aligned with the same Taku Iwasaki-scored release family as the already curated SNES and Genesis versions',
  },
  {
    gameId: 'aighina-no-yogen-from-the-legend-of-balubalouk-nes',
    title: 'Aighina no Yogen: From the Legend of Balubalouk',
    ostComposers: [
      { name: 'Tim Follin', role: 'composer' },
    ],
    sourceName: 'wikidata',
    sourceType: 'reference',
    sourceUrl: 'https://www.wikidata.org/wiki/Q2160214',
    notes: 'Composer curated from Wikidata work metadata for Aighina no Yogen: From the Legend of Balubalouk listing Tim Follin as composer',
  },
  {
    gameId: 'al-unser-jr-s-road-to-the-top-super-nintendo',
    title: 'Al Unser Jr.\'s Road to the Top',
    ostComposers: [
      { name: 'Marc Baril', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'person_credits',
    sourceUrl: 'https://www.mobygames.com/person/34400/marc-baril/credits/',
    notes: 'Composer curated from Marc Baril person credits listing Al Unser Jr.\'s Road to the Top under Music and SFX',
  },
  {
    gameId: 'arch-rivals-sega-genesis',
    title: 'Arch Rivals',
    ostComposers: [
      { name: 'Dan Forden', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/1682/arch-rivals/credits/sega-genesis/',
    notes: 'Composer curated from Arch Rivals Sega Genesis credits listing Dan Forden for music and sound',
  },
  {
    gameId: 'arcade-classic-game-boy-color',
    title: 'Arcade Classic',
    ostComposers: [
      { name: 'Paul Kenny', role: 'composer' },
      { name: 'J. Dave Rogers', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'person_credits',
    sourceUrl: 'https://www.mobygames.com/person/7511/j-dave-rogers/credits/sort%3Adate/',
    notes: 'Composer curated from Arcade Classic sibling alignment and J. Dave Rogers person credits; Game Boy Color variant inherits the same Arcade Classic music team as the already curated Game Boy release',
  },
  {
    gameId: 'asteroids-game-boy-color',
    title: 'Asteroids',
    ostComposers: [
      { name: 'Steve Collett', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/622/asteroids/credits/gameboy-color/',
    notes: 'Composer curated from Asteroids Game Boy Color credits listing Steve Collett for sound effects and music',
  },
]

runComposerBatch({
  batchKey: 'g4_composers_batch_22',
  notes: 'G4 composers batch 22 applied locally on staging sqlite',
  payload: G4_BATCH,
})
