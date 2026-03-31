'use strict'

const fs = require('fs')
const path = require('path')

const AUDIT_OUTPUT_DIR = path.resolve(__dirname, '../../../../data/audit')

function ensureAuditDir() {
  if (!fs.existsSync(AUDIT_OUTPUT_DIR)) {
    fs.mkdirSync(AUDIT_OUTPUT_DIR, { recursive: true })
  }
}

async function writePass1Reports(dataset) {
  ensureAuditDir()
  const timestamp = String(dataset.generatedAt || new Date().toISOString()).replace(/[:.]/g, '-')
  const summary = {
    passKey: dataset.passKey,
    generatedAt: dataset.generatedAt,
    linkedConsoles: dataset.targetConsoleIds.length,
    profiles: dataset.profiles.length,
    states: dataset.states.length,
    events: dataset.events.length,
    slots: dataset.publicationSlots.length,
    statusCounts: dataset.states.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1
      return acc
    }, {}),
    underfilledConsoles: dataset.consoleMatrix.filter((row) => row.underfilled).map((row) => row.consoleId),
  }

  const consoleMatrixPath = path.join(AUDIT_OUTPUT_DIR, `${timestamp}_pass1_console_matrix.json`)
  const targetsPath = path.join(AUDIT_OUTPUT_DIR, `${timestamp}_pass1_targets.json`)
  const summaryPath = path.join(AUDIT_OUTPUT_DIR, `${timestamp}_curation_summary.json`)

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2))
  fs.writeFileSync(consoleMatrixPath, JSON.stringify(dataset.consoleMatrix, null, 2))
  fs.writeFileSync(targetsPath, JSON.stringify({
    states: dataset.states.filter((row) => row.is_target === 1),
    slots: dataset.publicationSlots,
  }, null, 2))

  return {
    summaryPath,
    consoleMatrixPath,
    targetsPath,
  }
}

module.exports = {
  writePass1Reports,
}
