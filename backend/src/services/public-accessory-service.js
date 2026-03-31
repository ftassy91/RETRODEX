'use strict'

const {
  listLegacyConsoleAccessories,
  listLegacyAccessoryTypes,
  listLegacyAccessories,
} = require('./legacy-market-accessory-service')

async function listAccessoryTypes() {
  return listLegacyAccessoryTypes()
}

async function listAccessories() {
  return listLegacyAccessories()
}

async function listConsoleAccessories(consoleId, options = {}) {
  return listLegacyConsoleAccessories(consoleId, options)
}

module.exports = {
  listAccessoryTypes,
  listAccessories,
  listConsoleAccessories,
}
