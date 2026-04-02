'use strict'
// DATA: non-canonical admin/back-office route tree - mounted only in local/admin runtime

const { Router } = require('express')

const router = Router()

router.use(require('./audit'))
router.use(require('./games'))
router.use(require('./sync'))

module.exports = router
