'use strict';

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL =
  process.env.SUPABASE_URL
  || process.env.SUPERDATA_Project_URL
  || process.env.SUPABASE_PROJECT_URL
  || null;

const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPERDATA_SERVICE_KEY
  || null;

const DATABASE_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'storage', 'retrodex.sqlite');
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);

let db = null;
let supabase = null;

if (USE_SUPABASE) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
} else {
  try {
    const Database = require('better-sqlite3');
    db = new Database(DATABASE_PATH);
    db.pragma('journal_mode = WAL');
  } catch (_error) {
    throw new Error('No Supabase configuration found and better-sqlite3 is unavailable. Set SUPABASE_URL or SUPERDATA_Project_URL plus SUPABASE_SERVICE_KEY in backend/.env.');
  }
}

module.exports = {
  path,
  db,
  supabase,
  USE_SUPABASE,
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  DATABASE_PATH,
};
