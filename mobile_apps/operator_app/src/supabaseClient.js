// Supabase Client Configuration for SDAS Operator Console
// Supports Authenticated Session Persistence via AsyncStorage and Realtime WebSockets

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SUPABASE_CONFIG = {
  PROJECT_REF: process.env.EXPO_PUBLIC_SUPABASE_PROJECT_REF || 'gpxakbveqnzqqpxvtkgf',
  URL: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://gpxakbveqnzqqpxvtkgf.supabase.co',
  PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_IG22kbgb81H1Ge8PB5Rfkg_qINcdKEF'
};

export const supabase = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});
