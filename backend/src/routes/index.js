'use strict'

const { Router } = require('express')

const router = Router()

router.use(require('./games/index'))
router.use(require('./search/index'))
router.use(require('./collection/index'))
router.use(require('./market/index'))
router.use(require('./franchises/index'))
router.use(require('./prices/index'))

module.exports = router
