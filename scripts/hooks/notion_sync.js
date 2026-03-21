'use strict'
require('dotenv').config({
  path: require('path').join(__dirname, '../../backend/.env')
})

const fs = require('fs')
const path = require('path')
const https = require('https')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '../..')
const NOTION_TOKEN = process.env.NOTION_TOKEN
const KANBAN_DB_ID = '3de5a2f353074e90b493ede9f82e4129'
const NOTION_CORE_VERSION = '2022-06-28'
const NOTION_FILES_VERSION = '2025-09-03'
const SCREENSHOT_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg'])
const MAX_SINGLE_UPLOAD_BYTES = 20 * 1024 * 1024
const DEFAULT_SCREENSHOT_DIR = path.join(ROOT, 'data', 'screenshots')
const MAX_SCREENSHOTS = Math.min(
  Math.max(parseInt(process.env.NOTION_MAX_SCREENSHOTS || '15', 10) || 15, 1),
  15
)

if (!NOTION_TOKEN) {
  console.log('[hook] NOTION_TOKEN not set - skip')
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

function getCliValue(flag) {
  const prefix = `${flag}=`
  const entry = process.argv.slice(2).find(arg => arg.startsWith(prefix))
  return entry ? entry.slice(prefix.length).trim() : ''
}

function resolveRepoPath(inputPath) {
  if (!inputPath) return ''
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(ROOT, inputPath)
}

function inferContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.png') return 'image/png'
  return 'image/jpeg'
}

function truncateFilename(filename) {
  if (Buffer.byteLength(filename, 'utf8') <= 200) return filename

  const ext = path.extname(filename)
  const base = path.basename(filename, ext)
  let trimmed = base
  while (trimmed.length > 0 && Buffer.byteLength(`${trimmed}${ext}`, 'utf8') > 200) {
    trimmed = trimmed.slice(0, -1)
  }

  return `${trimmed || 'upload'}${ext}`
}

function walkImages(dirPath, bucket) {
  if (!fs.existsSync(dirPath)) return

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      walkImages(fullPath, bucket)
      continue
    }

    const ext = path.extname(entry.name).toLowerCase()
    if (!SCREENSHOT_EXTENSIONS.has(ext)) continue

    const stat = fs.statSync(fullPath)
    if (!stat.isFile()) continue

    bucket.push({
      path: fullPath,
      name: entry.name,
      mtimeMs: stat.mtimeMs,
      size: stat.size
    })
  }
}

function collectScreenshotCandidates() {
  const explicitScreenshots = getCliValue('--screenshots')

  if (explicitScreenshots) {
    return explicitScreenshots
      .split(',')
      .map(value => resolveRepoPath(value.trim()))
      .filter(Boolean)
      .filter(filePath => {
        if (!fs.existsSync(filePath)) {
          console.log(`[hook] screenshot missing - ${filePath}`)
          return false
        }

        const ext = path.extname(filePath).toLowerCase()
        if (!SCREENSHOT_EXTENSIONS.has(ext)) {
          console.log(`[hook] screenshot skipped (unsupported) - ${filePath}`)
          return false
        }

        return true
      })
      .slice(0, MAX_SCREENSHOTS)
      .map(filePath => {
        const stat = fs.statSync(filePath)
        return {
          path: filePath,
          name: path.basename(filePath),
          mtimeMs: stat.mtimeMs,
          size: stat.size
        }
      })
  }

  const screenshotDir = resolveRepoPath(
    getCliValue('--screenshot-dir') || process.env.NOTION_SCREENSHOT_DIR || DEFAULT_SCREENSHOT_DIR
  )

  if (!screenshotDir || !fs.existsSync(screenshotDir)) {
    return []
  }

  const matches = []
  walkImages(screenshotDir, matches)
  matches.sort((a, b) => b.mtimeMs - a.mtimeMs)

  if (matches.length > MAX_SCREENSHOTS) {
    console.log(`[hook] screenshot limit applied - keeping ${MAX_SCREENSHOTS}/${matches.length}`)
  }

  return matches.slice(0, MAX_SCREENSHOTS)
}

function notionJsonRequest(method, requestPath, body, notionVersion = NOTION_CORE_VERSION) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const req = https.request({
      hostname: 'api.notion.com',
      path: requestPath,
      method,
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': notionVersion,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, res => {
      let raw = ''
      res.on('data', chunk => raw += chunk)
      res.on('end', () => {
        try {
          const parsed = raw ? JSON.parse(raw) : {}
          if (res.statusCode && res.statusCode >= 400) {
            return reject(new Error(parsed.message || `HTTP ${res.statusCode}`))
          }
          resolve(parsed)
        } catch (_error) {
          resolve({})
        }
      })
    })

    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

function notionMultipartRequest(requestPath, filePath, contentType, notionVersion = NOTION_FILES_VERSION) {
  return new Promise((resolve, reject) => {
    const boundary = `----RetroDexNotion${Date.now()}${Math.random().toString(16).slice(2)}`
    const filename = truncateFilename(path.basename(filePath))
    const fileBuffer = fs.readFileSync(filePath)
    const head = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
      'utf8'
    )
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
    const body = Buffer.concat([head, fileBuffer, tail])

    const req = https.request({
      hostname: 'api.notion.com',
      path: requestPath,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': notionVersion,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    }, res => {
      let raw = ''
      res.on('data', chunk => raw += chunk)
      res.on('end', () => {
        try {
          const parsed = raw ? JSON.parse(raw) : {}
          if (res.statusCode && res.statusCode >= 400) {
            return reject(new Error(parsed.message || `HTTP ${res.statusCode}`))
          }
          resolve(parsed)
        } catch (_error) {
          resolve({})
        }
      })
    })

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function detectPhase(message) {
  const value = message.toLowerCase()
  if (value.includes('encyclo') || value.includes('franchise')) return 'Encyclopedia'
  if (value.includes('market') || value.includes('price') || value.includes('trust')) return 'Market'
  if (value.includes('ui') || value.includes('html') || value.includes('css') || value.includes('style')) return 'UI'
  if (value.includes('pipeline') || value.includes('wikidata') || value.includes('seed') || value.includes('data')) return 'Data'
  if (value.includes('deploy') || value.includes('railway') || value.includes('vercel')) return 'Deploy'
  return 'Infra'
}

async function createCommitEntry(commit) {
  const page = await notionJsonRequest('POST', '/v1/pages', {
    parent: { database_id: KANBAN_DB_ID },
    properties: {
      'Tâche': { title: [{ text: { content: commit.message } }] },
      'Statut': { select: { name: '✅ Fait' } },
      'Phase': { select: { name: detectPhase(commit.message) } },
      'Commit': { rich_text: [{ text: { content: commit.hash } }] },
      'Notes': { rich_text: [{ text: { content: commit.date } }] }
    }
  })

  console.log(`[hook] Kanban Notion updated: ${commit.hash} -> ${detectPhase(commit.message)}`)
  return page
}

async function uploadScreenshot(fileInfo) {
  if (fileInfo.size > MAX_SINGLE_UPLOAD_BYTES) {
    throw new Error(`file too large (${Math.round(fileInfo.size / (1024 * 1024))}MB > 20MB)`)
  }

  const filename = truncateFilename(fileInfo.name)
  const contentType = inferContentType(fileInfo.path)
  const upload = await notionJsonRequest('POST', '/v1/file_uploads', {
    mode: 'single_part',
    filename,
    content_type: contentType
  }, NOTION_FILES_VERSION)

  const sent = await notionMultipartRequest(
    `/v1/file_uploads/${upload.id}/send`,
    fileInfo.path,
    contentType,
    NOTION_FILES_VERSION
  )

  if (sent.status !== 'uploaded') {
    throw new Error(`upload status is ${sent.status || 'unknown'}`)
  }

  return {
    id: upload.id,
    name: filename
  }
}

async function attachScreenshotsToPage(pageId, uploadedScreenshots) {
  const children = [
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [
          {
            type: 'text',
            text: { content: 'Screenshots' }
          }
        ],
        color: 'default'
      }
    },
    ...uploadedScreenshots.map(file => ({
      object: 'block',
      type: 'image',
      image: {
        type: 'file_upload',
        file_upload: { id: file.id },
        caption: [
          {
            type: 'text',
            text: { content: file.name }
          }
        ]
      }
    }))
  ]

  await notionJsonRequest(
    'PATCH',
    `/v1/blocks/${pageId}/children`,
    { children },
    NOTION_FILES_VERSION
  )
}

async function uploadAndAttachScreenshots(pageId) {
  const screenshots = collectScreenshotCandidates()
  if (!screenshots.length) {
    console.log('[hook] No local screenshots found - skip attachment')
    return
  }

  const uploaded = []
  for (const screenshot of screenshots) {
    try {
      const uploadedFile = await uploadScreenshot(screenshot)
      uploaded.push(uploadedFile)
      console.log(`[hook] screenshot uploaded: ${uploadedFile.name}`)
    } catch (error) {
      console.log(`[hook] screenshot skipped: ${screenshot.name} (${error.message})`)
    }
  }

  if (!uploaded.length) {
    console.log('[hook] No screenshot uploaded successfully')
    return
  }

  await attachScreenshotsToPage(pageId, uploaded)
  console.log(`[hook] ${uploaded.length} screenshot(s) attached to Notion page`)
}

async function main() {
  const commit = getLastCommit()

  if (commit.branch !== 'feature/mvp-database-v2') {
    console.log(`[hook] skip - branch ${commit.branch}`)
    process.exit(0)
  }

  console.log(`[hook] ${commit.hash} - ${commit.message}`)

  try {
    const page = await createCommitEntry(commit)
    if (page && page.id) {
      await uploadAndAttachScreenshots(page.id)
    }
    console.log('[hook] Notion sync OK')
  } catch (error) {
    console.log('[hook] Error (non-blocking):', error.message)
  }
}

main()
