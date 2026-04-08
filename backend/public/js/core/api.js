'use strict'

;(() => {
  let collectionIndexPromise = null
  const REQUEST_TIMEOUT_MS = 12000
  const GET_RETRY_COUNT = 1

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms))
  }

  function isGetRequest(options = {}) {
    return String(options?.method || 'GET').trim().toUpperCase() === 'GET'
  }

  function shouldRetryRequest(response, error, attempt, maxRetries, options = {}) {
    if (!isGetRequest(options) || attempt >= maxRetries) {
      return false
    }

    if (error?.name === 'AbortError') {
      return true
    }

    if (!response) {
      return true
    }

    return response.status >= 500 || response.status === 429 || response.status === 408
  }

  async function fetchJson(url, options = {}) {
    const {
      timeoutMs = REQUEST_TIMEOUT_MS,
      retries = isGetRequest(options) ? GET_RETRY_COUNT : 0,
      ...requestOptions
    } = options || {}

    let attempt = 0

    while (attempt <= retries) {
      const controller = typeof AbortController === 'function' ? new AbortController() : null
      const timeoutId = controller && timeoutMs > 0
        ? window.setTimeout(() => controller.abort(), timeoutMs)
        : null

      let response
      let payload

      try {
        response = await fetch(url, {
          ...requestOptions,
          signal: controller ? controller.signal : requestOptions.signal,
        })
        payload = await response.json().catch(() => ({}))
      } catch (error) {
        if (timeoutId) {
          window.clearTimeout(timeoutId)
        }

        if (shouldRetryRequest(null, error, attempt, retries, requestOptions)) {
          attempt += 1
          await sleep(250 * attempt)
          continue
        }

        if (error?.name === 'AbortError') {
          throw new Error(`Request timeout for ${url}`)
        }

        throw error
      }

      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }

      if (!response.ok) {
        const responseError = new Error(payload.error || `${response.status} ${response.statusText}`)
        if (shouldRetryRequest(response, responseError, attempt, retries, requestOptions)) {
          attempt += 1
          await sleep(250 * attempt)
          continue
        }
        throw responseError
      }

      return payload
    }

    throw new Error(`Request failed for ${url}`)
  }

  function getItems(payload) {
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.items)) return payload.items
    if (Array.isArray(payload?.results)) return payload.results
    if (Array.isArray(payload?.games)) return payload.games
    if (Array.isArray(payload?.franchises)) return payload.franchises
    if (Array.isArray(payload?.consoles)) return payload.consoles
    return []
  }

  function getTotal(payload) {
    if (typeof payload?.total === 'number') return payload.total
    if (typeof payload?.count === 'number') return payload.count
    const items = getItems(payload)
    return items.length
  }

  async function fetchSearch(query, type, limit) {
    const payload = await fetchJson(
      `/api/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type || 'all')}&limit=${encodeURIComponent(limit || 30)}`
    )

    return {
      raw: payload,
      ok: payload.ok !== false,
      items: getItems(payload),
      total: getTotal(payload),
    }
  }

  async function fetchMarketSearch(query, limit) {
    const payload = await fetchJson(
      `/api/market/search?q=${encodeURIComponent(query || '')}&limit=${encodeURIComponent(limit || 20)}`
    )

    return {
      raw: payload,
      ok: payload.ok !== false,
      items: getItems(payload),
      total: getTotal(payload),
    }
  }

  async function fetchDexSearch(query, limit) {
    const payload = await fetchJson(
      `/api/dex/search?q=${encodeURIComponent(query || '')}&limit=${encodeURIComponent(limit || 120)}`
    )

    return {
      raw: payload,
      ok: payload.ok !== false,
      items: getItems(payload),
      total: getTotal(payload),
    }
  }

  async function fetchCollection(listType, isPublic) {
    const normalizedListType = String(listType || '').trim().toLowerCase()
    const url = isPublic && normalizedListType === 'for_sale'
      ? '/api/collection/public'
      : normalizedListType
        ? `/api/collection?list_type=${encodeURIComponent(normalizedListType)}`
        : '/api/collection'
    const payload = await fetchJson(url)
    return {
      raw: payload,
      items: getItems(payload),
      total: getTotal(payload),
    }
  }

  async function fetchCollectionSearch({ query = '', listType = 'owned', consoleName = '', sort = 'title_asc', limit = 200 } = {}) {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (listType) params.set('list_type', listType)
    if (consoleName) params.set('console', consoleName)
    if (sort) params.set('sort', sort)
    if (limit) params.set('limit', String(limit))

    const payload = await fetchJson(`/api/collection/search?${params.toString()}`)
    return {
      raw: payload,
      ok: payload.ok !== false,
      items: getItems(payload),
      total: getTotal(payload),
    }
  }

  function buildCollectionIndex(items) {
    const safeItems = Array.isArray(items) ? items : []
    const byGameId = new Map()
    const ownedIds = new Set()
    const wantedIds = new Set()
    const forSaleIds = new Set()

    safeItems.forEach((item) => {
      const gameId = item?.gameId || item?.game?.id || item?.id
      const listType = String(item?.list_type || 'owned').toLowerCase()
      if (!gameId) {
        return
      }

      byGameId.set(gameId, item)
      if (listType === 'wanted') {
        wantedIds.add(gameId)
      } else if (listType === 'for_sale') {
        forSaleIds.add(gameId)
      } else {
        ownedIds.add(gameId)
      }
    })

    return {
      items: safeItems,
      byGameId,
      ownedIds,
      wantedIds,
      forSaleIds,
    }
  }

  async function fetchCollectionIndex(forceRefresh = false) {
    if (!forceRefresh && collectionIndexPromise) {
      return collectionIndexPromise
    }

    collectionIndexPromise = fetchCollection(null)
      .then((payload) => buildCollectionIndex(payload.items))
      .catch((error) => {
        collectionIndexPromise = null
        throw error
      })

    return collectionIndexPromise
  }

  window.RetroDexApi = {
    fetchJson,
    fetchCollection,
    fetchCollectionIndex,
    fetchCollectionSearch,
    fetchDexSearch,
    fetchMarketSearch,
    fetchSearch,
    buildCollectionIndex,
    getItems,
    getTotal,
  }
})()
