'use strict'

function resolveRequestUserId(req) {
  return String(
    req?.headers?.['x-retrodex-user-id']
    || req?.headers?.['x-user-id']
    || req?.query?.user_id
    || ''
  ).trim() || null
}

function resolveRequestCollectionScope(req) {
  const userId = resolveRequestUserId(req)
  return userId ? { userId } : {}
}

module.exports = {
  resolveRequestUserId,
  resolveRequestCollectionScope,
}
