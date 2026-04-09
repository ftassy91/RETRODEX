'use strict'

module.exports = {
  ...require('./contract'),
  ...require('./source-registry'),
  ...require('./normalize'),
  ...require('./match'),
  ...require('./score'),
  ...require('./connectors'),
  ...require('./observe'),
  ...require('./publish-market-snapshot'),
}
