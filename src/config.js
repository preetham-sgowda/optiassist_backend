/**
 * OptiAsset Backend — Configuration
 * Loads environment variables from .env
 */

require("dotenv").config();

const config = {
  supabaseUrl: process.env.SUPABASE_URL || "https://placeholder.supabase.co",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key",
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET || "placeholder-secret",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  port: parseInt(process.env.PORT, 10) || 8000,
};

module.exports = config;
