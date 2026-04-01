#!/usr/bin/env node
'use strict'

const { runComposerBatch } = require('./_composer-batch-common')

const G4_BATCH = [
  {
    gameId: 'aconcagua-playstation',
    title: 'Aconcagua',
    ostComposers: [
      { name: 'Kazuhiko Toyama', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'person_credits',
    sourceUrl: 'https://www.mobygames.com/person/314418/kazuhiko-toyama/',
    notes: 'Composer curated from Kazuhiko Toyama credits listing Aconcagua as composer and conductor',
  },
  {
    gameId: 'actionloop-nintendo-ds',
    title: 'Actionloop',
    ostComposers: [
      { name: 'Toshiyuki Sudo', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/30585/magnetica/credits/nintendo-ds/',
    notes: 'Composer curated from Magnetica Nintendo DS credits; Actionloop is the alternate regional title',
  },
  {
    gameId: 'aerobiz-sega-genesis',
    title: 'Aerobiz',
    ostComposers: [
      { name: 'Taku Iwasaki', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Aerobiz',
    notes: 'Composer curated from Aerobiz reference credits covering Genesis and Super NES releases',
  },
  {
    gameId: 'aerobiz-super-nintendo',
    title: 'Aerobiz',
    ostComposers: [
      { name: 'Taku Iwasaki', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Aerobiz',
    notes: 'Composer curated from Aerobiz reference credits covering Genesis and Super NES releases',
  },
  {
    gameId: 'aerobiz-supersonic-sega-genesis',
    title: 'Aerobiz Supersonic',
    ostComposers: [
      { name: 'Taku Iwasaki', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Aerobiz_Supersonic',
    notes: 'Composer curated from Aerobiz Supersonic reference and page categorization as a Taku Iwasaki-scored title',
  },
  {
    gameId: 'aerobiz-supersonic-super-nintendo',
    title: 'Aerobiz Supersonic',
    ostComposers: [
      { name: 'Taku Iwasaki', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/Aerobiz_Supersonic',
    notes: 'Composer curated from Aerobiz Supersonic reference and page categorization as a Taku Iwasaki-scored title',
  },
  {
    gameId: 'airs-adventure-sega-saturn',
    title: 'Airs Adventure',
    ostComposers: [
      { name: 'Shigeaki Saegusa', role: 'composer' },
      { name: 'Toshinori Konno', role: 'composer' },
      { name: 'Naoki Sato', role: 'composer' },
      { name: 'Hiromitsu Ishikawa', role: 'composer' },
      { name: 'Koji Tagaito', role: 'composer' },
      { name: 'Michihiro Nomura', role: 'composer' },
      { name: 'Takeshi Sato', role: 'composer' },
      { name: 'Munetaka Sakamoto', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/11477/airs-adventure/credits/sega-saturn/',
    notes: 'Composers curated from Airs Adventure Saturn credits music, sound direction and movie compose roles',
  },
  {
    gameId: 'battle-monsters-sega-saturn',
    title: 'Battle Monsters',
    ostComposers: [
      { name: 'Yoshio Nagashima', role: 'composer' },
    ],
    sourceName: 'mobygames',
    sourceType: 'credits_reference',
    sourceUrl: 'https://www.mobygames.com/game/28299/battle-monsters/credits/sega-saturn/',
    notes: 'Composer curated from Battle Monsters Saturn credits',
  },
  {
    gameId: 'nba-jam-sega-genesis',
    title: 'NBA Jam',
    ostComposers: [
      { name: 'Rick Fox', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/NBA_Jam_(1993_video_game)',
    notes: 'Composer curated from NBA Jam reference credits listing Rick Fox for Genesis and SNES console versions',
  },
  {
    gameId: 'nba-jam-super-nintendo',
    title: 'NBA Jam',
    ostComposers: [
      { name: 'Rick Fox', role: 'composer' },
    ],
    sourceName: 'wikipedia',
    sourceType: 'reference',
    sourceUrl: 'https://en.wikipedia.org/wiki/NBA_Jam_(1993_video_game)',
    notes: 'Composer curated from NBA Jam reference credits listing Rick Fox for Genesis and SNES console versions',
  },
]

runComposerBatch({
  batchKey: 'g4_composers_batch_20',
  notes: 'G4 composers batch 20 applied locally on staging sqlite',
  payload: G4_BATCH,
})
