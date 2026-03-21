require('dotenv').config({
  path: require('path').join(__dirname, '../../backend/.env')
})

'use strict'

const path = require('path')
const https = require('https')

const ROOT = path.join(__dirname, '../..')
const { Op, DataTypes } = require(path.join(ROOT, 'backend', 'node_modules', 'sequelize'))
const sequelize = require(path.join(ROOT, 'backend', 'config', 'database'))
const Game = require(path.join(ROOT, 'backend', 'src', 'models', 'Game'))

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY
      }
    }

    const req = https.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        let parsed

        try {
          parsed = JSON.parse(data)
        } catch (error) {
          reject(error)
          return
        }

        if (res.statusCode && res.statusCode >= 400) {
          const message = parsed?.error?.message || parsed?.message || `Anthropic HTTP ${res.statusCode}`
          reject(new Error(message))
          return
        }

        const text = parsed?.content?.[0]?.text || ''
        resolve(text)
      })
    })

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function buildPrompt(game) {
  return `You are a retro gaming encyclopedia writer. Generate encyclopedic content for the game "${game.title}" on ${game.console} (${game.year || 'unknown year'}).

Respond ONLY with a valid JSON object, no markdown, no explanation. Use this exact structure:
{
  "synopsis": "A narrative description of the game in 150-200 words covering gameplay, story, atmosphere and why it matters historically.",
  "dev_anecdotes": [
    { "title": "Anecdote title", "text": "2-3 sentences about a development story, challenge, or fun fact." },
    { "title": "Anecdote title", "text": "2-3 sentences about another development story." }
  ],
  "dev_team": [
    { "role": "Director", "name": "Full Name" },
    { "role": "Producer", "name": "Full Name" },
    { "role": "Composer", "name": "Full Name" }
  ],
  "cheat_codes": [
    { "name": "Cheat name", "code": "Button sequence or code", "effect": "What it does" },
    { "name": "Cheat name", "code": "Button sequence or code", "effect": "What it does" }
  ]
}

If you don't know specific cheat codes or team members, use empty arrays [].
Always respond with valid JSON only.`
}

function cleanClaudeJson(raw) {
  return String(raw || '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()
}

function asJsonString(value) {
  return Array.isArray(value) ? JSON.stringify(value) : null
}

async function ensureEncyclopediaColumns() {
  const queryInterface = sequelize.getQueryInterface()
  const columns = await queryInterface.describeTable('games').catch(() => null)

  if (!columns) {
    return
  }

  const missingColumns = [
    ['synopsis', { type: DataTypes.TEXT, allowNull: true }],
    ['dev_anecdotes', { type: DataTypes.TEXT, allowNull: true }],
    ['dev_team', { type: DataTypes.TEXT, allowNull: true }],
    ['cheat_codes', { type: DataTypes.TEXT, allowNull: true }]
  ].filter(([name]) => !columns[name])

  for (const [name, definition] of missingColumns) {
    await queryInterface.addColumn('games', name, definition)
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[FATAL] ANTHROPIC_API_KEY not set in environment')
    process.exit(1)
  }

  const limit = parseInt(process.argv[2], 10) || 10

  await ensureEncyclopediaColumns()
  await sequelize.sync({ alter: false })

  const games = await Game.findAll({
    where: {
      type: 'game',
      synopsis: null,
      rarity: { [Op.in]: ['LEGENDARY', 'EPIC', 'RARE'] }
    },
    order: [['rarity', 'ASC'], ['mintPrice', 'DESC']],
    limit
  })

  console.log(`[INFO] ${games.length} jeux a enrichir`)

  let ok = 0
  let errors = 0

  for (const game of games) {
    process.stdout.write(`  Generation: ${game.title} (${game.console})...`)

    try {
      const raw = await callClaude(buildPrompt(game))
      const data = JSON.parse(cleanClaudeJson(raw))

      await game.update({
        synopsis: data.synopsis || null,
        dev_anecdotes: asJsonString(data.dev_anecdotes),
        dev_team: asJsonString(data.dev_team),
        cheat_codes: asJsonString(data.cheat_codes)
      })

      console.log(' [OK]')
      ok += 1
      await new Promise((resolve) => setTimeout(resolve, 500))
    } catch (error) {
      console.log(` [ERR] (${error.message})`)
      errors += 1
    }
  }

  console.log('\n==========================')
  console.log('RESUME ENCYCLOPEDIE')
  console.log('==========================')
  console.log(`  Enrichis  : ${ok}`)
  console.log(`  Erreurs   : ${errors}`)

  await sequelize.close()
}

main().catch(async (err) => {
  console.error('[FATAL]', err.message)
  process.exit(1)
})
