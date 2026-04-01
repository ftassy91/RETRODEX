#!/usr/bin/env node
'use strict'

const { runComposerBatch } = require('./_composer-batch-common')

const G4_BATCH = [
  {
    gameId: 'beatmania-wonderswan',
    title: 'Beatmania',
    ostComposers: [
      { name: 'Kimitaka Matsumae', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'person_credits',
    sourceUrl: 'https://www.mobygames.com/person/101820/kimitaka-matsumae/credits/sort:genre/',
    notes: 'Composer curated from Kimitaka Matsumae credits listing beatmania for WonderSwan under music and sound effects',
  },
  {
    gameId: 'klax-atari-lynx',
    title: 'Klax',
    ostComposers: [
      { name: 'Alex Rudis', role: 'composer' },
    ],
    sourceName: 'vgmrips',
    sourceType: 'rip_metadata',
    sourceUrl: 'https://vgmrips.net/packs/pack/klax-atari-lynx',
    notes: 'Composer curated from Atari Lynx Klax music pack metadata',
  },
  {
    gameId: 'little-samson-nintendo-entertainment-system',
    title: 'Little Samson',
    ostComposers: [
      { name: 'Yoshiji Yokoyama', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'person_credits',
    sourceUrl: 'https://www.mobygames.com/person/502249/yoshiji-yokoyama/',
    notes: 'Composer curated from Yoshiji Yokoyama credits listing Little Samson music',
  },
  {
    gameId: 'splatterhouse-2-sega-genesis',
    title: 'Splatterhouse 2',
    ostComposers: [
      { name: 'Eiko Kaneda', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Splatterhouse_2',
    notes: 'Composer curated from Splatterhouse 2 reference credits',
  },
  {
    gameId: 'super-probotector-super-nintendo',
    title: 'Super Probotector',
    ostComposers: [
      { name: 'Miki Higashino', role: 'composer' },
      { name: 'Masanori Adachi', role: 'composer' },
      { name: 'Tappi Iwase', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Contra_III:_The_Alien_Wars',
    notes: 'Composer curated from Contra III credits for the PAL Super Probotector release',
  },
  {
    gameId: 'the-king-of-fighters-dream-match-1999-dreamcast',
    title: 'The King of Fighters: Dream Match 1999',
    ostComposers: [
      { name: 'Hideki Asanaka', role: 'composer' },
      { name: 'Marimo', role: 'composer' },
      { name: 'Yasuo Yamate', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'port_reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/The_King_of_Fighters_%2798',
    notes: 'Composer curated from KOF 98 credits and Dream Match 1999 release notes for the Dreamcast port',
  },
  {
    gameId: 'tiny-toon-adventures-nintendo-entertainment-system',
    title: 'Tiny Toon Adventures',
    ostComposers: [
      { name: 'Jun Funahashi', role: 'composer' },
      { name: 'Masae Nakashima', role: 'composer' },
      { name: 'Satoko Miyawaki', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Tiny_Toon_Adventures_(video_game)',
    notes: 'Composer curated from Tiny Toon Adventures NES reference credits',
  },
  {
    gameId: 'vampire-savior-sega-saturn',
    title: 'Vampire Savior',
    ostComposers: [
      { name: 'Takayuki Iwai', role: 'composer' },
      { name: 'Masato Kouda', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Vampire_Savior',
    notes: 'Composer curated from Vampire Savior reference credits covering the Saturn version',
  },
  {
    gameId: 'vikings-child-atari-lynx',
    title: 'Viking Child',
    ostComposers: [
      { name: 'Barry Leitch', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/9049/prophecy-viking-child/credits/lynx/',
    notes: 'Composer curated from Prophecy Viking Child Lynx credits',
  },
  {
    gameId: 'wipeout-xl-playstation',
    title: 'Wipeout XL',
    ostComposers: [
      { name: 'Tim Wright', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Wipeout_2097',
    notes: 'Composer curated from Wipeout 2097 reference credits for the North American Wipeout XL release',
  },
]

runComposerBatch({
  batchKey: 'g4_composers_batch_18',
  notes: 'G4 composers batch 18 applied locally on staging sqlite',
  payload: G4_BATCH,
})
