'use strict';

const { z } = require('zod');

const nullableString = z.string().trim().nullable().optional();
const nullableNumber = z.number().finite().nullable().optional();
const nullableInteger = z.number().int().nullable().optional();

const raritySchema = z.enum([
  'COMMON',
  'UNCOMMON',
  'RARE',
  'EPIC',
  'LEGENDARY',
]).nullable().optional();

const gameSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  console: z.string().trim().min(1),
  type: nullableString,
  year: nullableInteger,
  genre: nullableString,
  developer: nullableString,
  metascore: nullableInteger,
  rarity: raritySchema,
  loose_price: nullableNumber,
  cib_price: nullableNumber,
  mint_price: nullableNumber,
  cover_url: nullableString,
  synopsis: nullableString,
  source_confidence: nullableNumber,
  dev_anecdotes: nullableString,
  dev_team: nullableString,
  cheat_codes: nullableString,
  franch_id: nullableString,
}).passthrough();

module.exports = {
  gameSchema,
};
