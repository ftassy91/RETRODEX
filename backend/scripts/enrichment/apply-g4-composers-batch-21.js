#!/usr/bin/env node
'use strict'

const { runComposerBatch } = require('./_composer-batch-common')

const G4_BATCH = [
  {
    gameId: 'aerostar-game-boy',
    title: 'Aerostar',
    ostComposers: [
      { name: 'Dota Ando', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/31638/aerostar/',
    notes: 'Composer curated from Aerostar Game Boy credits',
  },
  {
    gameId: 'alienators-evolution-continues-game-boy-advance',
    title: 'Alienators: Evolution Continues',
    ostComposers: [
      { name: 'Allister Brimble', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/5309/alienators-evolution-continues/credits/gameboy-advance/',
    notes: 'Composer curated from Alienators Evolution Continues GBA credits',
  },
  {
    gameId: 'al-unser-jr-s-turbo-racing-nes',
    title: "Al Unser Jr.'s Turbo Racing",
    ostComposers: [
      { name: 'Shogo Sakai', role: 'composer' },
      { name: 'Takafumi Miura', role: 'composer' },
      { name: 'Masaaki Iwasaki', role: 'composer' },
      { name: 'Yuji Suzuki', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/13005/al-unser-jr-turbo-racing/',
    notes: 'Composers curated from Al Unser Jr. Turbo Racing NES sound credits',
  },
  {
    gameId: 'arcade-classic-game-boy',
    title: 'Arcade Classic',
    ostComposers: [
      { name: 'Paul Kenny', role: 'composer' },
      { name: 'J. Dave Rogers', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/6119/arcade-classic-1-asteroids-missile-command/',
    notes: 'Composers curated from Arcade Classic 1 Game Boy credits',
  },
  {
    gameId: 'arthur-s-absolutely-fun-day-game-boy-color',
    title: "Arthur's Absolutely Fun Day!",
    ostComposers: [
      { name: 'Tommy Tallarico', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/160627/arthurs-absolutely-fun-day/credits/gameboy-color/',
    notes: 'Composer curated from Arthurs Absolutely Fun Day Game Boy Color credits',
  },
  {
    gameId: 'atomic-punk-game-boy',
    title: 'Atomic Punk',
    ostComposers: [
      { name: 'Yasuhiko Fukuda', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/48189/atomic-punk/',
    notes: 'Composer curated from Atomic Punk Game Boy credits',
  },
  {
    gameId: 'banishing-racer-game-boy',
    title: 'Banishing Racer',
    ostComposers: [
      { name: 'Yasuyuki Suzuki', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/221690/banishing-racer/',
    notes: 'Composer curated from Banishing Racer Game Boy credits',
  },
  {
    gameId: 'barkley-shut-up-and-jam-2-sega-genesis',
    title: 'Barkley: Shut Up and Jam! 2',
    ostComposers: [
      { name: 'Rudy Helm', role: 'composer' },
      { name: 'Richard Kelly', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/38906/barkley-shut-up-and-jam-2/credits/genesis/',
    notes: 'Composers curated from Barkley Shut Up and Jam 2 Genesis credits',
  },
  {
    gameId: 'airwolf-nes',
    title: 'Airwolf',
    ostComposers: [
      { name: 'Gregg Barnett', role: 'composer' },
      { name: 'Sylvester Levay', role: 'theme_composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/11977/airwolf/credits/nes/',
    notes: 'Composers curated from Airwolf NES credits listing main theme and music arranger programmer',
  },
]

runComposerBatch({
  batchKey: 'g4_composers_batch_21',
  notes: 'G4 composers batch 21 applied locally on staging sqlite',
  payload: G4_BATCH,
})
