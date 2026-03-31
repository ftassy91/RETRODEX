'use strict'

const constants = require('./constants')
const heuristics = require('./heuristics')
const dataset = require('./dataset')
const persistence = require('./persistence')
const reporting = require('./reporting')

module.exports = {
  ...constants,
  ...heuristics,
  ...dataset,
  ...persistence,
  ...reporting,
}
