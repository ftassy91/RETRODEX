'use strict'

const schema = require('./schema')
const hydration = require('./hydration')
const queries = require('./queries')

module.exports = {
  ...schema,
  ...hydration,
  ...queries,
}
