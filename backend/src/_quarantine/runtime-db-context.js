'use strict'

const path = require('path')

require('dotenv').config({
  path: path.join(__dirname, '../../.env'),
})

const SUPABASE_URL_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_Project_URL',
  'SUPERDATA_Project_URL',
]

const SUPABASE_SERVICE_KEY_KEYS = [
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPERDATA_SERVICE_KEY',
]

const SUPABASE_ANON_KEY_KEYS = [
  'SUPABASE_ANON_KEY',
  'SUPERDATA_Anon_Key',
]

function firstDefined(keys = []) {
  for (const key of keys) {
    const value = process.env[key]
    if (value) {
      return value
    }
  }

  return null
}

function resolveSupabaseEnv() {
  return {
    url: firstDefined(SUPABASE_URL_KEYS),
    serviceKey: firstDefined(SUPABASE_SERVICE_KEY_KEYS),
    anonKey: firstDefined(SUPABASE_ANON_KEY_KEYS),
  }
}

function applyResolvedSupabaseEnv() {
  const resolved = resolveSupabaseEnv()

  if (resolved.url && !process.env.SUPABASE_URL) {
    process.env.SUPABASE_URL = resolved.url
  }

  if (resolved.serviceKey && !process.env.SUPABASE_SERVICE_KEY) {
    process.env.SUPABASE_SERVICE_KEY = resolved.serviceKey
  }

  if (resolved.anonKey && !process.env.SUPABASE_ANON_KEY) {
    process.env.SUPABASE_ANON_KEY = resolved.anonKey
  }

  return resolved
}

const resolvedSupabaseEnv = applyResolvedSupabaseEnv()
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL)
const isVercel = Boolean(process.env.VERCEL)
const isProdPostgres = process.env.NODE_ENV === 'production' && hasDatabaseUrl
const databaseMode = hasDatabaseUrl ? 'postgres' : 'sqlite'

function getRuntimeDbContext() {
  return {
    databaseMode,
    isProdPostgres,
    isDevSqlite: databaseMode === 'sqlite' && !isVercel,
    isVercel,
    hasDatabaseUrl,
    hasSupabaseEnv: Boolean(resolvedSupabaseEnv.url && (resolvedSupabaseEnv.serviceKey || resolvedSupabaseEnv.anonKey)),
    supportsCanonicalTables: databaseMode === 'postgres' || (databaseMode === 'sqlite' && !isVercel),
    supabaseUrl: resolvedSupabaseEnv.url,
  }
}

function logRuntimeDbContext(logger = console) {
  const context = getRuntimeDbContext()
  logger.log(
    `[DB] runtime=${context.databaseMode} canonical=${context.supportsCanonicalTables ? 'yes' : 'no'} vercel=${context.isVercel ? 'yes' : 'no'}`
  )
}

module.exports = {
  SUPABASE_URL_KEYS,
  SUPABASE_SERVICE_KEY_KEYS,
  SUPABASE_ANON_KEY_KEYS,
  resolveSupabaseEnv,
  applyResolvedSupabaseEnv,
  getRuntimeDbContext,
  logRuntimeDbContext,
}
