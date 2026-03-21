'use strict'

const { Sequelize } = require('sequelize')
const pg = require('pg')
const { DB_PATH } = require('../src/config/paths')

function resolveSqlitePath() {
  return DB_PATH
}

function createSequelize() {
  const isProduction = process.env.NODE_ENV === 'production'
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL)
  const dbUrl = process.env.DATABASE_URL
  const usePostgres = isProduction && hasDatabaseUrl

  if (usePostgres) {
    const target = dbUrl.includes('@') ? dbUrl.split('@')[1] : dbUrl
    console.log('[DB] Using PostgreSQL:', target)
    return new Sequelize(dbUrl, {
      dialect: 'postgres',
      dialectModule: pg,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
      logging: false,
      define: {
        underscored: true,
      },
    })
  }

  const sqlitePath = resolveSqlitePath()
  console.log('[DB] Using SQLite:', sqlitePath)
  return new Sequelize({
    dialect: 'sqlite',
    storage: sqlitePath,
    logging: false,
    define: {
      underscored: true,
    },
  })
}

const sequelize = createSequelize()

module.exports = sequelize
module.exports.createSequelize = createSequelize
module.exports.resolveSqlitePath = resolveSqlitePath
