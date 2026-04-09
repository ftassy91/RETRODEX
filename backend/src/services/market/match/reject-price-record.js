'use strict'

const { detectAggregateBlocks, detectRejectionReasons } = require('../normalize/rejections')

function rejectPriceRecord(rawRecord, normalizedRecord) {
  const rejectionReasons = detectRejectionReasons(rawRecord, normalizedRecord)
  const aggregateBlocks = detectAggregateBlocks(rawRecord, normalizedRecord)

  return {
    rejectionReasons,
    aggregateBlocks,
    isRejected: rejectionReasons.length > 0,
    isPublishable: rejectionReasons.length === 0 && aggregateBlocks.length === 0,
  }
}

module.exports = {
  rejectPriceRecord,
}
