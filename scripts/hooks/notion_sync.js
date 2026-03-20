'use strict'

require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') })
const https = require('https')
const { execSync } = require('child_process')

const NOTION_TOKEN = process.env.NOTION_TOKEN || process.env.NOTION_API_KEY || ''
const DASHBOARD_ID = '3298a0e1ed2481f68090fcba4ebe962a'
const KANBAN_DB_ID = '3de5a2f353074e90b493ede9f82e4129'

if (!NOTION_TOKEN || NOTION_TOKEN === 'secret_VOTRE_TOKEN_NOTION') {
  console.log('[hook] NOTION_TOKEN not set — skip Notion sync')
  process.exit(0)
}

function getLastCommit() {
  const hash = execSync('git rev-parse --short HEAD').toString().trim()
  const message = execSync('git log -1 --pretty=%s').toString().trim()
  const date = execSync('git log -1 --pretty=%ci').toString().trim().slice(0, 10)
  const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim()
  return { hash, message, date, branch }
}

function notionRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const options = {
      hostname: 'api.notion.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }

    const req = https.request(options, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => {
        try {
          const parsed = d ? JSON.parse(d) : {}
          if (res.statusCode && res.statusCode >= 400) {
            const msg = parsed.message || `HTTP ${res.statusCode}`
            return reject(new Error(msg))
          }
          resolve(parsed)
        } catch (_e) {
          resolve({})
        }
      })
    })

    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

async function findKanbanTask(commitMsg) {
  const keywords = commitMsg
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(' ')
    .filter(w => w.length > 3)
    .slice(0, 3)

  if (keywords.length === 0) {
    return []
  }

  const res = await notionRequest('POST', '/v1/databases/' + KANBAN_DB_ID + '/query', {
    filter: {
      or: keywords.map(k => ({
        property: 'Tâche',
        title: { contains: k }
      }))
    },
    page_size: 5
  })

  return res.results || []
}

async function updateDashboard(commit) {
  await notionRequest('PATCH', `/v1/pages/${DASHBOARD_ID}`, {
    properties: {}
  })
  console.log(`[hook] Dashboard noté : ${commit.hash} — ${commit.message}`)
}

function inferPhase(message) {
  const msg = message.toLowerCase()
  let phase = 'Infra'
  if (msg.includes('ui') || msg.includes('html') || msg.includes('css')) phase = 'UI'
  else if (msg.includes('market') || msg.includes('price') || msg.includes('trust')) phase = 'Market'
  else if (msg.includes('encyclo') || msg.includes('franchise')) phase = 'Encyclopedia'
  else if (msg.includes('pipeline') || msg.includes('wikidata') || msg.includes('seed')) phase = 'Data'
  else if (msg.includes('deploy') || msg.includes('railway')) phase = 'Deploy'
  return phase
}

async function createCommitEntry(commit) {
  const phase = inferPhase(commit.message)

  await notionRequest('POST', '/v1/pages', {
    parent: { database_id: KANBAN_DB_ID },
    properties: {
      'Tâche': { title: [{ text: { content: commit.message } }] },
      'Statut': { select: { name: '✅ Fait' } },
      'Phase': { select: { name: phase } },
      'Commit': { rich_text: [{ text: { content: commit.hash } }] }
    }
  })

  console.log(`[hook] Kanban mis à jour : ${commit.hash} → ${phase}`)
}

async function main() {
  const commit = getLastCommit()
  console.log(`[hook] Post-commit: ${commit.hash} — ${commit.message}`)

  if (commit.branch !== 'feature/mvp-database-v2') {
    console.log(`[hook] Branche ${commit.branch} — skip`)
    process.exit(0)
  }

  try {
    const matches = await findKanbanTask(commit.message)
    if (matches.length > 0) {
      console.log(`[hook] ${matches.length} tâche(s) Kanban proche(s) trouvée(s)`)
    }
    await createCommitEntry(commit)
    await updateDashboard(commit)
    console.log('[hook] Notion sync OK ✅')
  } catch (e) {
    console.log('[hook] Notion sync failed (non-bloquant):', e.message)
  }
}

main()
