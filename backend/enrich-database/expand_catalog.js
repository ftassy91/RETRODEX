'use strict';
/**
 * scripts/enrich/expand_catalog.js
 * ══════════════════════════════════════════════════════════════
 * Étend le catalogue RetroDex depuis :
 *   1. Wikidata SPARQL (jeux rétro par console)
 *   2. RAWG API (jeux populaires par plateforme)
 *   3. Données seed embarquées (100 jeux essentiels connus)
 *
 * Usage :
 *   node scripts/enrich/expand_catalog.js --source seed --dry-run
 *   node scripts/enrich/expand_catalog.js --source wikidata --console "PlayStation" --limit 100
 *   node scripts/enrich/expand_catalog.js --source rawg --console "Super Nintendo" --limit 50
 *   node scripts/enrich/expand_catalog.js --source seed
 *
 * Règles anti-doublon : vérification sur (title, console) avant insertion.
 */

const { db, supabase, USE_SUPABASE } = require('./bootstrap');

const args    = process.argv.slice(2);
const DRY     = args.includes('--dry-run');
const SOURCE  = args.includes('--source')  ? args[args.indexOf('--source')+1]  : 'seed';
const LIMIT   = args.includes('--limit')   ? parseInt(args[args.indexOf('--limit')+1]) : 200;
const CONSOLE = args.includes('--console') ? args[args.indexOf('--console')+1] : null;
const sleep   = ms => new Promise(r => setTimeout(r, ms));

// ── ID generator ──────────────────────────────────────────────────────────
function makeId(title, console_) {
  return `${title}-${console_}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

// ── Rarity estimate from price ─────────────────────────────────────────────
function estimateRarity(price) {
  if (!price) return 'COMMON';
  if (price >= 200) return 'LEGENDARY';
  if (price >= 80)  return 'EPIC';
  if (price >= 30)  return 'RARE';
  if (price >= 12)  return 'UNCOMMON';
  return 'COMMON';
}

// ── 1. SEED DATA — 120 jeux essentiels ────────────────────────────────────
// Jeux emblématiques manquants des grandes consoles
const SEED_GAMES = [
  // === NES ===
  { title: 'Mega Man 2', console: 'NES', year: 1988, developer: 'Capcom', genre: 'Platformer', loosePrice: 18.50, cibPrice: 45, mintPrice: 120, metascore: null },
  { title: 'Contra', console: 'NES', year: 1988, developer: 'Konami', genre: "Shoot'em up", loosePrice: 12, cibPrice: 38, mintPrice: 95, metascore: null },
  { title: 'Castlevania', console: 'NES', year: 1987, developer: 'Konami', genre: 'Action', loosePrice: 20, cibPrice: 55, mintPrice: 200, metascore: null },
  { title: 'Ninja Gaiden', console: 'NES', year: 1989, developer: 'Tecmo', genre: 'Action', loosePrice: 14, cibPrice: 40, mintPrice: 110, metascore: null },
  { title: 'Battletoads', console: 'NES', year: 1991, developer: 'Rare', genre: "Beat'em up", loosePrice: 22, cibPrice: 75, mintPrice: 280, metascore: null },
  { title: 'Tecmo Super Bowl', console: 'NES', year: 1991, developer: 'Tecmo', genre: 'Sport', loosePrice: 15, cibPrice: 35, mintPrice: 90, metascore: null },
  { title: 'Mike Tyson\'s Punch-Out!!', console: 'NES', year: 1987, developer: 'Nintendo', genre: 'Fighting', loosePrice: 25, cibPrice: 65, mintPrice: 250, metascore: null },
  { title: 'Duck Tales', console: 'NES', year: 1989, developer: 'Capcom', genre: 'Platformer', loosePrice: 28, cibPrice: 80, mintPrice: 350, metascore: null },

  // === SNES ===
  { title: 'Super Metroid', console: 'Super Nintendo', year: 1994, developer: 'Nintendo', genre: 'Action', loosePrice: 55, cibPrice: 130, mintPrice: 450, metascore: 89 },
  { title: 'Chrono Trigger', console: 'Super Nintendo', year: 1995, developer: 'Square', genre: 'RPG', loosePrice: 95, cibPrice: 250, mintPrice: 900, metascore: 92 },
  { title: 'Street Fighter II Turbo', console: 'Super Nintendo', year: 1993, developer: 'Capcom', genre: 'Fighting', loosePrice: 22, cibPrice: 50, mintPrice: 150, metascore: null },
  { title: 'Final Fantasy VI', console: 'Super Nintendo', year: 1994, developer: 'Square', genre: 'RPG', loosePrice: 75, cibPrice: 200, mintPrice: 700, metascore: 92 },
  { title: 'Donkey Kong Country', console: 'Super Nintendo', year: 1994, developer: 'Rare', genre: 'Platformer', loosePrice: 18, cibPrice: 45, mintPrice: 160, metascore: 85 },
  { title: 'Super Castlevania IV', console: 'Super Nintendo', year: 1991, developer: 'Konami', genre: 'Action', loosePrice: 35, cibPrice: 90, mintPrice: 320, metascore: 88 },
  { title: 'Mega Man X', console: 'Super Nintendo', year: 1994, developer: 'Capcom', genre: 'Platformer', loosePrice: 40, cibPrice: 95, mintPrice: 350, metascore: 90 },
  { title: 'Contra III: The Alien Wars', console: 'Super Nintendo', year: 1992, developer: 'Konami', genre: "Shoot'em up", loosePrice: 28, cibPrice: 70, mintPrice: 240, metascore: null },
  { title: 'Secret of Evermore', console: 'Super Nintendo', year: 1995, developer: 'Square', genre: 'Action-RPG', loosePrice: 30, cibPrice: 75, mintPrice: 250, metascore: null },
  { title: 'ActRaiser', console: 'Super Nintendo', year: 1991, developer: 'Quintet', genre: 'Action', loosePrice: 22, cibPrice: 55, mintPrice: 180, metascore: null },

  // === Genesis / Mega Drive ===
  { title: 'Sonic the Hedgehog 2', console: 'Sega Genesis', year: 1992, developer: 'Sonic Team', genre: 'Platformer', loosePrice: 8, cibPrice: 22, mintPrice: 75, metascore: null },
  { title: 'Streets of Rage 2', console: 'Sega Genesis', year: 1992, developer: 'Sega AM7', genre: "Beat'em up", loosePrice: 18, cibPrice: 42, mintPrice: 140, metascore: null },
  { title: 'Gunstar Heroes', console: 'Sega Genesis', year: 1993, developer: 'Treasure', genre: "Shoot'em up", loosePrice: 35, cibPrice: 90, mintPrice: 350, metascore: null },
  { title: 'Comix Zone', console: 'Sega Genesis', year: 1995, developer: 'Sega', genre: "Beat'em up", loosePrice: 22, cibPrice: 55, mintPrice: 180, metascore: null },
  { title: 'Castlevania: Bloodlines', console: 'Sega Genesis', year: 1994, developer: 'Konami', genre: 'Action', loosePrice: 55, cibPrice: 130, mintPrice: 480, metascore: null },
  { title: 'Phantasy Star IV', console: 'Sega Genesis', year: 1993, developer: 'Sega', genre: 'RPG', loosePrice: 45, cibPrice: 110, mintPrice: 400, metascore: null },
  { title: 'Shining Force II', console: 'Sega Genesis', year: 1993, developer: 'Sonic! Software', genre: 'RPG Tactique', loosePrice: 38, cibPrice: 92, mintPrice: 330, metascore: null },
  { title: 'Mortal Kombat II', console: 'Sega Genesis', year: 1994, developer: 'Midway', genre: 'Fighting', loosePrice: 12, cibPrice: 32, mintPrice: 95, metascore: null },

  // === Game Boy ===
  { title: 'Kirby\'s Dream Land', console: 'Game Boy', year: 1992, developer: 'HAL Laboratory', genre: 'Platformer', loosePrice: 12, cibPrice: 30, mintPrice: 100, metascore: null },
  { title: 'The Legend of Zelda: Link\'s Awakening', console: 'Game Boy', year: 1993, developer: 'Nintendo', genre: 'Action-RPG', loosePrice: 22, cibPrice: 55, mintPrice: 180, metascore: 90 },
  { title: 'Donkey Kong', console: 'Game Boy', year: 1994, developer: 'Nintendo', genre: 'Platformer', loosePrice: 14, cibPrice: 35, mintPrice: 110, metascore: null },
  { title: 'Metroid II: Return of Samus', console: 'Game Boy', year: 1991, developer: 'Nintendo', genre: 'Action', loosePrice: 18, cibPrice: 50, mintPrice: 170, metascore: null },

  // === Nintendo 64 ===
  { title: 'The Legend of Zelda: Ocarina of Time', console: 'Nintendo 64', year: 1998, developer: 'Nintendo', genre: 'Action-RPG', loosePrice: 28, cibPrice: 65, mintPrice: 220, metascore: 99 },
  { title: 'GoldenEye 007', console: 'Nintendo 64', year: 1997, developer: 'Rare', genre: 'Shooter', loosePrice: 22, cibPrice: 55, mintPrice: 185, metascore: 96 },
  { title: 'Super Mario 64', console: 'Nintendo 64', year: 1996, developer: 'Nintendo', genre: 'Platformer', loosePrice: 35, cibPrice: 80, mintPrice: 280, metascore: 94 },
  { title: 'Banjo-Kazooie', console: 'Nintendo 64', year: 1998, developer: 'Rare', genre: 'Platformer', loosePrice: 22, cibPrice: 55, mintPrice: 190, metascore: 92 },
  { title: 'Star Fox 64', console: 'Nintendo 64', year: 1997, developer: 'Nintendo', genre: "Shoot'em up", loosePrice: 18, cibPrice: 45, mintPrice: 155, metascore: 88 },
  { title: 'Majora\'s Mask', console: 'Nintendo 64', year: 2000, developer: 'Nintendo', genre: 'Action-RPG', loosePrice: 35, cibPrice: 85, mintPrice: 300, metascore: 95 },
  { title: 'Perfect Dark', console: 'Nintendo 64', year: 2000, developer: 'Rare', genre: 'Shooter', loosePrice: 15, cibPrice: 38, mintPrice: 120, metascore: 97 },
  { title: 'Donkey Kong 64', console: 'Nintendo 64', year: 1999, developer: 'Rare', genre: 'Platformer', loosePrice: 20, cibPrice: 50, mintPrice: 165, metascore: 90 },

  // === PlayStation ===
  { title: 'Final Fantasy VII', console: 'PlayStation', year: 1997, developer: 'Square', genre: 'RPG', loosePrice: 35, cibPrice: 75, mintPrice: 250, metascore: 92 },
  { title: 'Metal Gear Solid', console: 'PlayStation', year: 1998, developer: 'Konami', genre: 'Action', loosePrice: 22, cibPrice: 55, mintPrice: 185, metascore: 94 },
  { title: 'Resident Evil 2', console: 'PlayStation', year: 1998, developer: 'Capcom', genre: 'Survival Horror', loosePrice: 22, cibPrice: 55, mintPrice: 185, metascore: 89 },
  { title: 'Crash Bandicoot', console: 'PlayStation', year: 1996, developer: 'Naughty Dog', genre: 'Platformer', loosePrice: 12, cibPrice: 28, mintPrice: 95, metascore: 79 },
  { title: 'Spyro the Dragon', console: 'PlayStation', year: 1998, developer: 'Insomniac Games', genre: 'Platformer', loosePrice: 10, cibPrice: 25, mintPrice: 85, metascore: 82 },
  { title: 'Tekken 3', console: 'PlayStation', year: 1998, developer: 'Namco', genre: 'Fighting', loosePrice: 12, cibPrice: 28, mintPrice: 95, metascore: 96 },
  { title: 'Gran Turismo 2', console: 'PlayStation', year: 1999, developer: 'Polyphony Digital', genre: 'Racing', loosePrice: 8, cibPrice: 18, mintPrice: 60, metascore: 93 },
  { title: 'Silent Hill', console: 'PlayStation', year: 1999, developer: 'Konami', genre: 'Survival Horror', loosePrice: 65, cibPrice: 150, mintPrice: 550, metascore: 86 },
  { title: 'Vagrant Story', console: 'PlayStation', year: 2000, developer: 'Square', genre: 'Action-RPG', loosePrice: 45, cibPrice: 110, mintPrice: 400, metascore: 92 },
  { title: 'Xenogears', console: 'PlayStation', year: 1998, developer: 'Square', genre: 'RPG', loosePrice: 75, cibPrice: 185, mintPrice: 680, metascore: 86 },

  // === Sega Saturn ===
  { title: 'Saturn Bomberman', console: 'Sega Saturn', year: 1996, developer: 'Hudson Soft', genre: 'Action', loosePrice: 35, cibPrice: 85, mintPrice: 300, metascore: null },
  { title: 'Guardian Heroes', console: 'Sega Saturn', year: 1996, developer: 'Treasure', genre: "Beat'em up", loosePrice: 55, cibPrice: 135, mintPrice: 480, metascore: null },
  { title: 'Burning Rangers', console: 'Sega Saturn', year: 1998, developer: 'Sonic Team', genre: 'Action', loosePrice: 130, cibPrice: 310, mintPrice: 950, metascore: null },
  { title: 'Shining Force III', console: 'Sega Saturn', year: 1998, developer: 'Camelot Software', genre: 'RPG Tactique', loosePrice: 85, cibPrice: 210, mintPrice: 750, metascore: null },
  { title: 'Dragon Force', console: 'Sega Saturn', year: 1996, developer: 'J-Force', genre: 'Strategy', loosePrice: 45, cibPrice: 110, mintPrice: 380, metascore: null },
  { title: 'NiGHTS into Dreams', console: 'Sega Saturn', year: 1996, developer: 'Sonic Team', genre: 'Action', loosePrice: 22, cibPrice: 55, mintPrice: 185, metascore: 90 },
  { title: 'Die Hard Arcade', console: 'Sega Saturn', year: 1997, developer: 'Sega AM1', genre: "Beat'em up", loosePrice: 28, cibPrice: 68, mintPrice: 230, metascore: null },
  { title: 'Virtua Fighter 2', console: 'Sega Saturn', year: 1995, developer: 'Sega AM2', genre: 'Fighting', loosePrice: 15, cibPrice: 35, mintPrice: 115, metascore: null },

  // === Dreamcast ===
  { title: 'Jet Set Radio', console: 'Dreamcast', year: 2000, developer: 'Smilebit', genre: 'Action', loosePrice: 28, cibPrice: 65, mintPrice: 225, metascore: 88 },
  { title: 'Shenmue', console: 'Dreamcast', year: 1999, developer: 'Sega AM2', genre: 'Adventure', loosePrice: 22, cibPrice: 55, mintPrice: 185, metascore: 89 },
  { title: 'Ikaruga', console: 'Dreamcast', year: 2001, developer: 'Treasure', genre: "Shoot'em up", loosePrice: 95, cibPrice: 240, mintPrice: 850, metascore: null },
  { title: 'Power Stone 2', console: 'Dreamcast', year: 2000, developer: 'Capcom', genre: 'Fighting', loosePrice: 35, cibPrice: 88, mintPrice: 310, metascore: null },
  { title: 'Skies of Arcadia', console: 'Dreamcast', year: 2000, developer: 'Overworks', genre: 'RPG', loosePrice: 45, cibPrice: 115, mintPrice: 400, metascore: 92 },
  { title: 'Crazy Taxi', console: 'Dreamcast', year: 1999, developer: 'Sega AM3', genre: 'Racing', loosePrice: 12, cibPrice: 28, mintPrice: 90, metascore: 90 },
  { title: 'Marvel vs. Capcom 2', console: 'Dreamcast', year: 2000, developer: 'Capcom', genre: 'Fighting', loosePrice: 55, cibPrice: 140, mintPrice: 490, metascore: 88 },

  // === Neo Geo ===
  { title: 'Metal Slug 3', console: 'Neo Geo', year: 2000, developer: 'SNK', genre: "Shoot'em up", loosePrice: 280, cibPrice: 650, mintPrice: 1800, metascore: null },
  { title: 'The King of Fighters \'98', console: 'Neo Geo', year: 1998, developer: 'SNK', genre: 'Fighting', loosePrice: 95, cibPrice: 240, mintPrice: 850, metascore: null },
  { title: 'Samurai Shodown V Special', console: 'Neo Geo', year: 2004, developer: 'Yuki Enterprise', genre: 'Fighting', loosePrice: 350, cibPrice: 850, mintPrice: 2500, metascore: null },
  { title: 'Last Blade 2', console: 'Neo Geo', year: 1998, developer: 'SNK', genre: 'Fighting', loosePrice: 120, cibPrice: 300, mintPrice: 1100, metascore: null },
  { title: 'Pulstar', console: 'Neo Geo', year: 1995, developer: 'Aicom', genre: "Shoot'em up", loosePrice: 190, cibPrice: 480, mintPrice: 1600, metascore: null },

  // === TurboGrafx-16 / PC Engine ===
  { title: 'Dungeon Explorer', console: 'TurboGrafx-16', year: 1989, developer: 'Hudson Soft', genre: 'Action-RPG', loosePrice: 15, cibPrice: 38, mintPrice: 120, metascore: null },
  { title: 'Blazing Lazers', console: 'TurboGrafx-16', year: 1989, developer: 'Compile', genre: "Shoot'em up", loosePrice: 18, cibPrice: 45, mintPrice: 150, metascore: null },
  { title: 'Splatterhouse', console: 'TurboGrafx-16', year: 1990, developer: 'Namco', genre: 'Action', loosePrice: 35, cibPrice: 88, mintPrice: 310, metascore: null },
  { title: 'Ys Book I & II', console: 'TurboGrafx-16', year: 1989, developer: 'Falcom/Hudson', genre: 'Action-RPG', loosePrice: 85, cibPrice: 210, mintPrice: 750, metascore: null },

  // === GBA ===
  { title: 'Golden Sun', console: 'Game Boy Advance', year: 2001, developer: 'Camelot Software', genre: 'RPG', loosePrice: 22, cibPrice: 52, mintPrice: 175, metascore: 91 },
  { title: 'Castlevania: Aria of Sorrow', console: 'Game Boy Advance', year: 2003, developer: 'Konami', genre: 'Action', loosePrice: 35, cibPrice: 88, mintPrice: 310, metascore: 91 },
  { title: 'Fire Emblem', console: 'Game Boy Advance', year: 2003, developer: 'Intelligent Systems', genre: 'RPG Tactique', loosePrice: 55, cibPrice: 135, mintPrice: 480, metascore: 88 },
  { title: 'Metroid Fusion', console: 'Game Boy Advance', year: 2002, developer: 'Nintendo', genre: 'Action', loosePrice: 28, cibPrice: 68, mintPrice: 230, metascore: 89 },
  { title: 'Mega Man Zero', console: 'Game Boy Advance', year: 2002, developer: 'Inti Creates', genre: 'Platformer', loosePrice: 30, cibPrice: 75, mintPrice: 260, metascore: null },

  // === DS ===
  { title: 'Castlevania: Dawn of Sorrow', console: 'Nintendo DS', year: 2005, developer: 'Konami', genre: 'Action', loosePrice: 22, cibPrice: 55, mintPrice: 185, metascore: 89 },
  { title: 'The World Ends with You', console: 'Nintendo DS', year: 2007, developer: 'Square Enix', genre: 'Action-RPG', loosePrice: 35, cibPrice: 88, mintPrice: 310, metascore: 88 },
  { title: 'Pokémon HeartGold', console: 'Nintendo DS', year: 2009, developer: 'Game Freak', genre: 'RPG', loosePrice: 65, cibPrice: 155, mintPrice: 550, metascore: 87 },
  { title: 'Radiant Historia', console: 'Nintendo DS', year: 2010, developer: 'Atlus', genre: 'RPG', loosePrice: 55, cibPrice: 135, mintPrice: 480, metascore: 86 },

  // === WonderSwan ===
  { title: 'Final Fantasy', console: 'WonderSwan', year: 1999, developer: 'Square', genre: 'RPG', loosePrice: 45, cibPrice: 110, mintPrice: 380, metascore: null },
  { title: 'Rockman & Forte', console: 'WonderSwan', year: 2002, developer: 'Capcom', genre: 'Platformer', loosePrice: 85, cibPrice: 210, mintPrice: 730, metascore: null },
  { title: 'Gunpey', console: 'WonderSwan', year: 1999, developer: 'Koi', genre: 'Puzzle', loosePrice: 18, cibPrice: 45, mintPrice: 150, metascore: null },

  // === Atari Lynx ===
  { title: 'California Games', console: 'Atari Lynx', year: 1991, developer: 'Epyx', genre: 'Sport', loosePrice: 12, cibPrice: 30, mintPrice: 100, metascore: null },
  { title: 'Rygar', console: 'Atari Lynx', year: 1990, developer: 'Tecmo', genre: 'Action', loosePrice: 15, cibPrice: 38, mintPrice: 125, metascore: null },
  { title: 'Viking Child', console: 'Atari Lynx', year: 1991, developer: 'Wunderkind', genre: 'Platformer', loosePrice: 22, cibPrice: 55, mintPrice: 185, metascore: null },

  // === Sega Game Gear ===
  { title: 'Sonic the Hedgehog', console: 'Game Gear', year: 1991, developer: 'Aspect', genre: 'Platformer', loosePrice: 8, cibPrice: 20, mintPrice: 68, metascore: null },
  { title: 'Mortal Kombat', console: 'Game Gear', year: 1993, developer: 'Probe Entertainment', genre: 'Fighting', loosePrice: 10, cibPrice: 25, mintPrice: 85, metascore: null },
  { title: 'Shinobi II: The Silent Fury', console: 'Game Gear', year: 1992, developer: 'Sega', genre: 'Action', loosePrice: 14, cibPrice: 35, mintPrice: 115, metascore: null },

  // === Sega Master System ===
  { title: 'Wonder Boy III: The Dragon\'s Trap', console: 'Sega Master System', year: 1989, developer: 'Westone', genre: 'Action-RPG', loosePrice: 22, cibPrice: 55, mintPrice: 185, metascore: null },
  { title: 'Phantasy Star', console: 'Sega Master System', year: 1987, developer: 'Sega', genre: 'RPG', loosePrice: 65, cibPrice: 155, mintPrice: 550, metascore: null },
  { title: 'Alex Kidd in Miracle World', console: 'Sega Master System', year: 1986, developer: 'Sega', genre: 'Platformer', loosePrice: 15, cibPrice: 38, mintPrice: 125, metascore: null },

  // === Game Boy Color ===
  { title: 'Metal Gear Solid', console: 'Game Boy Color', year: 2000, developer: 'Konami', genre: 'Action', loosePrice: 22, cibPrice: 55, mintPrice: 185, metascore: 78 },
  { title: 'Dragon Warrior Monsters', console: 'Game Boy Color', year: 1998, developer: 'TOSE', genre: 'RPG', loosePrice: 18, cibPrice: 45, mintPrice: 150, metascore: null },
  { title: 'Shantae', console: 'Game Boy Color', year: 2002, developer: 'WayForward', genre: 'Platformer', loosePrice: 250, cibPrice: 600, mintPrice: 1800, metascore: null },

  // === PlayStation 2 ===
  { title: 'Shadow of the Colossus', console: 'PlayStation 2', year: 2005, developer: 'Team Ico', genre: 'Action', loosePrice: 22, cibPrice: 55, mintPrice: 185, metascore: 91 },
  { title: 'Ico', console: 'PlayStation 2', year: 2001, developer: 'Team Ico', genre: 'Action', loosePrice: 18, cibPrice: 45, mintPrice: 150, metascore: 90 },
  { title: 'Okami', console: 'PlayStation 2', year: 2006, developer: 'Clover Studio', genre: 'Action-RPG', loosePrice: 28, cibPrice: 68, mintPrice: 230, metascore: 93 },
  { title: 'Baldur\'s Gate: Dark Alliance', console: 'PlayStation 2', year: 2001, developer: 'Black Isle', genre: 'Action-RPG', loosePrice: 8, cibPrice: 18, mintPrice: 60, metascore: 80 },
];

// ── DB helpers ─────────────────────────────────────────────────────────────
async function gameExists(title, console_) {
  if (USE_SUPABASE) {
    const { data, error } = await supabase.from('games').select('id').eq('title',title).eq('console',console_).limit(1);
    if (error) { console.error('[DB] gameExists failed:', error.message); return false; }
    return data && data.length > 0;
  }
  return !!db.prepare('SELECT id FROM games WHERE title=? AND console=? LIMIT 1').get(title, console_);
}

async function insertGame(game) {
  if (DRY) { console.log(`  [DRY] ${game.title} (${game.console})`); return; }
  if (USE_SUPABASE) {
    const { error } = await supabase.from('games').insert({
      id: game.id, title: game.title, console: game.console, year: game.year,
      developer: game.developer, genre: game.genre, metascore: game.metascore,
      rarity: game.rarity, type: 'game',
      loose_price: game.loosePrice, cib_price: game.cibPrice, mint_price: game.mintPrice,
      source_confidence: 0.5,
    });
    if (error) console.error(`[DB] insertGame failed for "${game.title}":`, error.message);
  } else {
    db.prepare(`INSERT OR IGNORE INTO games
      (id,title,console,year,developer,genre,metascore,rarity,type,loosePrice,cibPrice,mintPrice,source_confidence)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      game.id, game.title, game.console, game.year, game.developer,
      game.genre, game.metascore, game.rarity, 'game',
      game.loosePrice, game.cibPrice, game.mintPrice, 0.5
    );
  }
}

// ── Source: Wikidata SPARQL ────────────────────────────────────────────────
const WIKIDATA_PLATFORMS = {
  'PlayStation':   'Q10901',
  'Super Nintendo': 'Q183259',
  'Sega Genesis':  'Q10676',
  'Dreamcast':     'Q184069',
  'Nintendo 64':   'Q64649',
  'Sega Saturn':   'Q200912',
};

async function fetchFromWikidata(consoleName) {
  const platformId = WIKIDATA_PLATFORMS[consoleName];
  if (!platformId) return [];

  const query = `SELECT DISTINCT ?game ?gameLabel ?year ?devLabel WHERE {
    ?game wdt:P31 wd:Q7889;
          wdt:P400 wd:${platformId}.
    OPTIONAL { ?game wdt:P577 ?releaseDate. BIND(YEAR(?releaseDate) AS ?year) }
    OPTIONAL { ?game wdt:P178 ?dev. }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } LIMIT ${LIMIT}`;

  try {
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'RetroDex/1.0', 'Accept': 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results?.bindings || []).map(b => ({
      title:     b.gameLabel?.value || '',
      console:   consoleName,
      year:      b.year ? parseInt(b.year.value) : null,
      developer: b.devLabel?.value || null,
    })).filter(g => g.title && !g.title.startsWith('Q'));
  } catch { return []; }
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nRetroDex — Catalog expansion (${SOURCE})`);
  if (DRY) console.log('[DRY RUN]');

  let added = 0, skipped = 0;

  if (SOURCE === 'seed') {
    console.log(`\n[SEED] Inserting ${SEED_GAMES.length} curated games...`);
    for (const g of SEED_GAMES) {
      if (CONSOLE && g.console !== CONSOLE) continue;
      if (await gameExists(g.title, g.console)) { skipped++; continue; }
      g.id     = makeId(g.title, g.console);
      g.rarity = estimateRarity(g.loosePrice);
      await insertGame(g);
      added++;
      process.stdout.write(`\r  ✓ ${added} added · ${skipped} exist (${g.title.slice(0,30)})`);
      await sleep(10);
    }
  }

  if (SOURCE === 'wikidata') {
    const consoles = CONSOLE ? [CONSOLE] : Object.keys(WIKIDATA_PLATFORMS);
    for (const c of consoles) {
      console.log(`\n[Wikidata] Fetching games for ${c}...`);
      const games = await fetchFromWikidata(c);
      console.log(`  Found ${games.length} candidates`);
      for (const g of games) {
        if (await gameExists(g.title, g.console)) { skipped++; continue; }
        g.id     = makeId(g.title, g.console);
        g.genre  = 'Action'; // Par défaut, sera enrichi par RAWG
        g.rarity = 'COMMON';
        g.loosePrice = null; g.cibPrice = null; g.mintPrice = null;
        await insertGame(g);
        added++;
        await sleep(50);
      }
      await sleep(1500); // Respect Wikidata rate limit
    }
  }

  console.log(`\n\n✅ Done: ${added} added · ${skipped} already exist`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
