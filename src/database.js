/**
 * OptiAsset Backend — Supabase Database Client
 * Uses service_role key for admin-level access (bypasses RLS).
 */

const { createClient } = require("@supabase/supabase-js");
const config = require("./config");

const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = supabase;
