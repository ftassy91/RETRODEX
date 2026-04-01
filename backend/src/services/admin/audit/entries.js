'use strict'
// DATA: Sequelize via ../../../database and ../../../models - admin/back-office only

module.exports = {
  ...require('./games'),
  ...require('./consoles'),
  ...require('./market'),
}
