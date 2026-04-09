'use strict'

const { DataTypes, Sequelize } = require('sequelize')

const {
  PRICE_SOURCE_SEED_ROWS,
} = require('../src/services/market/source-registry')

async function describeTableSafe(queryInterface, tableName) {
  try {
    return await queryInterface.describeTable(tableName)
  } catch (error) {
    const message = String(error?.message || '').toLowerCase()
    if (
      message.includes('does not exist')
      || message.includes('no such table')
      || message.includes('no description found')
    ) {
      return null
    }
    throw error
  }
}

async function tableExists(queryInterface, tableName) {
  return Boolean(await describeTableSafe(queryInterface, tableName))
}

async function addColumnIfMissing(queryInterface, tableName, columnName, definition) {
  const columns = await describeTableSafe(queryInterface, tableName)
  if (!columns || columns[columnName]) {
    return
  }

  await queryInterface.addColumn(tableName, columnName, definition)
}

async function createTableIfMissing(queryInterface, tableName, definition) {
  if (await tableExists(queryInterface, tableName)) {
    return
  }

  await queryInterface.createTable(tableName, definition)
}

async function createIndexIfPossible(sequelize, sql) {
  await sequelize.query(sql)
}

async function addPostgresConstraintIfPossible(sequelize, sql) {
  if (sequelize.getDialect() !== 'postgres') {
    return
  }

  try {
    await sequelize.query(sql)
  } catch (error) {
    const message = String(error?.message || '').toLowerCase()
    if (message.includes('already exists')) {
      return
    }
    throw error
  }
}

async function createPriceSourcesTable(queryInterface) {
  await createTableIfMissing(queryInterface, 'price_sources', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    market_bucket: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    source_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    reliability_weight: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    default_currency: {
      type: DataTypes.STRING(8),
      allowNull: true,
    },
    compliance_status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'approved_with_review',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    is_primary_sold_truth: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    publish_eligible: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  })
}

async function createPriceIngestRunsTable(queryInterface) {
  await createTableIfMissing(queryInterface, 'price_ingest_runs', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    source_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    source_market: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    finished_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    fetched_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    normalized_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    inserted_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    deduped_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    matched_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    rejected_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    published_games_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    error_summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  })
}

async function createPriceRejectionsTable(queryInterface) {
  await createTableIfMissing(queryInterface, 'price_rejections', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    source_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    source_market: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    listing_reference: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    title_raw: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rejection_reason: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    rejection_stage: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    raw_payload: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  })
}

async function addPriceHistoryColumns(queryInterface) {
  await addColumnIfMissing(queryInterface, 'price_history', 'source_id', {
    type: DataTypes.INTEGER,
    allowNull: true,
  })
  await addColumnIfMissing(queryInterface, 'price_history', 'source_market', {
    type: DataTypes.STRING,
    allowNull: true,
  })
  await addColumnIfMissing(queryInterface, 'price_history', 'is_real_sale', {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  })
  await addColumnIfMissing(queryInterface, 'price_history', 'sale_type', {
    type: DataTypes.STRING,
    allowNull: true,
  })
  await addColumnIfMissing(queryInterface, 'price_history', 'listing_reference', {
    type: DataTypes.STRING,
    allowNull: true,
  })
  await addColumnIfMissing(queryInterface, 'price_history', 'sold_at', {
    type: DataTypes.DATE,
    allowNull: true,
  })
  await addColumnIfMissing(queryInterface, 'price_history', 'currency', {
    type: DataTypes.STRING(8),
    allowNull: true,
  })
  await addColumnIfMissing(queryInterface, 'price_history', 'price_original', {
    type: DataTypes.FLOAT,
    allowNull: true,
  })
  await addColumnIfMissing(queryInterface, 'price_history', 'price_eur', {
    type: DataTypes.FLOAT,
    allowNull: true,
  })
  await addColumnIfMissing(queryInterface, 'price_history', 'title_raw', {
    type: DataTypes.TEXT,
    allowNull: true,
  })
  await addColumnIfMissing(queryInterface, 'price_history', 'condition_normalized', {
    type: DataTypes.STRING,
    allowNull: true,
  })
  await addColumnIfMissing(queryInterface, 'price_history', 'normalized_region', {
    type: DataTypes.STRING,
    allowNull: true,
  })
  await addColumnIfMissing(queryInterface, 'price_history', 'country_code', {
    type: DataTypes.STRING(8),
    allowNull: true,
  })
  await addColumnIfMissing(queryInterface, 'price_history', 'match_confidence', {
    type: DataTypes.FLOAT,
    allowNull: true,
  })
  await addColumnIfMissing(queryInterface, 'price_history', 'source_confidence', {
    type: DataTypes.FLOAT,
    allowNull: true,
  })
  await addColumnIfMissing(queryInterface, 'price_history', 'payload_hash', {
    type: DataTypes.STRING(128),
    allowNull: true,
  })
  await addColumnIfMissing(queryInterface, 'price_history', 'raw_payload', {
    type: DataTypes.TEXT,
    allowNull: true,
  })
}

async function addGamesColumns(queryInterface) {
  await addColumnIfMissing(queryInterface, 'games', 'price_confidence_tier', {
    type: DataTypes.STRING,
    allowNull: true,
  })
  await addColumnIfMissing(queryInterface, 'games', 'price_confidence_reason', {
    type: DataTypes.TEXT,
    allowNull: true,
  })
}

async function seedPriceSources(sequelize) {
  const dialect = sequelize.getDialect()

  for (const source of PRICE_SOURCE_SEED_ROWS) {
    const replacements = {
      slug: source.slug,
      name: source.name,
      marketBucket: source.marketBucket,
      sourceType: source.sourceType,
      reliabilityWeight: source.reliabilityWeight,
      defaultCurrency: source.defaultCurrency,
      complianceStatus: source.complianceStatus,
      isActive: source.isActive ? 1 : 0,
      isPrimarySoldTruth: source.isPrimarySoldTruth ? 1 : 0,
      publishEligible: source.publishEligible ? 1 : 0,
      notes: source.notes || null,
      now: new Date().toISOString(),
    }

    if (dialect === 'postgres') {
      await sequelize.query(
        `INSERT INTO price_sources (
          slug,
          name,
          market_bucket,
          source_type,
          reliability_weight,
          default_currency,
          compliance_status,
          is_active,
          is_primary_sold_truth,
          publish_eligible,
          notes,
          created_at,
          updated_at
        ) VALUES (
          :slug,
          :name,
          :marketBucket,
          :sourceType,
          :reliabilityWeight,
          :defaultCurrency,
          :complianceStatus,
          :isActive,
          :isPrimarySoldTruth,
          :publishEligible,
          :notes,
          :now,
          :now
        )
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          market_bucket = EXCLUDED.market_bucket,
          source_type = EXCLUDED.source_type,
          reliability_weight = EXCLUDED.reliability_weight,
          default_currency = EXCLUDED.default_currency,
          compliance_status = EXCLUDED.compliance_status,
          is_active = EXCLUDED.is_active,
          is_primary_sold_truth = EXCLUDED.is_primary_sold_truth,
          publish_eligible = EXCLUDED.publish_eligible,
          notes = EXCLUDED.notes,
          updated_at = EXCLUDED.updated_at`,
        { replacements }
      )
    } else {
      await sequelize.query(
        `INSERT OR IGNORE INTO price_sources (
          slug,
          name,
          market_bucket,
          source_type,
          reliability_weight,
          default_currency,
          compliance_status,
          is_active,
          is_primary_sold_truth,
          publish_eligible,
          notes,
          created_at,
          updated_at
        ) VALUES (
          :slug,
          :name,
          :marketBucket,
          :sourceType,
          :reliabilityWeight,
          :defaultCurrency,
          :complianceStatus,
          :isActive,
          :isPrimarySoldTruth,
          :publishEligible,
          :notes,
          :now,
          :now
        )`,
        { replacements }
      )
    }
  }
}

async function backfillPriceHistory(sequelize) {
  const dialect = sequelize.getDialect()
  const rows = await sequelize.query(
    `SELECT id, source, sale_date, price, condition, listing_title
     FROM price_history`,
    { type: Sequelize.QueryTypes.SELECT }
  ).catch(() => [])

  if (!Array.isArray(rows) || !rows.length) {
    return
  }

  for (const row of rows) {
    const lowerSource = String(row.source || '').trim().toLowerCase()
    const sourceSlug = lowerSource === 'ebay'
      ? 'ebay'
      : lowerSource === 'pricecharting'
        ? 'pricecharting_calibration'
        : null

    const replacements = {
      id: row.id,
      sourceSlug,
      isRealSale: sourceSlug === 'ebay' ? 1 : 0,
      saleType: sourceSlug === 'ebay' ? 'auction' : sourceSlug ? 'realized_price' : null,
      soldAt: row.sale_date || null,
      currency: 'USD',
      priceOriginal: row.price || null,
      priceEur: null,
      titleRaw: row.listing_title || null,
      conditionNormalized: row.condition || null,
      matchConfidence: null,
      sourceConfidence: null,
    }

    const updateSql = dialect === 'postgres'
      ? `UPDATE price_history ph
         SET source_id = COALESCE(ph.source_id, ps.id),
             source_market = COALESCE(ph.source_market, ps.market_bucket),
             is_real_sale = COALESCE(ph.is_real_sale, CAST(:isRealSale AS BOOLEAN)),
             sale_type = COALESCE(ph.sale_type, :saleType),
             sold_at = COALESCE(ph.sold_at, :soldAt),
             currency = COALESCE(ph.currency, :currency),
             price_original = COALESCE(ph.price_original, :priceOriginal),
             price_eur = COALESCE(ph.price_eur, :priceEur),
             title_raw = COALESCE(ph.title_raw, :titleRaw),
             condition_normalized = COALESCE(ph.condition_normalized, :conditionNormalized),
             match_confidence = COALESCE(ph.match_confidence, :matchConfidence),
             source_confidence = COALESCE(ph.source_confidence, :sourceConfidence)
         FROM price_sources ps
         WHERE ph.id = :id
           AND ps.slug = :sourceSlug`
      : `UPDATE price_history
         SET source_id = COALESCE(source_id, (SELECT id FROM price_sources WHERE slug = :sourceSlug LIMIT 1)),
             source_market = COALESCE(source_market, (SELECT market_bucket FROM price_sources WHERE slug = :sourceSlug LIMIT 1)),
             is_real_sale = COALESCE(is_real_sale, :isRealSale),
             sale_type = COALESCE(sale_type, :saleType),
             sold_at = COALESCE(sold_at, :soldAt),
             currency = COALESCE(currency, :currency),
             price_original = COALESCE(price_original, :priceOriginal),
             price_eur = COALESCE(price_eur, :priceEur),
             title_raw = COALESCE(title_raw, :titleRaw),
             condition_normalized = COALESCE(condition_normalized, :conditionNormalized),
             match_confidence = COALESCE(match_confidence, :matchConfidence),
             source_confidence = COALESCE(source_confidence, :sourceConfidence)
         WHERE id = :id`

    if (sourceSlug) {
      await sequelize.query(updateSql, { replacements })
    }
  }
}

module.exports = {
  id: '20260409_014_real_sold_price_pipeline',
  description: 'Add real sold price pipeline schema, source registry, run tracking, and audit fields',
  up: async ({ sequelize }) => {
    const queryInterface = sequelize.getQueryInterface()

    await createPriceSourcesTable(queryInterface)
    await createPriceIngestRunsTable(queryInterface)
    await createPriceRejectionsTable(queryInterface)
    await addPriceHistoryColumns(queryInterface)
    await addGamesColumns(queryInterface)
    await seedPriceSources(sequelize)
    await backfillPriceHistory(sequelize)

    await createIndexIfPossible(sequelize, 'CREATE INDEX IF NOT EXISTS idx_price_sources_slug ON price_sources(slug)')
    await createIndexIfPossible(sequelize, 'CREATE INDEX IF NOT EXISTS idx_price_sources_bucket_active ON price_sources(market_bucket, is_active)')
    await createIndexIfPossible(sequelize, 'CREATE INDEX IF NOT EXISTS idx_price_ingest_runs_source_started ON price_ingest_runs(source_id, started_at)')
    await createIndexIfPossible(sequelize, 'CREATE INDEX IF NOT EXISTS idx_price_ingest_runs_status_started ON price_ingest_runs(status, started_at)')
    await createIndexIfPossible(sequelize, 'CREATE INDEX IF NOT EXISTS idx_price_rejections_source_stage ON price_rejections(source_id, rejection_stage)')
    await createIndexIfPossible(sequelize, 'CREATE INDEX IF NOT EXISTS idx_price_history_source_market_sold_at ON price_history(source_market, sold_at)')
    await createIndexIfPossible(sequelize, 'CREATE INDEX IF NOT EXISTS idx_price_history_normalized_region_game_sold_at ON price_history(normalized_region, game_id, sold_at)')
    await createIndexIfPossible(sequelize, 'CREATE INDEX IF NOT EXISTS idx_price_history_game_condition_sold_at ON price_history(game_id, condition_normalized, sold_at)')
    await createIndexIfPossible(sequelize, 'CREATE INDEX IF NOT EXISTS idx_price_history_payload_hash ON price_history(payload_hash)')
    await createIndexIfPossible(sequelize, 'CREATE INDEX IF NOT EXISTS idx_price_history_listing_reference ON price_history(listing_reference)')

    await addPostgresConstraintIfPossible(
      sequelize,
      `ALTER TABLE price_history
       ADD CONSTRAINT price_history_sale_type_check
       CHECK (sale_type IS NULL OR sale_type IN ('auction', 'fixed_price_sold', 'realized_price'))`
    )
    await addPostgresConstraintIfPossible(
      sequelize,
      `ALTER TABLE price_history
       ADD CONSTRAINT price_history_condition_normalized_check
       CHECK (condition_normalized IS NULL OR condition_normalized IN ('Loose', 'CIB', 'Mint'))`
    )
    await addPostgresConstraintIfPossible(
      sequelize,
      `ALTER TABLE price_history
       ADD CONSTRAINT price_history_normalized_region_check
       CHECK (normalized_region IS NULL OR normalized_region IN ('PAL', 'NTSC-U', 'NTSC-J', 'NTSC-B', 'MULTI', 'unknown'))`
    )
    await addPostgresConstraintIfPossible(
      sequelize,
      `ALTER TABLE games
       ADD CONSTRAINT games_price_confidence_tier_check
       CHECK (price_confidence_tier IS NULL OR price_confidence_tier IN ('high', 'medium', 'low', 'unknown'))`
    )
    await addPostgresConstraintIfPossible(
      sequelize,
      `ALTER TABLE price_history
       ADD CONSTRAINT price_history_source_listing_unique
       UNIQUE (source_id, listing_reference)`
    )
  },
}
