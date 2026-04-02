'use strict'

module.exports = {
  ...require('./rules'),
  ...require('./scoring'),
  ...require('./evidence-service'),
  ...require('./coverage-service'),
  ...require('./target-selection-service'),
}
