'use strict'
require('dotenv').config({
  path: require('path').join(__dirname, '../../backend/.env')
})
const https = require('https')
const { execSync } = require('child_process')

const NOTION_TOKEN = process.env.NOTION_TOKEN
const KANBAN_DB_ID = '3de5a2f353074e90b493ede9f82e4129'

if (!NOTION_TOKEN) {
  console.log('[hook] NOTION_TOKEN not set — skip')
  process.exit(0)
}

function getLastCommit() {
  return {
    hash: execSync('git rev-parse --short HEAD').toString().trim(),
    message: execSync('git log -1 --pretty=%s').toString().trim(),
    date: execSync('git log -1 --pretty=%ci').toString().trim().slice(0, 10),
    branch: execSync('git rev-parse --abbrev-ref HEAD').toString().trim()
  }
}

function notionPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = https.request({
      hostname: 'api.notion.com',
      path,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(d)
          if (res.statusCode && res.statusCode >= 400) {
            return reject(new Error(parsed.message || `HTTP ${res.statusCode}`))
          }
          resolve(parsed)
        } catch (_e) {
          resolve({})
        }
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

function detectPhase(msg) {
  const m = msg.toLowerCase()
  if (m.includes('encyclo') || m.includes('franchise')) return 'Encyclopedia'
  if (m.includes('market') || m.includes('price') || m.includes('trust')) return 'Market'
  if (m.includes('ui') || m.includes('html') || m.includes('css') || m.includes('style')) return 'UI'
  if (m.includes('pipeline') || m.includes('wikidata') || m.includes('seed') || m.includes('data')) return 'Data'
  if (m.includes('deploy') || m.includes('railway') || m.includes('vercel')) return 'Deploy'
  return 'Infra'
}

async function main() {
  const c = getLastCommit()
  if (c.branch !== 'feature/mvp-database-v2') {
    console.log(`[hook] skip — branche ${c.branch}`)
    process.exit(0)
  }

  console.log(`[hook] ${c.hash} — ${c.message}`)

  try {
    await notionPost('/v1/pages', {
      parent: { database_id: KANBAN_DB_ID },
      properties: {
        'T\u00e2che': { title: [{ text: { content: c.message } }] },
        'Statut': { select: { name: '\u2705 Fait' } },
        'Phase': { select: { name: detectPhase(c.message) } },
        'Commit': { rich_text: [{ text: { content: c.hash } }] },
        'Notes': { rich_text: [{ text: { content: c.date } }] }
      }
    })
    console.log('[hook] Kanban Notion mis \u00e0 jour \u2705')
  } catch (e) {
    console.log('[hook] Erreur (non-bloquant):', e.message)
  }
}

main()
