'use strict'

const { Router } = require('express')

const router = Router()

router.use(require('./list'))
router.use(require('./archive'))
router.use(require('./encyclopedia'))
router.use(require('./detail'))

module.exports = router
