'use strict'

// Centralized env var normalization — import this instead of duplicating remapping
process.env.SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPERDATA_Project_URL
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPERDATA_SERVICE_KEY
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPERDATA_Anon_Key

// Warn if key vars are missing (some routes may not need them)
if (process.env.NODE_ENV === 'production') {
  for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']) {
    if (!process.env[key]) {
      console.warn(`[env] ${key} is not set. Supabase features will fail.`)
    }
  }
}
