'use strict'

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const { Sequelize } = require('sequelize')
const { DB_PATH } = require('../src/config/paths')

const isProduction = process.env.NODE_ENV === 'production'
const hasDatabaseUrl = !!process.env.DATABASE_URL

let sequelize

if (isProduction && hasDatabaseUrl) {
  sequelize = new Sequelize(process.env.DATABASE_URL, {
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
