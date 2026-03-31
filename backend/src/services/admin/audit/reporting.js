'use strict'
// DATA: local file writes under backend/data/audit - admin/back-office only

const fs = require('fs')
const path = require('path')

const { getLegacyCanonicalDivergenceReport } = require('./divergence')
const {
  getGameAuditEntries,
  getConsoleAuditEntries,
  getMarketAudit,
} = require('./entries')
const {
  getAuditSummary,
  getPriorityQueue,
} = require('./summary')

const AUDIT_OUTPUT_DIR = path.resolve(__dirname, '../../../../data/audit')

function ensureAuditDir() {
  if (!fs.existsSync(AUDIT_OUTPUT_DIR)) {
    fs.mkdirSync(AUDIT_OUTPUT_DIR, { recursive: true })
  }
}

async function writeAuditReports() {
  ensureAuditDir()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const [summary, games, consoles, market, priorities, divergence] = await Promise.all([
    getAuditSummary({ persist: true }),
    getGameAuditEntries({ limit: 5000, persist: true }),
    getConsoleAuditEntries({ persist: true }),
    getMarketAudit(),
    getPriorityQueue({ entityType: 'all', limit: 250, persist: true }),
    getLegacyCanonicalDivergenceReport({ limit: 500 }),
  ])

  const files = {
    summary: path.join(AUDIT_OUTPUT_DIR, `${timestamp}_summary.json`),
    games: path.join(AUDIT_OUTPUT_DIR, `${timestamp}_games.json`),
    consoles: path.join(AUDIT_OUTPUT_DIR, `${timestamp}_consoles.json`),
    market: path.join(AUDIT_OUTPUT_DIR, `${timestamp}_market.json`),
    priorities: path.join(AUDIT_OUTPUT_DIR, `${timestamp}_priorities.json`),
    divergence: path.join(AUDIT_OUTPUT_DIR, `${timestamp}_divergence.json`),
  }

  fs.writeFileSync(files.summary, JSON.stringify(summary, null, 2))
  fs.writeFileSync(files.games, JSON.stringify(games, null, 2))
  fs.writeFileSync(files.consoles, JSON.stringify(consoles, null, 2))
  fs.writeFileSync(files.market, JSON.stringify(market, null, 2))
  fs.writeFileSync(files.priorities, JSON.stringify(priorities, null, 2))
  fs.writeFileSync(files.divergence, JSON.stringify(divergence, null, 2))

  return { files, summary }
}

module.exports = {
  writeAuditReports,
}
