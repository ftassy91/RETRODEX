'use strict';

const { z } = require('zod')

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

const gameSearchSchema = paginationSchema.extend({
  q: z.string().trim().max(200).optional(),
  console: z.string().trim().max(100).optional(),
  rarity: z.string().trim().max(50).optional(),
  sort: z.string().trim().max(50).optional(),
  include_trend: z.enum(['0', '1']).optional(),
})

const collectionCreateSchema = z.object({
  gameId: z.string().trim().min(1, 'gameId is required'),
  condition: z.enum(['Loose', 'CIB', 'Mint']).optional().default('Loose'),
  notes: z.string().trim().max(500).optional().nullable(),
})

const gameIdParamSchema = z.object({
  id: z.string().trim().min(1),
})

module.exports = {
  paginationSchema,
  gameSearchSchema,
  collectionCreateSchema,
  gameIdParamSchema,
}
