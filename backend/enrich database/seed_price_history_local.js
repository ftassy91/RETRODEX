'use strict';

const { QueryTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { DB_PATH } = require('../src/config/paths');

const DRY = process.argv.includes('--dry-run');

const MARKET = {
  'Sega Saturn': { trend: 0.08, vol: 0.15 },
  'Neo Geo': { trend: 0.06, vol: 0.12 },
  'TurboGrafx-16': { trend: 0.07, vol: 0.14 },
  'Dreamcast': { trend: 0.06, vol: 0.13 },
  'Super Nintendo': { trend: 0.05, vol: 0.12 },
  'Nintendo 64': { trend: 0.05, vol: 0.11 },
  'Sega Genesis': { trend: 0.04, vol: 0.10 },
  NES: { trend: 0.04, vol: 0.12 },
  'Nintendo Entertainment System': { trend: 0.04, vol: 0.12 },
  'Game Boy': { trend: 0.04, vol: 0.10 },
  'Game Boy Color': { trend: 0.05, vol: 0.12 },
  'Game Boy Advance': { trend: 0.06, vol: 0.13 },
  'PlayStation': { trend: 0.03, vol: 0.09 },
  'PlayStation 2': { trend: 0.04, vol: 0.10 },
};

const COND_MULT = {
  LEGENDARY: { loose: 1.0, cib: 1.55, mint: 2.10 },
  EPIC: { loose: 1.0, cib: 1.65, mint: 2.40 },
  RARE: { loose: 1.0, cib: 1.70, mint: 2.60 },
  UNCOMMON: { loose: 1.0, cib: 1.75, mint: 2.80 },
  COMMON: { loose: 1.0, cib: 1.80, mint: 3.00 },
};

const SALES_PER_MONTH = {
  LEGENDARY: [0, 1],
  EPIC: [1, 2],
  RARE: [1, 3],
  UNCOMMON: [2, 5],
  COMMON: [3, 8],
};

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickCondition(rarity) {
  const roll = Math.random();
  if (rarity === 'LEGENDARY') return roll < 0.65 ? 'loose' : roll < 0.90 ? 'cib' : 'mint';
  if (rarity === 'EPIC') return roll < 0.60 ? 'loose' : roll < 0.88 ? 'cib' : 'mint';
  return roll < 0.50 ? 'loose' : roll < 0.80 ? 'cib' : 'mint';
}

function generateHistory(game) {
  const base = Number(game.loose_price) || Number(game.cib_price) || Number(game.mint_price) || 0;
  if (!base || base <= 0) {
    return [];
  }

  const params = MARKET[game.console] || { trend: 0.04, vol: 0.11 };
  const multipliers = COND_MULT[game.rarity] || COND_MULT.COMMON;
  const salesRange = SALES_PER_MONTH[game.rarity] || SALES_PER_MONTH.COMMON;
  const now = new Date();
  const entries = [];

  for (let monthsBack = 27; monthsBack >= 0; monthsBack -= 1) {
    const monthDate = new Date(now);
    monthDate.setMonth(monthDate.getMonth() - monthsBack);

    const trendFactor = Math.pow(1 + params.trend, monthsBack / 12);
    const baseAtMonth = base / trendFactor;
    const count = rand(salesRange[0], salesRange[1]);

    for (let saleIndex = 0; saleIndex < count; saleIndex += 1) {
      const condition = pickCondition(game.rarity);
      const noise = 1 + (Math.random() * 2 - 1) * params.vol;
      const rawPrice = Math.max(1, Math.round(baseAtMonth * multipliers[condition] * noise * 100) / 100);
      const date = new Date(monthDate);
      date.setDate(rand(1, 28));

      const seasonal = [10, 11, 12].includes(date.getMonth() + 1) ? 1.05 : 1.0;
      const price = Math.round(rawPrice * seasonal * 100) / 100;

      entries.push({
        game_id: game.id,
        price,
        condition,
        sale_date: date.toISOString().slice(0, 10),
        source: 'seed_local',
        listing_title: `${game.title} - ${condition.toUpperCase()} - ${game.console}`,
      });
    }
  }

  return entries;
}

async function ensurePriceHistoryTable() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      price REAL NOT NULL,
      condition TEXT CHECK(condition IN ('loose','cib','mint')) DEFAULT 'loose',
      sale_date TEXT,
      source TEXT DEFAULT 'seed',
      listing_title TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
    )
  `);

  await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_ph_game_id ON price_history(game_id)`);
  await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_ph_sale_date ON price_history(sale_date)`);
}

async function getGames() {
  return sequelize.query(
    `SELECT id, title, console, rarity, loose_price, cib_price, mint_price
     FROM games
     WHERE type = 'game'
       AND (loose_price IS NOT NULL OR cib_price IS NOT NULL OR mint_price IS NOT NULL)`,
    { type: QueryTypes.SELECT }
  );
}

async function getExistingHistoryIds() {
  const rows = await sequelize.query(
    'SELECT DISTINCT game_id FROM price_history',
    { type: QueryTypes.SELECT }
  );

  return new Set(rows.map((row) => row.game_id).filter(Boolean));
}

async function insertEntries(entries) {
  if (!entries.length || DRY) {
    return;
  }

  const batchSize = 500;
  for (let offset = 0; offset < entries.length; offset += batchSize) {
    const batch = entries.slice(offset, offset + batchSize);
    const placeholders = batch
      .map(() => '(?, ?, ?, ?, ?, ?)')
      .join(', ');
    const replacements = batch.flatMap((entry) => [
      entry.game_id,
      entry.price,
      entry.condition,
      entry.sale_date,
      entry.source,
      entry.listing_title,
    ]);

    await sequelize.query(
      `INSERT INTO price_history (game_id, price, condition, sale_date, source, listing_title)
       VALUES ${placeholders}`,
      { replacements }
    );
  }
}

async function getHistoryCount() {
  const rows = await sequelize.query(
    'SELECT COUNT(*) AS n FROM price_history',
    { type: QueryTypes.SELECT }
  );

  return Number(rows[0] && rows[0].n) || 0;
}

async function main() {
  await ensurePriceHistoryTable();
  const games = await getGames();
  const existingIds = await getExistingHistoryIds();

  console.log('\nRetroDex — Seed price_history SQLite');
  console.log(`DB: ${DB_PATH}`);
  console.log(`${games.length} games with prices`);
  if (DRY) console.log('[DRY RUN]');

  let processed = 0;
  let skipped = 0;
  let totalEntries = 0;

  for (const game of games) {
    if (existingIds.has(game.id)) {
      skipped += 1;
      continue;
    }

    const entries = generateHistory(game);
    await insertEntries(entries);
    totalEntries += entries.length;
    processed += 1;
  }

  console.log(`\n✅ Processed: ${processed} · Skipped: ${skipped} · Entries: ${totalEntries}`);
  const total = DRY ? (await getHistoryCount()) + totalEntries : await getHistoryCount();
  console.log(`price_history total: ${total}`);
}

main()
  .catch((error) => {
    console.error('Fatal:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close().catch(() => {});
  });
