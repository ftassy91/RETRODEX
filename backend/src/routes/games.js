'use strict'
const { Router } = require('express')
const router = Router()

router.use(require('./games-admin'))
router.use(require('./games-list'))
router.use(require('./games-detail'))

module.exports = router
