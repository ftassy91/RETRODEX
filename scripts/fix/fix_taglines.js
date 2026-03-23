'use strict'

const path = require('path')
module.paths.push(path.join(__dirname, '../../backend/node_modules'))

const { Op } = require('sequelize')
const { sequelize, databaseMode, databaseTarget } = require('../../backend/src/database')
const Game = require('../../backend/src/models/Game')

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isBrokenTagline(tagline, synopsis) {
  const cleanTagline = normalizeText(tagline)
  const cleanSynopsis = normalizeText(synopsis)

  if (!cleanTagline) {
    return false
  }

  const matchesSynopsisPrefix = Boolean(cleanSynopsis) && cleanTagline === cleanSynopsis.slice(0, 200)
  const looksTruncated = cleanTagline.length > 100 && !/[.!?]$/.test(cleanTagline)

  return matchesSynopsisPrefix || looksTruncated
}

function extractFirstSentence(synopsis) {
  const cleanSynopsis = normalizeText(synopsis)
  if (!cleanSynopsis) {
    return null
  }

  const match = cleanSynopsis.match(/^(.+?[.!?])(?:\s|$)/)
  if (!match) {
    return null
  }

  const sentence = normalizeText(match[1])
  if (sentence.length < 20 || sentence.length > 160) {
    return null
  }

  return sentence
}

async function main() {
  console.log(`[fix_taglines] mode=${databaseMode} target=${databaseTarget}`)
  await sequelize.authenticate()

  const games = await Game.findAll({
    attributes: ['id', 'title', 'tagline', 'synopsis'],
    where: {
      tagline: {
        [Op.not]: null,
      },
    },
  })

  let fixedCount = 0
  let nulledCount = 0

  for (const game of games) {
    if (!isBrokenTagline(game.tagline, game.synopsis)) {
      continue
    }

    const replacement = extractFirstSentence(game.synopsis)

    if (replacement) {
      if (normalizeText(game.tagline) !== replacement) {
        game.tagline = replacement
        await game.save({ fields: ['tagline'] })
        fixedCount += 1
      }
      continue
    }

    if (game.tagline !== null) {
      game.tagline = null
      await game.save({ fields: ['tagline'] })
      nulledCount += 1
    }
  }

  console.log(`[fix_taglines] fixed=${fixedCount} nulled=${nulledCount}`)
}

main()
  .catch((error) => {
    console.error('[fix_taglines] failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await sequelize.close()
  })
