// Supabase Client Configuration & Realtime Initializer for SDAS Public Portal
// Uses anonymous publishable key for secure, read-only access with Realtime WebSocket support

import { createClient } from '@supabase/supabase-js';

export const SUPABASE_CONFIG = {
  PROJECT_REF: process.env.EXPO_PUBLIC_SUPABASE_PROJECT_REF || 'gpxakbveqnzqqpxvtkgf',
  URL: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://gpxakbveqnzqqpxvtkgf.supabase.co',
  PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_IG22kbgb81H1Ge8PB5Rfkg_qINcdKEF'
};

export const supabase = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});
