'use strict'

require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') })

const https = require('https')
const path = require('path')

const sequelize = require(path.join(__dirname, '../../backend/config/database'))
const Game = require(path.join(__dirname, '../../backend/src/models/Game'))
const { Op } = require(path.join(__dirname, '../../backend/node_modules/sequelize'))

const CLIENT_ID = process.env.IGDB_CLIENT_ID
const CLIENT_SECRET = process.env.IGDB_CLIENT_SECRET
const LIMIT = Math.max(1, Number.parseInt(process.argv[2] || '50', 10) || 50)

function requestJson(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}: ${data}`))
        }

        try {
          resolve(data ? JSON.parse(data) : {})
        } catch (error) {
          reject(error)
        }
      })
    })

    req.on('error', reject)
    if (body) {
      req.write(body)
    }
    req.end()
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildSearchBody(title) {
  const escaped = String(title || '').replace(/"/g, '')
  return `search "${escaped}"; fields name,cover,first_release_date,platforms.name; where cover != null; limit 10;`
}

function platformMatches(result, consoleName) {
  const platforms = Array.isArray(result.platforms) ? result.platforms : []
  if (!consoleName || !platforms.length) {
    return false
  }

  const normalizedConsole = normalizeTitle(consoleName)
  return platforms.some((platform) => normalizeTitle(platform?.name).includes(normalizedConsole))
}

function scoreResult(result, game) {
  const targetTitle = normalizeTitle(game.title)
  const resultTitle = normalizeTitle(result.name)
  let score = 0

  if (resultTitle === targetTitle) {
    score += 100
  } else if (resultTitle.includes(targetTitle) || targetTitle.includes(resultTitle)) {
    score += 60
  }

  if (platformMatches(result, game.console)) {
    score += 25
  }

  const year = Number(game.year)
  const releaseYear = result.first_release_date
    ? new Date(Number(result.first_release_date) * 1000).getUTCFullYear()
    : null

  if (year && releaseYear) {
    score += Math.max(0, 10 - Math.abs(year - releaseYear))
  }

  return score
}

async function getTwitchToken() {
  const pathWithQuery = `/oauth2/token?client_id=${encodeURIComponent(CLIENT_ID)}&client_secret=${encodeURIComponent(CLIENT_SECRET)}&grant_type=client_credentials`
  const payload = await requestJson({
    hostname: 'id.twitch.tv',
    path: pathWithQuery,
    method: 'POST',
  })

  if (!payload.access_token) {
    throw new Error('Unable to fetch Twitch access token')
  }

  return payload.access_token
}

async function igdbPost(endpoint, token, body) {
  return requestJson({
    hostname: 'api.igdb.com',
    path: `/v4/${endpoint}`,
    method: 'POST',
    headers: {
      'Client-ID': CLIENT_ID,
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'text/plain',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body)
}

async function findBestCover(game, token) {
  const searchResults = await igdbPost('games', token, buildSearchBody(game.title))
  if (!Array.isArray(searchResults) || !searchResults.length) {
    return null
  }

  const best = [...searchResults]
    .sort((left, right) => scoreResult(right, game) - scoreResult(left, game))
    .find((item) => item.cover)

  if (!best?.cover) {
    return null
  }

  const covers = await igdbPost('covers', token, `fields image_id; where id = ${best.cover}; limit 1;`)
  if (!Array.isArray(covers) || !covers[0]?.image_id) {
    return null
  }

  return `https://images.igdb.com/igdb/image/upload/t_cover_big/${covers[0].image_id}.jpg`
}

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('IGDB_CLIENT_ID or IGDB_CLIENT_SECRET missing in backend/.env')
  }

  const token = await getTwitchToken()

  const games = await Game.findAll({
    where: {
      cover_url: null,
      rarity: { [Op.in]: ['LEGENDARY', 'EPIC', 'RARE'] },
      type: 'game',
    },
    attributes: ['id', 'title', 'console', 'year', 'rarity', 'cover_url'],
    order: [['rarity', 'ASC'], ['title', 'ASC']],
    limit: LIMIT,
  })

  let updated = 0

  for (const game of games) {
    try {
      const coverUrl = await findBestCover(game, token)
      if (coverUrl) {
        await game.update({ cover_url: coverUrl })
        console.log(`[OK] ${game.title} -> ${coverUrl}`)
        updated += 1
      } else {
        console.log(`[MISS] ${game.title}`)
      }
    } catch (error) {
      console.log(`[ERR] ${game.title}: ${error.message}`)
    }

    await sleep(250)
  }

  console.log(`\n[DONE] ${updated}/${games.length} covers mises a jour`)
  await sequelize.close()
}

main().catch(async (error) => {
  console.error('[FATAL]', error.message)
  try {
    await sequelize.close()
  } catch (_closeError) {}
  process.exit(1)
})
