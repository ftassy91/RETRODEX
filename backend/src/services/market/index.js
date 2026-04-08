'use strict'

module.exports = {
  ...require('./contract'),
  ...require('./normalize'),
  ...require('./match'),
  ...require('./score'),
  ...require('./connectors'),
  ...require('./publish-market-snapshot'),
}
