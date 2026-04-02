'use strict'

const { Op } = require('sequelize')
const { mode: dbMode } = require('../../db_supabase')

function shouldUseEmptyAccessoryFallback() {
  return Boolean(process.env.VERCEL && dbMode === 'supabase')
}

function toAccessoryPayload(item, consoleTitleMap) {
  return {
    id: item.id,
    name: item.name,
    console_id: item.console_id || null,
    console_title: item.console_id ? consoleTitleMap.get(item.console_id) || null : null,
    accessory_type: item.accessory_type || null,
    release_year: item.release_year || null,
    slug: item.slug || null,
  }
}

async function fetchConsoleTitles(consoleIds = []) {
  const Game = require('../models/Game')
  const ids = Array.from(new Set((consoleIds || []).filter(Boolean)))
  if (!ids.length) {
    return new Map()
  }

  const consoles = await Game.findAll({
    attributes: ['id', 'title'],
    where: {
      id: {
        [Op.in]: ids,
      },
    },
  })

  return new Map(consoles.map((item) => [item.id, item.title]))
}

async function listAccessoryTypes() {
  if (shouldUseEmptyAccessoryFallback()) {
    return []
  }

  const Accessory = require('../models/Accessory')
  const accessories = await Accessory.findAll({
    attributes: ['accessory_type'],
    order: [['accessory_type', 'ASC']],
  })

  return Array.from(new Set(
    accessories
      .map((item) => item.accessory_type)
      .filter(Boolean)
  ))
}

async function listAccessories() {
  if (shouldUseEmptyAccessoryFallback()) {
    return {
      accessories: [],
      count: 0,
    }
  }

  const Accessory = require('../models/Accessory')
  const accessories = await Accessory.findAll({
    order: [['name', 'ASC']],
  })
  const consoleTitles = await fetchConsoleTitles(
    accessories
      .map((item) => item.console_id)
      .filter(Boolean)
  )

  return {
    accessories: accessories.map((item) => toAccessoryPayload(item, consoleTitles)),
    count: accessories.length,
  }
}

async function listConsoleAccessories(consoleId, options = {}) {
  if (shouldUseEmptyAccessoryFallback()) {
    return []
  }

  const Accessory = require('../models/Accessory')
  const { limit = 10 } = options
  const accessories = await Accessory.findAll({
    where: {
      console_id: consoleId,
    },
    order: [['name', 'ASC']],
    limit,
  })

  return accessories.map((item) => ({
    id: item.id,
    name: item.name,
    accessory_type: item.accessory_type || null,
    slug: item.slug || null,
  }))
}

module.exports = {
  listAccessoryTypes,
  listAccessories,
  listConsoleAccessories,
}
