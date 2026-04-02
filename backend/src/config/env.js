'use strict'

const path = require('path')
const dotenv = require('dotenv')

dotenv.config({
  path: path.join(__dirname, '../../.env'),
})

const SUPABASE_URL_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_Project_URL',
  'SUPERDATA_Project_URL',
]

const DATABASE_URL_KEYS = [
  'DATABASE_URL',
  'SUPABASE_DB_URL',
  'SUPABASE_DATABASE_URL',
  'SUPABASE_Project_URL',
  'SUPERDATA_Project_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
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

const VERCEL_PUBLIC_SUPABASE_FALLBACK = {
  url: 'https://doipqgkhfzqvmzrdfvuq.supabase.co',
  anonKey: 'sb_publishable_9ABSdylyVHbMkyA40-PmvA_BdwUj9jX',
}

function firstDefined(keys = []) {
  for (const key of keys) {
    const value = process.env[key]
    if (value) {
      return value
    }
  }

  return null
}

function looksLikeHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim())
}

function looksLikeDatabaseUrl(value) {
  return /^(postgres|postgresql):\/\//i.test(String(value || '').trim())
}

function firstMatching(keys = [], predicate = () => true) {
  for (const key of keys) {
    const value = process.env[key]
    if (value && predicate(value)) {
      return value
    }
  }

  return null
}

function deriveSupabaseUrlFromDatabaseUrl(databaseUrl) {
  if (!looksLikeDatabaseUrl(databaseUrl)) {
    return null
  }

  try {
    const parsed = new URL(String(databaseUrl).trim())
    const host = String(parsed.hostname || '').toLowerCase()
    const username = decodeURIComponent(String(parsed.username || ''))

    let projectRef = null

    const directMatch = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)
    if (directMatch) {
      projectRef = directMatch[1]
    }

    if (!projectRef) {
      const pooledMatch = username.match(/^postgres(?:\.([a-z0-9]+))?$/i)
      if (pooledMatch?.[1]) {
        projectRef = pooledMatch[1]
      }
    }

    return projectRef ? `https://${projectRef}.supabase.co` : null
  } catch (_error) {
    return null
  }
}

function resolveSupabaseEnv() {
  const databaseUrl = firstMatching(DATABASE_URL_KEYS, looksLikeDatabaseUrl)
  const useVercelPublicFallback = Boolean(process.env.VERCEL)
  const publicUrl = firstMatching(SUPABASE_URL_KEYS, looksLikeHttpUrl)
    || deriveSupabaseUrlFromDatabaseUrl(databaseUrl)
    || (useVercelPublicFallback ? VERCEL_PUBLIC_SUPABASE_FALLBACK.url : null)
  const anonKey = firstDefined(SUPABASE_ANON_KEY_KEYS)
    || (useVercelPublicFallback ? VERCEL_PUBLIC_SUPABASE_FALLBACK.anonKey : null)

  return {
    url: publicUrl,
    serviceKey: firstDefined(SUPABASE_SERVICE_KEY_KEYS),
    anonKey,
    databaseUrl,
  }
}

function applyResolvedSupabaseEnv() {
  const resolved = resolveSupabaseEnv()
  const allowDatabaseUrlAlias = Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production')

  if (resolved.url && !process.env.SUPABASE_URL) {
    process.env.SUPABASE_URL = resolved.url
  }

  if (resolved.serviceKey && !process.env.SUPABASE_SERVICE_KEY) {
    process.env.SUPABASE_SERVICE_KEY = resolved.serviceKey
  }

  if (resolved.anonKey && !process.env.SUPABASE_ANON_KEY) {
    process.env.SUPABASE_ANON_KEY = resolved.anonKey
  }

  if (allowDatabaseUrlAlias && resolved.databaseUrl && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = resolved.databaseUrl
  }

  return resolved
}

function getRuntimeDbContext() {
  const resolved = applyResolvedSupabaseEnv()
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL)
  const isVercel = Boolean(process.env.VERCEL)
  const databaseMode = hasDatabaseUrl ? 'postgres' : 'sqlite'

  return {
    databaseMode,
    isProdPostgres: process.env.NODE_ENV === 'production' && hasDatabaseUrl,
    isDevSqlite: databaseMode === 'sqlite' && !isVercel,
    isVercel,
    hasDatabaseUrl,
    hasServerlessSupabaseEnv: Boolean(process.env.SUPABASE_URL || process.env.SUPERDATA_Project_URL),
    hasSupabaseEnv: Boolean(resolved.url && (resolved.serviceKey || resolved.anonKey)),
    supportsCanonicalTables: databaseMode === 'postgres' || (databaseMode === 'sqlite' && !isVercel),
    supabaseUrl: resolved.url,
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
  DATABASE_URL_KEYS,
  SUPABASE_SERVICE_KEY_KEYS,
  SUPABASE_ANON_KEY_KEYS,
  deriveSupabaseUrlFromDatabaseUrl,
  resolveSupabaseEnv,
  applyResolvedSupabaseEnv,
  getRuntimeDbContext,
  logRuntimeDbContext,
}
