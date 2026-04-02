'use strict'

const { SEARCH_CONTEXT_LABELS } = require('./public-search/base')
const { searchDex } = require('./public-search/dex')
const { searchCatalog } = require('./public-search/catalog')
const { searchGlobal } = require('./public-search/global')
const {
  listFranchises,
  getFranchiseBySlug,
  listFranchiseGamesBySlug,
} = require('./public-search/franchises')

module.exports = {
  SEARCH_CONTEXT_LABELS,
  searchDex,
  searchCatalog,
  searchGlobal,
  listFranchises,
  getFranchiseBySlug,
  listFranchiseGamesBySlug,
}
