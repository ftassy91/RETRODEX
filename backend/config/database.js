'use strict'

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const { Sequelize } = require('sequelize')
const { DB_PATH } = require('../src/config/paths')
const { applyResolvedSupabaseEnv } = require('../src/config/env')

const isProduction = process.env.NODE_ENV === 'production'
const allowDatabaseUrlAlias = Boolean(process.env.VERCEL || isProduction)
const { databaseUrl: resolvedDatabaseUrl } = applyResolvedSupabaseEnv()
const databaseUrl = process.env.DATABASE_URL || (allowDatabaseUrlAlias ? resolvedDatabaseUrl : null)
const hasDatabaseUrl = !!databaseUrl

let sequelize

if (isProduction && hasDatabaseUrl) {
  sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false },
    },
    logging: false,
  })
} else {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: DB_PATH,
    logging: false,
  })
}

function resolveSqlitePath() {
  return DB_PATH
}

module.exports = sequelize
module.exports.sequelize = sequelize
module.exports.Sequelize = Sequelize
module.exports.resolveSqlitePath = resolveSqlitePath
