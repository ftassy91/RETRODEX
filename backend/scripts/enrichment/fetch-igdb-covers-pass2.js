#!/usr/bin/env node
'use strict'

/**
 * fetch-igdb-covers-pass2.js
 *
 * Second pass for IGDB cover enrichment.
 * Uses hardcoded per-game queries (no fuzzy text matching).
 * Tries alternative names where IGDB may use a different title.
 * Only writes if cover_url is currently NULL in the games table.
 *
 * Usage:
 *   node fetch-igdb-covers-pass2.js           # dry-run (no DB writes)
 *   node fetch-igdb-covers-pass2.js --apply   # apply changes to SQLite
 */

const https = require('https')
const path = require('path')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const DB_PATH = path.resolve(__dirname, '../../storage/retrodex.sqlite')

const CLIENT_ID = '41yd2s4d22xsmyebyf6psh2tm1z1i6'
const CLIENT_SECRET = 'l8wxuonvigp5nsd7wtt9r2nlj73h8t'

/**
 * Each entry describes one game to look up.
 *
 * queries: array of IGDB Apicalypse query strings to try in order.
 *          We stop at the first one that returns a result with a cover.
 */
const GAMES = [
  // ── Game Boy (33) ─────────────────────────────────────────────────────────
  {
    id: '3-fun-yosou-umaban-club-game-boy',
    queries: [
      'fields name,cover.image_id,platforms.id; search "3-Fun Yosou Umaban Club"; where platforms = (33); limit 5;',
      'fields name,cover.image_id; search "3-Fun Yosou Umaban Club"; limit 5;',
    ],
  },
  {
    id: '4-in-1-funpak-game-boy',
    queries: [
      'fields name,cover.image_id,platforms.id; search "4 in 1 Funpak"; where platforms = (33); limit 5;',
      'fields name,cover.image_id; search "4 in 1 Funpak"; limit 5;',
    ],
  },
  {
    id: 'armored-police-metal-jack-game-boy',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Armored Police Metal Jack"; where platforms = (33); limit 5;',
      'fields name,cover.image_id; search "Metal Jack"; limit 5;',
    ],
  },
  {
    id: 'chikyu-kaiho-gun-zas-game-boy',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Chikyuu Kaihou Gun ZAS"; where platforms = (33); limit 5;',
      'fields name,cover.image_id; search "Chikyuu Kaihou Gun ZAS"; limit 5;',
      'fields name,cover.image_id; search "ZAS"; limit 5;',
    ],
  },

  // ── Game Boy Color (22) ───────────────────────────────────────────────────
  {
    id: 'auto-zone-game-boy-color',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Auto Zone"; where platforms = (22); limit 5;',
      'fields name,cover.image_id; search "Auto Zone"; limit 5;',
    ],
  },
  {
    id: 'beatmania-gb-gatchamix2-game-boy-color',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Beatmania GB GatchaMix 2"; where platforms = (22); limit 5;',
      'fields name,cover.image_id,platforms.id; search "Beatmania GB GatchaMix2"; where platforms = (22); limit 5;',
      'fields name,cover.image_id; search "Beatmania GatchaMix"; limit 5;',
    ],
  },
  {
    id: 'beatmania-gb2-gatchamix-game-boy-color',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Beatmania GB2 GatchaMix"; where platforms = (22); limit 5;',
      'fields name,cover.image_id; search "Beatmania GB2 GatchaMix"; limit 5;',
    ],
  },
  {
    id: 'bugs-bunny-lola-bunny-operation-carrot-patch-game-boy-color',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Bugs Bunny & Lola Bunny Operation Carrot Patch"; where platforms = (22); limit 5;',
      'fields name,cover.image_id,platforms.id; search "Operation Carrot Patch"; where platforms = (22); limit 5;',
      'fields name,cover.image_id; search "Operation Carrot Patch"; limit 5;',
    ],
  },

  // ── Game Gear (35) ────────────────────────────────────────────────────────
  {
    id: 'the-gg-shinobi-game-gear',
    queries: [
      'fields name,cover.image_id,platforms.id; search "GG Shinobi"; where platforms = (35); limit 5;',
      'fields name,cover.image_id,platforms.id; search "The GG Shinobi"; where platforms = (35); limit 5;',
      'fields name,cover.image_id; search "GG Shinobi"; limit 5;',
    ],
  },

  // ── NES (18) ──────────────────────────────────────────────────────────────
  {
    id: 'aa-yakyu-jinsei-itchokusen-nes',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Aa Yakyu Jinsei Itchokusen"; where platforms = (18); limit 5;',
      'fields name,cover.image_id; search "Aa Yakyu Jinsei Itchokusen"; limit 5;',
    ],
  },
  {
    id: 'america-daitoryo-senkyo-nes',
    queries: [
      'fields name,cover.image_id,platforms.id; search "America Daitoryou Senkyo"; where platforms = (18); limit 5;',
      'fields name,cover.image_id,platforms.id; search "America Daitoryo Senkyo"; where platforms = (18); limit 5;',
      'fields name,cover.image_id; search "America Daitoryou Senkyo"; limit 5;',
    ],
  },
  {
    id: 'bakushou-kinsey-gekijou-nes',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Bakushou Kinsey Gekijou"; where platforms = (18); limit 5;',
      'fields name,cover.image_id; search "Bakushou Kinsey Gekijou"; limit 5;',
    ],
  },
  {
    id: 'bakusho-ai-no-gekijo-nes',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Bakusho Ai no Gekijo"; where platforms = (18); limit 5;',
      'fields name,cover.image_id; search "Bakusho Ai no Gekijo"; limit 5;',
    ],
  },
  {
    id: 'bakusho-star-monomane-shitenno-nes',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Bakusho Star Monomane Shitenno"; where platforms = (18); limit 5;',
      'fields name,cover.image_id; search "Bakusho Star Monomane Shitenno"; limit 5;',
    ],
  },

  // ── Nintendo 64 (4) ───────────────────────────────────────────────────────
  {
    id: 'aero-fighters-assault-nintendo-64',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Aero Fighters Assault"; where platforms = (4); limit 5;',
      'fields name,cover.image_id,platforms.id; search "Air Fighters Assault"; where platforms = (4); limit 5;',
      'fields name,cover.image_id; search "Aero Fighters Assault"; limit 5;',
    ],
  },
  {
    id: 'bakusho-jinsei-64-mezase-resort-o-nintendo-64',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Bakusho Jinsei 64"; where platforms = (4); limit 5;',
      'fields name,cover.image_id; search "Bakusho Jinsei 64"; limit 5;',
    ],
  },
  {
    id: 'chrono-resurrection-nintendo-64',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Chrono Resurrection"; where platforms = (4); limit 5;',
      'fields name,cover.image_id; search "Chrono Resurrection"; limit 5;',
    ],
  },
  {
    id: 'chokukan-night-pro-yakyu-king-nintendo-64',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Chou-Kukan Night Pro Yakyuu King"; where platforms = (4); limit 5;',
      'fields name,cover.image_id,platforms.id; search "Chokukan Night Pro Yakyu King"; where platforms = (4); limit 5;',
      'fields name,cover.image_id; search "Chou-Kukan Night"; limit 5;',
    ],
  },
  {
    id: 'chokukan-night-pro-yakyu-king-2-nintendo-64',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Chou-Kukan Night Pro Yakyuu King 2"; where platforms = (4); limit 5;',
      'fields name,cover.image_id,platforms.id; search "Chokukan Night Pro Yakyu King 2"; where platforms = (4); limit 5;',
      'fields name,cover.image_id; search "Chou-Kukan Night 2"; limit 5;',
    ],
  },
  {
    id: 'cybertiger-nintendo-64',
    queries: [
      'fields name,cover.image_id,platforms.id; search "CyberTiger"; where platforms = (4); limit 5;',
      'fields name,cover.image_id; search "CyberTiger"; limit 5;',
    ],
  },
  {
    id: 'eiko-no-saint-andrews-nintendo-64',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Eiko no Saint Andrews"; where platforms = (4); limit 5;',
      'fields name,cover.image_id; search "Eiko no Saint Andrews"; limit 5;',
    ],
  },
  {
    id: 'g-a-s-p-fighters-nextream-nintendo-64',
    queries: [
      'fields name,cover.image_id,platforms.id; search "G.A.S.P Fighters NEXTream"; where platforms = (4); limit 5;',
      'fields name,cover.image_id,platforms.id; search "GASP Fighters NEXTream"; where platforms = (4); limit 5;',
      'fields name,cover.image_id; search "GASP Fighters NEXTream"; limit 5;',
    ],
  },

  // ── Nintendo DS (20) ──────────────────────────────────────────────────────
  {
    id: '12-family-games-nintendo-ds',
    queries: [
      'fields name,cover.image_id,platforms.id; search "12 Family Games"; where platforms = (20); limit 5;',
      'fields name,cover.image_id; search "12 Family Games"; limit 5;',
    ],
  },
  {
    id: '8ball-allstars-nintendo-ds',
    queries: [
      'fields name,cover.image_id,platforms.id; search "8Ball Allstars"; where platforms = (20); limit 5;',
      'fields name,cover.image_id,platforms.id; search "8 Ball Allstars"; where platforms = (20); limit 5;',
      'fields name,cover.image_id; search "8Ball Allstars"; limit 5;',
    ],
  },
  {
    id: 'a-train-ds-nintendo-ds',
    queries: [
      'fields name,cover.image_id,platforms.id; search "A-Train DS"; where platforms = (20); limit 5;',
      'fields name,cover.image_id; search "A-Train DS"; limit 5;',
    ],
  },
  {
    id: 'actionloop-nintendo-ds',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Actionloop"; where platforms = (20); limit 5;',
      'fields name,cover.image_id,platforms.id; search "Magnetica"; where platforms = (20); limit 5;',
      'fields name,cover.image_id; search "Actionloop"; limit 5;',
      'fields name,cover.image_id; search "Magnetica"; limit 5;',
    ],
  },
  {
    id: 'again-nintendo-ds',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Again"; where platforms = (20); limit 5;',
      // Note: "Again DS" search fallback removed — too broad, risks false positive
    ],
  },

  // ── PlayStation (7) ───────────────────────────────────────────────────────
  {
    id: '98-koshien-playstation',
    queries: [
      'fields name,cover.image_id,platforms.id; search "98 Koushien"; where platforms = (7); limit 5;',
      'fields name,cover.image_id,platforms.id; search "98 Koshien"; where platforms = (7); limit 5;',
      'fields name,cover.image_id; search "98 Koushien"; limit 5;',
    ],
  },
  {
    id: '99-koshien-playstation',
    queries: [
      'fields name,cover.image_id,platforms.id; search "99 Koushien"; where platforms = (7); limit 5;',
      'fields name,cover.image_id,platforms.id; search "99 Koshien"; where platforms = (7); limit 5;',
      'fields name,cover.image_id; search "99 Koushien"; limit 5;',
    ],
  },
  {
    id: '100-manyen-quiz-hunter-playstation',
    queries: [
      'fields name,cover.image_id,platforms.id; search "100 Man Yen Quiz Hunter"; where platforms = (7); limit 5;',
      'fields name,cover.image_id; search "100 Man Yen Quiz Hunter"; limit 5;',
    ],
  },
  {
    id: '3-3-eyes-tenrin-o-genmu-playstation',
    queries: [
      'fields name,cover.image_id,platforms.id; search "3x3 Eyes Tenrin O Genmu"; where platforms = (7); limit 5;',
      'fields name,cover.image_id,platforms.id; search "3x3 Eyes"; where platforms = (7); limit 5;',
      'fields name,cover.image_id; search "3x3 Eyes Tenrin"; limit 5;',
    ],
  },
  {
    id: '3-3-eyes-kyusei-koshu-playstation',
    queries: [
      'fields name,cover.image_id,platforms.id; search "3x3 Eyes Kyusei Koshu"; where platforms = (7); limit 5;',
      'fields name,cover.image_id; search "3x3 Eyes Kyusei Koshu"; limit 5;',
    ],
  },
  {
    id: 'a-bug-s-life-games-workshop-playstation',
    queries: [
      'fields name,cover.image_id,platforms.id; search "A Bug\'s Life"; where platforms = (7); limit 5;',
      'fields name,cover.image_id; search "A Bug\'s Life"; limit 5;',
    ],
  },
  {
    id: 'actua-golf-2-playstation',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Actua Golf 2"; where platforms = (7); limit 5;',
      'fields name,cover.image_id; search "Actua Golf 2"; limit 5;',
    ],
  },
  {
    id: 'adibou-et-l-ombre-verte-playstation',
    queries: [
      "fields name,cover.image_id,platforms.id; search \"Adibou et l'Ombre Verte\"; where platforms = (7); limit 5;",
      'fields name,cover.image_id; search "Adibou Ombre Verte"; limit 5;',
    ],
  },
  {
    id: 'air-hockey-playstation',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Air Hockey"; where platforms = (7); limit 5;',
      'fields name,cover.image_id; search "Air Hockey"; limit 5;',
    ],
  },
  {
    id: 'aitakute-your-smiles-in-my-heart-playstation',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Aitakute Your Smiles in My Heart"; where platforms = (7); limit 5;',
      'fields name,cover.image_id; search "Aitakute Your Smiles in My Heart"; limit 5;',
    ],
  },
  {
    id: 'all-star-racing-2-playstation',
    queries: [
      'fields name,cover.image_id,platforms.id; search "All Star Racing 2"; where platforms = (7); limit 5;',
      'fields name,cover.image_id; search "All Star Racing 2"; limit 5;',
    ],
  },
  {
    id: 'alnam-no-kiba-juzoku-junishinto-densetsu-playstation',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Alnam no Kiba"; where platforms = (7); limit 5;',
      'fields name,cover.image_id; search "Alnam no Kiba"; limit 5;',
    ],
  },
  {
    id: 'alnam-no-tsubasa-shoujin-no-sora-no-kanata-e-playstation',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Alnam no Tsubasa"; where platforms = (7); limit 5;',
      'fields name,cover.image_id; search "Alnam no Tsubasa"; limit 5;',
    ],
  },
  {
    id: 'angelique-tenku-no-requiem-playstation',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Angelique Tenku no Requiem"; where platforms = (7); limit 5;',
      // text search misses it; try where name~ (confirmed IGDB name: "Angelique Tenkuu no Requiem", id 79452)
      'fields name,cover.image_id,platforms.id; where platforms=(7) & name ~ *"Angelique"* & name ~ *"Requiem"*; limit 5;',
      'fields name,cover.image_id,platforms.id; where name ~ *"Angelique"* & name ~ *"Requiem"*; limit 5;',
    ],
  },
  {
    id: 'ao-no-6-gou-antarctica-playstation',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Ao no 6-gou Antarctica"; where platforms = (7); limit 5;',
      'fields name,cover.image_id; search "Ao no 6-gou"; limit 5;',
    ],
  },
  {
    id: 'apocalypse-playstation',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Apocalypse"; where platforms = (7); limit 5;',
      'fields name,cover.image_id; search "Apocalypse"; limit 5;',
    ],
  },

  // ── PlayStation 2 (8) ─────────────────────────────────────────────────────
  {
    id: 'hack-g-u-vol-1-rebirth-playstation-2',
    queries: [
      // text search misses .hack titles; use where name~ instead
      'fields name,cover.image_id,platforms.id; where platforms=(8) & name ~ *"hack"* & name ~ *"G.U."* & name ~ *"Rebirth"*; limit 5;',
      'fields name,cover.image_id,platforms.id; where platforms=(8) & name ~ *"hack"* & name ~ *"G.U."*; limit 5;',
    ],
  },
  {
    id: 'hack-g-u-vol-2-reminisce-playstation-2',
    queries: [
      'fields name,cover.image_id,platforms.id; where platforms=(8) & name ~ *"hack"* & name ~ *"G.U."* & name ~ *"Reminisce"*; limit 5;',
      'fields name,cover.image_id,platforms.id; where platforms=(8) & name ~ *"hack"* & name ~ *"G.U."*; limit 5;',
    ],
  },
  {
    id: 'hack-g-u-vol-3-redemption-playstation-2',
    queries: [
      'fields name,cover.image_id,platforms.id; where platforms=(8) & name ~ *"hack"* & name ~ *"G.U."* & name ~ *"Redemption"*; limit 5;',
      'fields name,cover.image_id,platforms.id; where platforms=(8) & name ~ *"hack"* & name ~ *"G.U."*; limit 5;',
    ],
  },
  {
    id: '120-en-no-haru-120-yen-stories-playstation-2',
    queries: [
      'fields name,cover.image_id,platforms.id; search "120 Yen no Haru"; where platforms = (8); limit 5;',
      'fields name,cover.image_id; search "120 Yen no Haru"; limit 5;',
    ],
  },
  {
    id: '2nd-super-robot-wars-alpha-playstation-2',
    queries: [
      'fields name,cover.image_id,platforms.id; search "2nd Super Robot Wars Alpha"; where platforms = (8); limit 5;',
      'fields name,cover.image_id; search "2nd Super Robot Wars Alpha"; limit 5;',
    ],
  },
  {
    id: '3rd-super-robot-wars-alpha-to-the-end-of-the-galaxy-playstation-2',
    queries: [
      'fields name,cover.image_id,platforms.id; search "3rd Super Robot Wars Alpha"; where platforms = (8); limit 5;',
      'fields name,cover.image_id; search "3rd Super Robot Wars Alpha"; limit 5;',
    ],
  },
  {
    id: 'abarenbo-princess-playstation-2',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Abarenbo Princess"; where platforms = (8); limit 5;',
      'fields name,cover.image_id; search "Abarenbo Princess"; limit 5;',
    ],
  },

  // ── Sega Genesis (29) ─────────────────────────────────────────────────────
  {
    id: '16-tile-mah-jongg-sega-genesis',
    queries: [
      'fields name,cover.image_id,platforms.id; search "16 Tile Mah-Jong"; where platforms = (29); limit 5;',
      'fields name,cover.image_id,platforms.id; search "16-Tile Mah Jongg"; where platforms = (29); limit 5;',
      'fields name,cover.image_id; search "16 Tile Mah Jong"; limit 5;',
    ],
  },
  {
    id: 'a-q-renkan-awa-sega-genesis',
    queries: [
      'fields name,cover.image_id,platforms.id; search "AQ Renkan Awa"; where platforms = (29); limit 5;',
      'fields name,cover.image_id; search "AQ Renkan Awa"; limit 5;',
    ],
  },
  {
    id: 'anetto-futatabi-sega-genesis',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Anetto Futatabi"; where platforms = (29); limit 5;',
      'fields name,cover.image_id; search "Anetto Futatabi"; limit 5;',
    ],
  },
  {
    id: 'awogue-sega-genesis',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Awogue"; where platforms = (29); limit 5;',
      'fields name,cover.image_id; search "Awogue"; limit 5;',
    ],
  },
  {
    id: 'battle-mania-daiginjo-sega-genesis',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Battle Mania Daiginjou"; limit 5;',
      'fields name,cover.image_id,platforms.id; search "Trouble Shooter"; where platforms = (29); limit 5;',
      'fields name,cover.image_id,platforms.id; search "Battle Mania Daiginjo"; where platforms = (29); limit 5;',
    ],
  },
  {
    id: 'bio-evil-sega-mega-drive-tech-demo-sega-genesis',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Bio Evil"; where platforms = (29); limit 5;',
      'fields name,cover.image_id; search "Bio Evil"; limit 5;',
    ],
  },
  {
    id: 'story-of-thor-sega-genesis',
    queries: [
      'fields name,cover.image_id,platforms.id; search "The Story of Thor"; where platforms = (29); limit 5;',
      'fields name,cover.image_id,platforms.id; search "Beyond Oasis"; where platforms = (29); limit 5;',
      'fields name,cover.image_id; search "The Story of Thor"; limit 5;',
      'fields name,cover.image_id; search "Beyond Oasis"; limit 5;',
    ],
  },

  // ── Sega Saturn (32) ──────────────────────────────────────────────────────
  {
    id: '3-3-eyes-kyusei-koshu-sega-saturn',
    queries: [
      'fields name,cover.image_id,platforms.id; search "3x3 Eyes Kyusei Koshu"; where platforms = (32); limit 5;',
      'fields name,cover.image_id; search "3x3 Eyes Kyusei Koshu"; limit 5;',
    ],
  },
  {
    id: 'daiboken-saint-elmo-s-no-kiseki-sega-saturn',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Daiboken Saint Elmo no Kiseki"; where platforms = (32); limit 5;',
      'fields name,cover.image_id; search "Daiboken Saint Elmo no Kiseki"; limit 5;',
    ],
  },
  {
    id: 'daytona-usa-c-c-e-net-link-edition-sega-saturn',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Daytona USA CCE"; where platforms = (32); limit 5;',
      'fields name,cover.image_id,platforms.id; search "Daytona USA C.C.E."; where platforms = (32); limit 5;',
      'fields name,cover.image_id; search "Daytona USA CCE Net Link"; limit 5;',
    ],
  },
  {
    id: 'discworld-ii-missing-presumed-sega-saturn',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Discworld II"; where platforms = (32); limit 5;',
      'fields name,cover.image_id; search "Discworld II"; limit 5;',
    ],
  },

  // ── Super Nintendo (19) ───────────────────────────────────────────────────
  {
    id: '3-3-eyes-juma-hokan-super-nintendo',
    queries: [
      'fields name,cover.image_id,platforms.id; search "3x3 Eyes Juma Hokan"; where platforms = (19); limit 5;',
      'fields name,cover.image_id; search "3x3 Eyes Juma Hokan"; limit 5;',
    ],
  },
  {
    id: '3-3-eyes-seima-korinden-super-nintendo',
    queries: [
      'fields name,cover.image_id,platforms.id; search "3x3 Eyes Seima Korinden"; where platforms = (19); limit 5;',
      'fields name,cover.image_id; search "3x3 Eyes Seima Korinden"; limit 5;',
    ],
  },
  {
    id: 'ancient-magic-bazoe-mahou-sekai-super-nintendo',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Ancient Magic"; where platforms = (19); limit 5;',
      'fields name,cover.image_id; search "Ancient Magic Bazoe Mahou Sekai"; limit 5;',
      'fields name,cover.image_id; search "Ancient Magic"; limit 5;',
    ],
  },
  {
    id: 'armored-police-metal-jack-super-nintendo',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Metal Jack"; where platforms = (19); limit 5;',
      'fields name,cover.image_id,platforms.id; search "Armored Police Metal Jack"; where platforms = (19); limit 5;',
      'fields name,cover.image_id; search "Metal Jack"; limit 5;',
    ],
  },
  {
    id: 'bakushou-kinsey-gekijou-super-nintendo',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Bakushou Kinsey Gekijou"; where platforms = (19); limit 5;',
      'fields name,cover.image_id; search "Bakushou Kinsey Gekijou"; limit 5;',
    ],
  },
  {
    id: 'bishojo-senshi-sailor-moon-another-story-super-nintendo',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Bishoujo Senshi Sailor Moon Another Story"; where platforms = (19); limit 5;',
      'fields name,cover.image_id,platforms.id; search "Sailor Moon Another Story"; where platforms = (19); limit 5;',
      'fields name,cover.image_id; search "Sailor Moon Another Story"; limit 5;',
    ],
  },

  // ── WonderSwan (57) ───────────────────────────────────────────────────────
  {
    id: 'dicing-knight-period-wonderswan',
    queries: [
      'fields name,cover.image_id,platforms.id; search "Dicing Knight Period"; where platforms = (57); limit 5;',
      'fields name,cover.image_id; search "Dicing Knight Period"; limit 5;',
      'fields name,cover.image_id; search "Dicing Knight"; limit 5;',
    ],
  },
]

// --- HTTP helpers ---

function httpsPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': headers['Content-Type'] || 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        ...headers,
      },
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) })
        } catch (e) {
          resolve({ status: res.statusCode, body: data })
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// --- Token fetch ---

async function fetchToken() {
  const body = `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`
  const res = await httpsPost(
    'https://id.twitch.tv/oauth2/token',
    body,
    { 'Content-Type': 'application/x-www-form-urlencoded' }
  )
  if (res.status !== 200 || !res.body.access_token) {
    throw new Error(`Token fetch failed: ${JSON.stringify(res.body)}`)
  }
  return res.body.access_token
}

// --- IGDB query ---

async function runIGDBQuery(token, query) {
  const res = await httpsPost(
    'https://api.igdb.com/v4/games',
    query,
    {
      'Content-Type': 'text/plain',
      'Client-ID': CLIENT_ID,
      'Authorization': `Bearer ${token}`,
    }
  )
  if (res.status !== 200) {
    throw new Error(`IGDB error ${res.status}: ${JSON.stringify(res.body)}`)
  }
  return res.body // array of game objects
}

/**
 * Try each query in order, return the first result that has a cover.image_id.
 */
async function findCover(token, gameId, queries) {
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i]
    const results = await runIGDBQuery(token, query)
    const withCover = Array.isArray(results)
      ? results.find((r) => r.cover && r.cover.image_id)
      : null
    if (withCover) {
      return { result: withCover, queryIndex: i }
    }
    if (i < queries.length - 1) await sleep(250)
  }
  return null
}

// --- DB helpers ---

function hasCoverAlready(db, gameId) {
  const row = db.prepare('SELECT cover_url FROM games WHERE id = ?').get(gameId)
  return row && row.cover_url != null && row.cover_url !== ''
}

function applyToDB(db, gameId, coverUrl) {
  db.prepare('UPDATE games SET cover_url = ? WHERE id = ? AND (cover_url IS NULL OR cover_url = \'\')').run(coverUrl, gameId)

  const existing = db.prepare(
    "SELECT id FROM media_references WHERE entity_type='game' AND entity_id=? AND media_type='cover'"
  ).get(gameId)

  if (!existing) {
    db.prepare(`
      INSERT INTO media_references
        (entity_type, entity_id, media_type, url, provider, compliance_status,
         storage_mode, license_status, ui_allowed, healthcheck_status, source_context)
      VALUES
        ('game', ?, 'cover', ?, 'igdb', 'approved_with_review',
         'external_reference', 'reference_only', 1, 'unchecked', 'igdb_cover_fetch_pass2')
    `).run(gameId, coverUrl)
  } else {
    db.prepare(
      "UPDATE media_references SET url=?, provider='igdb', source_context='igdb_cover_fetch_pass2', updated_at=CURRENT_TIMESTAMP WHERE id=?"
    ).run(coverUrl, existing.id)
  }
}

// --- Main ---

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`)
  console.log(`Processing ${GAMES.length} games...\n`)

  const token = await fetchToken()
  console.log('IGDB token obtained.\n')

  const db = new Database(DB_PATH)

  const found = []
  const skipped = []
  const notFound = []

  for (const game of GAMES) {
    // Skip if cover already exists
    if (hasCoverAlready(db, game.id)) {
      console.log(`[SKIP]  ${game.id} — cover already set`)
      skipped.push(game.id)
      continue
    }

    try {
      const hit = await findCover(token, game.id, game.queries)

      if (hit) {
        const { result, queryIndex } = hit
        const coverUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big/${result.cover.image_id}.jpg`
        console.log(`[FOUND] ${game.id}`)
        console.log(`        IGDB match: "${result.name}" (query #${queryIndex + 1}) → ${coverUrl}`)
        found.push({ id: game.id, coverUrl, igdbName: result.name, queryIndex })

        if (APPLY) {
          applyToDB(db, game.id, coverUrl)
          console.log(`        Written to DB.`)
        }
      } else {
        console.log(`[MISS]  ${game.id} — no cover found on IGDB`)
        notFound.push(game.id)
      }
    } catch (err) {
      console.error(`[ERR]   ${game.id} — ${err.message}`)
      notFound.push(game.id)
    }

    await sleep(250)
  }

  db.close()

  console.log('\n========== SUMMARY ==========')
  console.log(`Found:     ${found.length}`)
  console.log(`Skipped (already had cover): ${skipped.length}`)
  console.log(`Not found: ${notFound.length}`)

  if (found.length > 0) {
    console.log('\nCovers found:')
    for (const g of found) {
      console.log(`  + ${g.id}`)
      console.log(`    "${g.igdbName}"`)
    }
  }

  if (notFound.length > 0) {
    console.log('\nGames not found:')
    for (const id of notFound) {
      console.log(`  - ${id}`)
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
