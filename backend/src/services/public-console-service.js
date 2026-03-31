'use strict'

const {
  buildConsoleMarketPayload,
  buildConsoleQualityPayload,
  buildConsoleSourcesPayload,
  buildConsoleOverviewPayload,
  buildConsoleHardwarePayload,
  buildRelatedConsolePayload,
  buildNotableGamesPayload,
  buildConsoleListItem,
  buildPublishedConsoleRecord,
  buildStaticConsoleRecord,
} = require('./public-console/builders')
const {
  buildConsoleAliases,
  buildConsoleGamesMap,
  findConsoleInCatalog,
  getConsoleCatalogKey,
} = require('./public-console/catalog')
const {
  fetchPublishedConsoles,
  fetchGlobalConsoleResults,
  fetchGlobalFranchiseResults,
} = require('./public-console/fetchers')

module.exports = {
  buildConsoleGamesMap,
  buildConsoleMarketPayload,
  buildConsoleQualityPayload,
  buildConsoleSourcesPayload,
  buildConsoleOverviewPayload,
  buildConsoleHardwarePayload,
  buildRelatedConsolePayload,
  buildNotableGamesPayload,
  fetchPublishedConsoles,
  buildConsoleListItem,
  buildPublishedConsoleRecord,
  buildStaticConsoleRecord,
  buildConsoleAliases,
  findConsoleInCatalog,
  fetchGlobalConsoleResults,
  fetchGlobalFranchiseResults,
  getConsoleCatalogKey,
}
